# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Logo Quiz AWS is a full-stack web application for guessing company logos. Built with React 18.2, NestJS 10.3, DynamoDB (AWS SDK v3), and TypeScript 5.3 in a monorepo structure.

## Common Commands

### Development
```bash
npm run start:dynamodb         # Start DynamoDB local via finch (port 8000)
npm run stop:dynamodb          # Stop DynamoDB local container
npm run start:api              # Start backend dev server (port 3333) using tsx watch
npm run start:frontend         # Start frontend dev server (port 4200) using Vite
npm run seed:dynamodb          # Seed DynamoDB with initial levels and logos data
npm run update:icons           # Download latest AWS icons (skips if current)
npm run update:icons:force     # Force re-download AWS icons
npm run refresh:icons          # Update icons AND reseed database
```

### Build
```bash
npm run build                  # Build both API and frontend (production)
npm run build:api              # Build backend (tsc + tsc-alias)
npm run build:frontend         # Build frontend (Vite)
```

### Test & Lint
```bash
npm run test                   # Run Jest tests
npm run lint                   # Run ESLint
npm run format                 # Auto-format with Prettier
```

### Docker/Finch (containers)
```bash
finch run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local  # DynamoDB local
docker compose up api          # API service
docker compose up web          # Frontend service
```

### AWS Infrastructure (CDK)
```bash
cd infra
npm install                    # Install CDK dependencies
npx cdk bootstrap              # First-time CDK setup
npm run deploy                 # Deploy all stacks
npm run deploy:db              # Deploy database stack only
npm run deploy:api             # Deploy API stack only
npm run deploy:frontend        # Deploy frontend stack only
npm run deploy:websocket       # Deploy WebSocket API Gateway stack
npm run synth                  # Synthesize CloudFormation templates
npm run diff                   # Compare deployed vs local changes
npm run destroy                # Destroy all stacks (careful!)
```

### Production Deployment
```bash
../scripts/deploy-api.sh       # Build and push API to ECR, trigger App Runner
../scripts/deploy-frontend.sh  # Build and sync frontend to S3, invalidate CloudFront
../scripts/seed-production.sh  # Seed production DynamoDB tables
```

## Architecture

### Monorepo Structure
- **apps/logo-quiz/** - React SPA frontend with Redux state management
- **apps/api/** - NestJS REST API backend with WebSocket support
- **apps/logo-quiz-e2e/** - Cypress E2E tests
- **libs/models/** - Shared TypeScript DTOs/interfaces used by both frontend and backend

### Frontend (apps/logo-quiz)
- React 18.2 with TypeScript, built with Vite 5
- Redux 5 / react-redux 9 with thunk middleware (slices: auth, level, levels, logo, system, gameRoom)
- React Router 6.21 for routing
- Views: Login, SignUp, LevelList, LogoList, LogoVerify, LogOut, Battle (BattleMenu, CreateRoom, JoinRoom, GameLobby, BattleGame, Scoreboard)
- Firebase 10.7 for authentication
- **Dual-mode WebSocket**: SocketService (`shared/services/socket.service.ts`) uses Socket.io for local dev, native WebSocket for production
- SCSS for styling

### Game Modes

#### Solo Mode
- Single player logo guessing game
- Progress through levels (Level 1, 2, 3)
- Each level contains 30 AWS service logos
- Levels unlock based on completed logos

#### Battle Mode (Multiplayer)
- Real-time multiplayer logo guessing competition
- Create or join game rooms with room codes
- Configurable settings: time limit (60-300s), number of logos (5-20)
- Up to 100 players per room
- Features:
  - Live leaderboard during gameplay
  - Score animation (+/- points) on answers
  - Answer reveal to all players when someone solves
  - Wrong answer penalty (-100 points)
  - Speed bonus: +100 base points + up to +50 bonus for fast answers
  - Space-insensitive answer validation
  - Final scoreboard with rankings

### Backend (apps/api)
- NestJS 10.3 modules: AuthModule, LevelModule, LogoModule, UserModule, GameModule, HealthModule
- Passport 0.7 with JWT/Bearer strategies for route protection
- DynamoDB via AWS SDK v3 (@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb)
- DynamoDBService (`apps/api/src/shared/service/dynamodb.service.ts`) - centralized database client
- Socket.io 4.7 for WebSocket support (local development only)
- Winston 3.11 for logging with daily rotate file support

### Production Architecture

```
CloudFront Distribution ─────────> S3 Bucket (React SPA)
        │
        └─────────────────────────> App Runner (NestJS REST API)
                                          │
                                     DynamoDB Tables

WebSocket API Gateway ──────────> Lambda (Battle Mode game logic)
                                          │
                                     DynamoDB Tables
```

**Key difference**: Production uses AWS API Gateway WebSocket API + Lambda for Battle Mode instead of Socket.io. This enables serverless WebSocket handling without persistent connections to App Runner.

- **REST API**: App Runner serves NestJS for auth, levels, logos, user state
- **WebSocket API**: API Gateway + Lambda handles real-time Battle Mode
- **Database**: DynamoDB tables shared between REST API and Lambda

### Path Aliases (tsconfig.json)
- `@logo-quiz/models` - Shared models library
- `@logo-quiz/environment` - Frontend environment config
- `@logo-quiz/store` - Frontend Redux store
- `@api/environment` - Backend environment config
- `@api/config` - Backend configuration

## Environment Configuration

Backend config (`apps/api/src/config.ts`) reads from `apps/api/.env`:
- `NODE_ENV` - development/production
- `AWS_REGION` - AWS region (default: us-east-1)
- `DYNAMODB_ENDPOINT` - DynamoDB endpoint (local: http://localhost:8000)
- `APP_SALT`, `APP_SESSION_SECRET` - Authentication secrets

Frontend environments in `apps/logo-quiz/src/environments/`

## DynamoDB Tables

| Table | Partition Key | Sort Key | GSI |
|-------|--------------|----------|-----|
| `LogoQuiz-Users` | `userId` (S) | - | `email-index` |
| `LogoQuiz-Levels` | `levelId` (S) | - | - |
| `LogoQuiz-Logos` | `logoId` (S) | - | `levelId-index` |
| `LogoQuiz-UserState` | `stateId` (S) | - | `userId-index` |
| `LogoQuiz-GameRooms` | `roomCode` (S) | - | - |
| `LogoQuiz-GameSessions` | `roomCode` (S) | `socketId` (S) | - |

## AWS Icons

The logo images are sourced from the official [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) package.

### Updating Icons
```bash
npm run update:icons           # Check and download latest version
npm run update:icons:force     # Force re-download even if current
npm run refresh:icons          # Update icons AND reseed database
```

The script:
1. Fetches the AWS icons page to find the latest Asset Package URL
2. Compares versions (stored in `.version` file)
3. Downloads and extracts `Architecture-Service-Icons` folder
4. Icons are stored in `apps/logo-quiz/public/assets/Architecture-Service-Icons/`

### Scripts
- `scripts/update-aws-icons.ts` - Node.js script for programmatic use
- `scripts/update-aws-icons.sh` - Bash script for CI/CD pipelines

## Deployed URLs (Production)

| Service | URL |
|---------|-----|
| Frontend | https://d1ph47sejrykr7.cloudfront.net |
| REST API | https://hxhjbyvimw.us-east-1.awsapprunner.com/api |
| WebSocket | wss://ehv67k1and.execute-api.us-east-1.amazonaws.com/prod |

## Test Credentials

Email: quiz@gmail.com | Password: testing
