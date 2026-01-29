# Battle Mode Documentation

## Overview

Battle Mode is a real-time multiplayer feature where players compete to guess obfuscated company logos within a time limit. Players earn points for correct answers, with speed bonuses for faster responses.

## Architecture

### Local Development (Socket.io)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  Views:                    Redux Store:       Socket Service:    │
│  - BattleMenu              - gameRoom/        - connect()        │
│  - CreateRoom                - state          - emit events      │
│  - JoinRoom                  - actions        - listen events    │
│  - GameLobby                 - reducers                          │
│  - BattleGame                                                    │
│  - Scoreboard                                                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ WebSocket (Socket.io)
                                │ Namespace: /game
┌───────────────────────────────┴─────────────────────────────────┐
│                         Backend (NestJS)                         │
├─────────────────────────────────────────────────────────────────┤
│  GameGateway               Services:           Schemas:          │
│  - room:create             - GameRoomService   - GameRoom        │
│  - room:join               - GameSessionService- GameSession     │
│  - room:leave              - GameTimerService                    │
│  - room:ready              - LogoService                         │
│  - game:start                                                    │
│  - game:answer                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Production (AWS API Gateway WebSocket API)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  Socket Service detects environment.webSocketUrl and uses       │
│  native WebSocket instead of Socket.io                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ WebSocket (native)
                                │ wss://xxx.execute-api.region.amazonaws.com/prod
┌───────────────────────────────┴─────────────────────────────────┐
│               AWS API Gateway (WebSocket API)                    │
├─────────────────────────────────────────────────────────────────┤
│  Routes:                                                         │
│  - $connect    → Lambda handler                                  │
│  - $disconnect → Lambda handler                                  │
│  - $default    → Lambda handler (all game events)               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────┐
│                   Lambda Function                                │
├─────────────────────────────────────────────────────────────────┤
│  Single handler processes all events:                           │
│  - room:create, room:join, room:leave, room:ready              │
│  - game:start, game:answer                                      │
│  - Uses @aws-sdk/client-apigatewaymanagementapi to send msgs   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                           DynamoDB
```

**Key differences in production:**
- Client-side timer (Lambda can't send periodic updates)
- Single Lambda handles all WebSocket routes
- Uses API Gateway Management API to send messages to connections

## Game Flow

### Phase 1: Room Creation
1. Host navigates to `/battle/create`
2. Fills form: display name, time limit (60-300s), logo count (5-20), max players (2-8)
3. Clicks "Create Room"
4. System generates unique 6-character room code
5. Host is redirected to lobby

### Phase 2: Player Joining
1. Players navigate to `/battle/join`
2. Enter display name and room code
3. Click "Join Room"
4. Redirected to lobby if room exists and has space

### Phase 3: Ready Up
1. Non-host players see "Ready" button
2. Players click "Ready" to signal readiness
3. Host sees all player statuses
4. "Start Game" enables when all players ready

### Phase 4: Gameplay
1. Host clicks "Start Game"
2. Random logos selected from database
3. Timer starts counting down
4. Players see obfuscated logo image
5. Scrambled letters displayed as clickable tiles
6. Players build guess by clicking letters
7. Auto-submits when all slots filled
8. Correct answer: points awarded, next logo shown
9. Wrong answer: feedback shown, can retry

### Phase 5: Game End
1. Timer expires OR all logos guessed
2. Final scoreboard displayed
3. Rankings with medals for top 3
4. Option to play again or return home

## Scoring System

- **Base Points**: 100 points per correct answer
- **Speed Bonus**: Up to 50 additional points
- **Formula**: `100 + floor(50 * (1 - timeTaken/totalGameTime))`
- **Example**:
  - Answer in 1s of 120s game = 150 points (max)
  - Answer in 60s of 120s game = 125 points
  - Answer at end = 100 points (minimum)

## WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `room:create` | `{displayName, settings?}` | Create new room |
| `room:join` | `{roomCode, displayName}` | Join existing room |
| `room:leave` | - | Leave current room |
| `room:ready` | `{isReady: boolean}` | Set ready status |
| `game:start` | - | Start game (host only) |
| `game:answer` | `{logoId, guess}` | Submit answer |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room:created` | `{roomCode, state}` | Room created |
| `room:state` | `RoomStateDto` | State update |
| `room:cancelled` | `{reason}` | Room cancelled |
| `game:started` | `{totalLogos, timeLimit}` | Game started |
| `game:logo` | `GameLogoDto` | New logo to guess |
| `game:answer-result` | `AnswerResultDto` | Answer feedback |
| `game:score-update` | `{leaderboard}` | Leaderboard update |
| `game:timer` | `{timeRemaining}` | Timer tick |
| `game:end` | `FinalScoreboardDto` | Final results |

## Data Models

### GameRoom (DynamoDB: LogoQuiz-GameRooms)

