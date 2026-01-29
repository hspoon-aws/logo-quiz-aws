#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Logo Quiz AWS - Deployment Continuation"
echo "=========================================="
echo "Project root: $PROJECT_ROOT"

# Step 1: Check for existing build or start new one
echo -e "\n${YELLOW}Step 1: Checking CodeBuild status...${NC}"

# Get the latest build ID
BUILD_ID=$(aws codebuild list-builds-for-project --project-name LogoQuiz-api-build --max-items 1 --query 'ids[0]' --output text 2>/dev/null || echo "")

if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" == "None" ] || [ "$BUILD_ID" == "null" ]; then
    echo "No existing builds found. Starting new build..."
    BUILD_ID=$(aws codebuild start-build --project-name LogoQuiz-api-build --query 'build.id' --output text)
    echo "Started build: $BUILD_ID"
fi

echo "Checking build: $BUILD_ID"
BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)

if [ "$BUILD_STATUS" == "SUCCEEDED" ]; then
    echo -e "${GREEN}✓ CodeBuild completed successfully!${NC}"
elif [ "$BUILD_STATUS" == "IN_PROGRESS" ]; then
    echo -e "${YELLOW}⏳ Build in progress. Waiting...${NC}"
    while [ "$BUILD_STATUS" == "IN_PROGRESS" ]; do
        PHASE=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].currentPhase' --output text)
        echo "  Status: $BUILD_STATUS, Phase: $PHASE"
        sleep 30
        BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)
    done

    if [ "$BUILD_STATUS" == "SUCCEEDED" ]; then
        echo -e "${GREEN}✓ CodeBuild completed successfully!${NC}"
    else
        echo -e "${RED}✗ CodeBuild failed with status: $BUILD_STATUS${NC}"
        aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].phases' --output table
        exit 1
    fi
elif [ "$BUILD_STATUS" == "FAILED" ]; then
    echo -e "${RED}Previous build failed. Starting new build...${NC}"
    BUILD_ID=$(aws codebuild start-build --project-name LogoQuiz-api-build --query 'build.id' --output text)
    echo "Started new build: $BUILD_ID"
    echo -e "${YELLOW}⏳ Waiting for build...${NC}"
    BUILD_STATUS="IN_PROGRESS"
    while [ "$BUILD_STATUS" == "IN_PROGRESS" ]; do
        PHASE=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].currentPhase' --output text)
        echo "  Status: $BUILD_STATUS, Phase: $PHASE"
        sleep 30
        BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)
    done

    if [ "$BUILD_STATUS" == "SUCCEEDED" ]; then
        echo -e "${GREEN}✓ CodeBuild completed successfully!${NC}"
    else
        echo -e "${RED}✗ CodeBuild failed!${NC}"
        exit 1
    fi
else
    echo "Build status: $BUILD_STATUS - starting fresh build..."
    BUILD_ID=$(aws codebuild start-build --project-name LogoQuiz-api-build --query 'build.id' --output text)
    echo "Started build: $BUILD_ID"
    echo -e "${YELLOW}⏳ Waiting for build...${NC}"
    BUILD_STATUS="IN_PROGRESS"
    while [ "$BUILD_STATUS" == "IN_PROGRESS" ]; do
        PHASE=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].currentPhase' --output text)
        echo "  Status: $BUILD_STATUS, Phase: $PHASE"
        sleep 30
        BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)
    done

    if [ "$BUILD_STATUS" == "SUCCEEDED" ]; then
        echo -e "${GREEN}✓ CodeBuild completed successfully!${NC}"
    else
        echo -e "${RED}✗ CodeBuild failed!${NC}"
        exit 1
    fi
fi

# Step 2: Verify image in ECR
echo -e "\n${YELLOW}Step 2: Verifying image in ECR...${NC}"
IMAGE_DIGEST=$(aws ecr describe-images --repository-name logoquiz-api --image-ids imageTag=latest --query 'imageDetails[0].imageDigest' --output text 2>/dev/null || echo "")

if [ -n "$IMAGE_DIGEST" ] && [ "$IMAGE_DIGEST" != "None" ] && [ "$IMAGE_DIGEST" != "null" ]; then
    echo -e "${GREEN}✓ Image found in ECR: $IMAGE_DIGEST${NC}"
else
    echo -e "${RED}✗ No 'latest' image found in ECR${NC}"
    exit 1
fi

# Step 3: Deploy App Runner
echo -e "\n${YELLOW}Step 3: Deploying App Runner...${NC}"
cd "$PROJECT_ROOT/infra"

echo "Running CDK deploy for API stack..."
npx cdk deploy LogoQuizApi --require-approval never

