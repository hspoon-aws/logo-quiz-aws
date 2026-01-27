# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Logo Quiz AWS is a full-stack web application for guessing company logos. Built with React 18.2, NestJS 10.3, DynamoDB (AWS SDK v3), and TypeScript 5.3 in a monorepo structure.

## Common Commands

### Development
```bash
npm run start:dynamodb         # Start DynamoDB local via finch (port 8000)
npm run start:api              # Start backend dev server (port 3333) using tsx watch
npm run start:frontend         # Start frontend dev server (port 4200) using Vite
npm run seed:dynamodb          # Seed DynamoDB with initial levels and logos data
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
- Socket.io-client 4.7 for real-time game features
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
  - Space-insensitive answer validation
  - Final scoreboard with rankings

### Backend (apps/api)
- NestJS 10.3 modules: AuthModule, LevelModule, LogoModule, UserModule, GameModule
- Passport 0.7 with JWT/Bearer strategies for route protection
- DynamoDB via AWS SDK v3 (@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb)
- DynamoDBService (`apps/api/src/shared/service/dynamodb.service.ts`) - centralized database client
- Socket.io 4.7 for WebSocket support (game rooms, real-time battles)
- Winston 3.11 for logging with daily rotate file support

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
| `LogoQuiz-Users` | `email` (S) | - | - |
| `LogoQuiz-Levels` | `levelId` (S) | - | - |
| `LogoQuiz-Logos` | `logoId` (S) | - | `levelId-index` |
| `LogoQuiz-UserState` | `odUserId` (S) | - | - |
| `LogoQuiz-GameRooms` | `roomCode` (S) | - | - |
| `LogoQuiz-GameSessions` | `gameRoomId` (S) | `odSocketId` (S) | - |

## Test Credentials

Email: quiz@gmail.com | Password: testing
