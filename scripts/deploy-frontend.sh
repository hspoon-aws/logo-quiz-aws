#!/bin/bash
# Deploy frontend to S3 and invalidate CloudFront cache
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration - these should match your CDK stack outputs
PREFIX=${STACK_PREFIX:-LogoQuiz}
AWS_REGION=${AWS_REGION:-us-east-1}

echo "==> Deploying frontend to AWS"
echo ""

# Get stack outputs
echo "==> Getting CloudFront stack outputs..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${PREFIX}Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketName'].OutputValue" \
  --output text \
  --region $AWS_REGION)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name ${PREFIX}Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text \
  --region $AWS_REGION)

API_URL=$(aws cloudformation describe-stacks \
  --stack-name ${PREFIX}Api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiServiceUrl'].OutputValue" \
  --output text \
  --region $AWS_REGION)

if [ -z "$BUCKET_NAME" ] || [ -z "$DISTRIBUTION_ID" ]; then
  echo "ERROR: Could not get stack outputs. Make sure CDK stacks are deployed."
  exit 1
fi

echo "    Bucket: $BUCKET_NAME"
echo "    Distribution: $DISTRIBUTION_ID"
echo "    API URL: $API_URL"
echo ""

# Note: environment.prod.ts should be configured manually with:
# - apiUrl, webSocketUrl, firebase config
# The deploy script no longer overwrites this file to preserve all settings.

# Build frontend
echo "==> Building frontend..."
cd "$PROJECT_ROOT"
npm run build:frontend

# Sync to S3
echo "==> Syncing to S3..."

# Sync non-icon files first
aws s3 sync dist/apps/logo-quiz s3://$BUCKET_NAME \
  --delete \
  --region $AWS_REGION \
  --exclude "assets/Architecture-Service-Icons/*"

# Sync only required icon files (64px PNG, not @5x or SVG)
# This reduces ~2800 files to ~300 files
echo "==> Syncing icon files (64px PNG only)..."
aws s3 sync dist/apps/logo-quiz/assets/Architecture-Service-Icons s3://$BUCKET_NAME/assets/Architecture-Service-Icons \
  --delete \
  --region $AWS_REGION \
  --exclude "*" \
  --include "*/64/*_64.png" \
  --exclude "*@5x*"

# Invalidate CloudFront cache
echo "==> Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --region $AWS_REGION

echo ""
echo "==> Frontend deployed successfully!"
echo ""
DISTRIBUTION_URL=$(aws cloudformation describe-stacks \
  --stack-name ${PREFIX}Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionUrl'].OutputValue" \
  --output text \
  --region $AWS_REGION)
echo "    URL: $DISTRIBUTION_URL"
echo ""