| Attribute | Type | Description |
|-----------|------|-------------|
| `roomCode` | String (PK) | Unique 6-character room code |
| `hostSocketId` | String | WebSocket connection ID of host |
| `hostDisplayName` | String | Display name of host |
| `players` | List | Array of player objects |
| `playerSocketIds` | List | Array of player connection IDs |
| `settings` | Map | Game configuration |
| `status` | String | waiting / starting / in_progress / completed / cancelled |
| `logoIds` | List | Selected logo IDs for the game |
| `logos` | List | Full logo objects (cached for Lambda) |
| `currentLogoIndex` | Number | Current logo being played |
| `logoSentAt` | Number | Timestamp when current logo was sent (for speed bonus) |
| `scores` | Map | Player scores by connection ID |
| `createdAt` | String | ISO timestamp |

```typescript
// Player object within players array
{
  displayName: string,
  isReady: boolean,
  isHost: boolean
}

// Settings object
{
  timeLimit: number,       // 60-300 seconds
  maxPlayers: number,      // 2-100 (default: 100)
  minPlayers: number,      // Default: 2
  logoCount: number        // 5-20 (default: 10)
}
```

### GameSession (DynamoDB: LogoQuiz-GameSessions)

| Attribute | Type | Description |
|-----------|------|-------------|
| `roomCode` | String (PK) | Room code reference |
| `socketId` | String (SK) | WebSocket connection ID |
| `displayName` | String | Player display name |
| `score` | Number | Current score |
| `correctAnswers` | Number | Count of correct answers |
| `finalRank` | Number | Final ranking (set at game end) |
| `answers` | List | Array of answer objects |

```typescript
// Answer object within answers array
{
  logoId: string,
  correct: boolean,
  timeTaken: number,       // Milliseconds
  points: number,
  answeredAt: string       // ISO timestamp
}
```

## Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/battle` | BattleMenu | Main menu |
| `/battle/create` | CreateRoom | Create room form |
| `/battle/join` | JoinRoom | Join room form |
| `/battle/lobby/:roomCode` | GameLobby | Waiting room |
| `/battle/game` | BattleGame | Active game |
| `/battle/scoreboard` | Scoreboard | Final results |

## Redux State

```typescript
GameRoomState {
  // Connection
  isConnected: boolean,
  isConnecting: boolean,
  connectionError: string | null,

  // Room
  roomCode: string | null,
  roomState: RoomStateDto | null,
  phase: 'disconnected' | 'connected' | 'lobby' | 'playing' | 'ended',
  isHost: boolean,
  displayName: string | null,

  // Game
  currentLogo: GameLogoDto | null,
  guess: QuizLetter[],       // Current guess
  options: QuizLetter[],     // Available letters
  timeRemaining: number,
  totalTime: number,
  leaderboard: PlayerScore[],

  // Answer
  isSubmitting: boolean,
  lastAnswerResult: AnswerResultDto | null,
  myScore: number,
  myCorrectAnswers: number,

  // Final
  finalScoreboard: FinalScoreboardDto | null
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Room not found | Error message, stay on join form |
| Room full | Error message, stay on join form |
| Host disconnects | All players notified, redirected to menu |
| Player disconnects | Removed from room, others continue |
| Socket connection lost | Error shown, reconnect attempted |
| Invalid room code | Error message on join |

## Security

1. **JWT Authentication**: Optional for guests, validated via WsJwtGuard
2. **Server-Side Validation**: All answers validated on server
3. **Room Isolation**: Players only receive events for their room
4. **Host Authority**: Only host can start game

## Configuration

### Game Settings Defaults
- Time Limit: 120 seconds
- Max Players: 8
- Min Players: 2
- Logo Count: 10
- Auto Start: false

### Room Code Generation
- 6 characters
- Uppercase letters and numbers
- Excludes confusing characters: 0, O, I, 1

## Known Limitations

1. No reconnection recovery for disconnected players
2. No pause functionality
3. No spectator mode
4. Single game per room (no rematch in same room)
5. All players see same logo simultaneously
6. Production uses client-side timer (Lambda can't send periodic updates)

## Production Deployment

### Infrastructure (CDK)
- WebSocket API Gateway with Lambda integration
- Lambda function processes all game events
- DynamoDB tables for state persistence

### CDK Stack: `LogoQuizWebSocket`
Location: `infra/lib/stacks/websocket-stack.ts`

```bash
# Deploy WebSocket stack
cd infra
npm run deploy:websocket
```

### Environment Configuration
Frontend detects production mode via `environment.webSocketUrl`:
- If set: Uses native WebSocket to API Gateway
- If not set: Uses Socket.io to NestJS backend

```typescript
// apps/logo-quiz/src/environments/environment.prod.ts
export const environment: Environment = {
  production: true,
  apiUrl: 'https://xxx.awsapprunner.com/api',
  webSocketUrl: 'wss://xxx.execute-api.region.amazonaws.com/prod',
  // ...
};
```
