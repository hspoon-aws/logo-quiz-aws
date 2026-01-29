#!/bin/bash
# Deploy API to AWS App Runner via ECR
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPO="logoquiz-api"

echo "==> Deploying API to AWS"
echo "    Account: $AWS_ACCOUNT"
echo "    Region: $AWS_REGION"
echo "    ECR Repo: $ECR_REPO"
echo ""

# Login to ECR
echo "==> Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
echo "==> Building Docker image..."
cd "$PROJECT_ROOT"
docker build -t $ECR_REPO:latest .

# Tag for ECR
echo "==> Tagging image for ECR..."
docker tag $ECR_REPO:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

# Push to ECR
echo "==> Pushing image to ECR..."
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

echo ""
echo "==> API image pushed successfully!"
echo "    App Runner will auto-deploy the new image."
echo ""
