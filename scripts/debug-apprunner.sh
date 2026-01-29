#!/bin/bash

echo "=== App Runner Debug ==="
echo ""

# Get service info
SERVICE_ARN=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='LogoQuiz-api'].ServiceArn" --output text 2>/dev/null)

if [ -z "$SERVICE_ARN" ] || [ "$SERVICE_ARN" == "None" ]; then
    echo "No App Runner service found with name 'LogoQuiz-api'"
    echo ""
    echo "Listing all services:"
    aws apprunner list-services --query "ServiceSummaryList[*].{Name:ServiceName,Status:Status,Arn:ServiceArn}" --output table
    exit 1
fi

echo "Service ARN: $SERVICE_ARN"
echo ""

# Get service details
echo "=== Service Status ==="
aws apprunner describe-service --service-arn "$SERVICE_ARN" --query "Service.{Status:Status,HealthCheck:HealthCheckConfiguration,ImageConfig:SourceConfiguration.ImageRepository.ImageConfiguration}" --output yaml

echo ""
echo "=== Recent Operations ==="
aws apprunner list-operations --service-arn "$SERVICE_ARN" --query "OperationSummaryList[0:3]" --output table

echo ""
echo "=== CloudWatch Logs ==="
echo "Check logs at:"
echo "  https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups"
echo ""
echo "Look for log group: /aws/apprunner/LogoQuiz-api/..."

echo ""
echo "=== Test Image Locally ==="
echo "To test the image locally, run:"
echo ""
echo "  # Pull from ECR"
echo "  aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 851725625065.dkr.ecr.us-east-1.amazonaws.com"
echo "  docker pull 851725625065.dkr.ecr.us-east-1.amazonaws.com/logoquiz-api:latest"
echo ""
echo "  # Run locally"
echo "  docker run -p 3333:3333 \\"
echo "    -e NODE_ENV=production \\"
echo "    -e AWS_REGION=us-east-1 \\"
echo "    -e APP_SALT=mysalt \\"
echo "    -e APP_SESSION_SECRET=mysecret \\"
echo "    -e DYNAMODB_TABLE_PREFIX=LogoQuiz \\"
echo "    851725625065.dkr.ecr.us-east-1.amazonaws.com/logoquiz-api:latest"
echo ""
echo "  # Then test health endpoint"
echo "  curl http://localhost:3333/api/health"
