#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Rebuild and Deploy API"
echo "=========================================="

cd "$PROJECT_ROOT"

# Step 1: Package source
echo -e "\n${YELLOW}Step 1: Packaging source code...${NC}"
mkdir -p /tmp/claude
rm -f /tmp/claude/source.zip
zip -r /tmp/claude/source.zip . \
    -x "node_modules/*" \
    -x ".git/*" \
    -x "dist/*" \
    -x "*.log" \
    -x ".env*"
echo -e "${GREEN}✓ Source packaged${NC}"

# Step 2: Upload to S3
echo -e "\n${YELLOW}Step 2: Uploading to S3...${NC}"
BUCKET="logoquiz-codebuild-source-851725625065"
aws s3 cp /tmp/claude/source.zip "s3://$BUCKET/source.zip"
echo -e "${GREEN}✓ Source uploaded to S3${NC}"

# Step 3: Start CodeBuild
echo -e "\n${YELLOW}Step 3: Starting CodeBuild...${NC}"
BUILD_ID=$(aws codebuild start-build --project-name LogoQuiz-api-build --query 'build.id' --output text)
echo "Build ID: $BUILD_ID"

# Step 4: Wait for build
echo -e "\n${YELLOW}Step 4: Waiting for build to complete...${NC}"
BUILD_STATUS="IN_PROGRESS"
while [ "$BUILD_STATUS" == "IN_PROGRESS" ]; do
    PHASE=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].currentPhase' --output text)
    echo "  Phase: $PHASE"
    sleep 15
    BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)
done

if [ "$BUILD_STATUS" == "SUCCEEDED" ]; then
    echo -e "${GREEN}✓ Build succeeded!${NC}"
else
    echo -e "${RED}✗ Build failed: $BUILD_STATUS${NC}"
    echo "Check logs:"
    echo "  aws codebuild batch-get-builds --ids '$BUILD_ID' --query 'builds[0].logs'"
    exit 1
fi

# Step 5: Check if App Runner service exists
echo -e "\n${YELLOW}Step 5: Checking App Runner service...${NC}"
SERVICE_ARN=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='LogoQuiz-api'].ServiceArn" --output text 2>/dev/null || echo "")

if [ -z "$SERVICE_ARN" ] || [ "$SERVICE_ARN" == "None" ]; then
    echo "No existing App Runner service. Deploying via CDK..."
    cd "$PROJECT_ROOT/infra"
    npx cdk deploy LogoQuizApi --require-approval never
else
    echo "App Runner service exists: $SERVICE_ARN"
    echo "Triggering deployment..."
    aws apprunner start-deployment --service-arn "$SERVICE_ARN"

    echo "Waiting for deployment..."
    sleep 10

    # Poll for deployment status
    for i in {1..40}; do
        STATUS=$(aws apprunner describe-service --service-arn "$SERVICE_ARN" --query "Service.Status" --output text)
        echo "  Status: $STATUS"
        if [ "$STATUS" == "RUNNING" ]; then
            echo -e "${GREEN}✓ Deployment successful!${NC}"
            break
        elif [ "$STATUS" == "CREATE_FAILED" ] || [ "$STATUS" == "DELETE_FAILED" ]; then
            echo -e "${RED}✗ Deployment failed!${NC}"
            exit 1
        fi
        sleep 15
    done
fi

# Get API URL
API_URL=$(aws cloudformation describe-stacks --stack-name LogoQuizApi --query "Stacks[0].Outputs[?OutputKey=='ApiServiceUrl'].OutputValue" --output text)
echo ""
echo -e "${GREEN}API URL: $API_URL${NC}"
echo ""
echo "Test with: curl $API_URL/api/health"