# Get the API URL (output key is ApiServiceUrl)
API_URL=$(aws cloudformation describe-stacks --stack-name LogoQuizApi --query "Stacks[0].Outputs[?OutputKey=='ApiServiceUrl'].OutputValue" --output text)
echo -e "${GREEN}✓ API deployed at: $API_URL${NC}"

# Step 4: Wait for App Runner to be ready
echo -e "\n${YELLOW}Step 4: Waiting for App Runner to be ready...${NC}"
echo "This may take a few minutes for initial deployment..."

for i in {1..30}; do
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health" 2>/dev/null || echo "000")
    if [ "$HEALTH_STATUS" == "200" ]; then
        echo -e "${GREEN}✓ API health check passed!${NC}"
        break
    fi
    echo "  Attempt $i/30: Status $HEALTH_STATUS - waiting 15s..."
    sleep 15
done

if [ "$HEALTH_STATUS" != "200" ]; then
    echo -e "${YELLOW}⚠ API not responding yet (status: $HEALTH_STATUS). It may still be starting.${NC}"
    echo "Check manually: curl $API_URL/api/health"
    echo "Continuing with deployment..."
fi

# Step 5: Update secrets and seed production database
echo -e "\n${YELLOW}Step 5: Updating secrets and seeding DynamoDB...${NC}"
cd "$PROJECT_ROOT"

# Get secrets ARN and update with proper values
SECRETS_ARN=$(aws cloudformation describe-stacks --stack-name LogoQuizApi --query "Stacks[0].Outputs[?OutputKey=='SecretsArn'].OutputValue" --output text)
echo "Updating secrets at: $SECRETS_ARN"

# Update secrets with default values for test user to work
aws secretsmanager put-secret-value \
    --secret-id "$SECRETS_ARN" \
    --secret-string '{"APP_SALT":"mysalt","APP_SESSION_SECRET":"mysecret"}' \
    > /dev/null 2>&1 || echo "Warning: Could not update secrets (may need manual update)"

# Run seed script against production (no local endpoint)
unset DYNAMODB_ENDPOINT
APP_SALT=mysalt AWS_REGION=us-east-1 npx tsx scripts/seed-dynamodb.ts

echo -e "${GREEN}✓ Database seeded!${NC}"

# Step 6: Build and deploy frontend
echo -e "\n${YELLOW}Step 6: Building and deploying frontend...${NC}"

# Update frontend environment with API URL (preserve Firebase config)
ENV_FILE="$PROJECT_ROOT/apps/logo-quiz/src/environments/environment.prod.ts"

cat > "$ENV_FILE" << EOF
import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  apiUrl: '${API_URL}',
  firebase: {
    apiKey: 'AIzaSyByGkdd0Nly2t4vZP0HJ9EuriXnqmWTeaA',
    authDomain: 'logo-quiz-prod.firebaseapp.com',
    databaseURL: 'https://logo-quiz-prod.firebaseio.com',
    projectId: 'logo-quiz-prod',
    storageBucket: 'logo-quiz-prod.appspot.com',
    messagingSenderId: '653537369067',
    appId: '1:653537369067:web:7063dba90f49536558d7ae',
    measurementId: 'G-6MHFM5RFBW',
  },
};

export default environment;
EOF

echo "Updated environment.prod.ts with API URL: $API_URL"

echo "Building frontend..."
npm run build:frontend

# Deploy frontend stack
cd "$PROJECT_ROOT/infra"
npx cdk deploy LogoQuizFrontend --require-approval never

# Get outputs (using correct output keys)
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name LogoQuizFrontend --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketName'].OutputValue" --output text)
CF_URL=$(aws cloudformation describe-stacks --stack-name LogoQuizFrontend --query "Stacks[0].Outputs[?OutputKey=='DistributionUrl'].OutputValue" --output text)
CF_ID=$(aws cloudformation describe-stacks --stack-name LogoQuizFrontend --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)

cd "$PROJECT_ROOT"

# Upload to S3
echo "Uploading to S3 bucket: $S3_BUCKET"
aws s3 sync dist/apps/logo-quiz/ "s3://$S3_BUCKET/" --delete

# Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*" > /dev/null

echo -e "${GREEN}✓ Frontend deployed!${NC}"

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "API URL:      $API_URL"
echo "Frontend URL: $CF_URL"
echo ""
echo "Test endpoints:"
echo "  curl $API_URL/api/health"
echo "  curl $API_URL/api/levels"
echo ""
echo "Login credentials:"
echo "  Email: quiz@gmail.com"
echo "  Password: testing"
