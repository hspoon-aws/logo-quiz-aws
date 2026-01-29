# Logo Quiz AWS Infrastructure

AWS CDK infrastructure for deploying Logo Quiz to AWS.

## Architecture

```
                    CloudFront Distribution
                           |
          +----------------+----------------+
          |                                 |
     S3 Bucket                         App Runner
  (Static Frontend)                   (NestJS REST API)
                                           |
                                      DynamoDB
                                    (Pay-per-use)

        WebSocket API Gateway
               |
          Lambda Function ─────────────────┘
        (Battle Mode Logic)
```

- **REST API** (App Runner): Handles authentication, levels, logos, user state
- **WebSocket API** (API Gateway + Lambda): Handles real-time Battle Mode

## Stacks

| Stack | Resources |
|-------|-----------|
| `LogoQuizDatabase` | DynamoDB tables (Users, Levels, Logos, UserState, GameRooms, GameSessions) |
| `LogoQuizApi` | ECR Repository, App Runner Service, Secrets Manager, IAM Roles |
| `LogoQuizFrontend` | S3 Bucket, CloudFront Distribution |
| `LogoQuizWebSocket` | API Gateway WebSocket API, Lambda Function, IAM Roles |

## Prerequisites

1. AWS CLI configured with credentials
2. Node.js 20+
3. Docker (for building API image)

## Setup

```bash
cd infra
npm install
```

## Deploy

### First-time deployment

```bash
# 1. Bootstrap CDK (first time only)
npx cdk bootstrap

# 2. Deploy all stacks
npm run deploy

# 3. Update secrets in AWS Secrets Manager
#    Go to AWS Console > Secrets Manager > LogoQuiz/api-secrets
#    Update APP_SALT and APP_SESSION_SECRET with secure values

# 4. Seed the database
../scripts/seed-production.sh

# 5. Build and push API image
../scripts/deploy-api.sh

# 6. Deploy frontend
../scripts/deploy-frontend.sh
```

### Subsequent deployments

```bash
# API changes
../scripts/deploy-api.sh

# Frontend changes
../scripts/deploy-frontend.sh

# Infrastructure changes
npm run deploy
```

## Individual Stack Deployment

```bash
npm run deploy:db        # Database only
npm run deploy:api       # API only
npm run deploy:frontend  # Frontend only
```

## Useful Commands

```bash
npm run synth    # Synthesize CloudFormation templates
npm run diff     # Compare deployed stack with local
npm run destroy  # Destroy all stacks (careful!)
```

## Stack Outputs

After deployment, you can view outputs:

```bash
aws cloudformation describe-stacks --stack-name LogoQuizApi --query "Stacks[0].Outputs"
aws cloudformation describe-stacks --stack-name LogoQuizFrontend --query "Stacks[0].Outputs"
```

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| DynamoDB (on-demand) | ~$1-5 |
| App Runner (0.25 vCPU) | ~$5-15 |
| S3 | ~$0.02 |
| CloudFront | ~$0 (free tier) |
| **Total** | **~$6-20/month** |

## Environment Variables

The API uses these environment variables (set via CDK):

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | production |
| `AWS_REGION` | AWS region |
| `DYNAMODB_TABLE_PREFIX` | Table name prefix (LogoQuiz) |
| `APP_SALT` | Password hashing salt (from Secrets Manager) |
| `APP_SESSION_SECRET` | Session secret (from Secrets Manager) |

## WebSocket Stack Details

The `LogoQuizWebSocket` stack provides real-time Battle Mode functionality:

### Resources Created
- **API Gateway WebSocket API** with stage `prod`
- **Lambda Function** (Node.js 20) with inline code
- **IAM Role** with DynamoDB and API Gateway Management permissions

### WebSocket Routes
| Route | Description |
|-------|-------------|
| `$connect` | Client connects, stored in DynamoDB |
| `$disconnect` | Client disconnects, cleanup |
| `$default` | Handles all game events |

### Game Events (via $default route)
| Event | Description |
|-------|-------------|
| `room:create` | Create new game room |
| `room:join` | Join existing room by code |
| `room:leave` | Leave current room |
| `room:ready` | Toggle ready status |
| `game:start` | Host starts the game |
| `game:answer` | Submit logo guess |

### Deploy WebSocket Stack

```bash
npm run deploy:websocket
```

### WebSocket URL Format
```
wss://{api-id}.execute-api.{region}.amazonaws.com/prod
```

### Frontend Configuration
Update `apps/logo-quiz/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  webSocketUrl: 'wss://xxx.execute-api.us-east-1.amazonaws.com/prod',
  // ...
};
```

### Debugging
View Lambda logs in CloudWatch:
```bash
aws logs tail /aws/lambda/LogoQuizWebSocketHandler --follow
```
