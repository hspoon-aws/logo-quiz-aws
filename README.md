# Logo Quiz AWS Edition

An AWS services version of Logo Quiz. Test your knowledge of AWS service logos!

This is forked from Logo-quiz github. Thanks!

## Features

### Solo Mode
- Guess AWS service logos at your own pace
- Progress through multiple levels
- Track your completion progress

### Battle Mode (Multiplayer)
- Create or join game rooms with friends
- Real-time competitive logo guessing
- Live leaderboard during gameplay
- Configurable game settings (time limit, number of logos)
- Score penalties for wrong answers
- See answers revealed when other players solve

![demo gif](media/demo.gif)

**Note:** This project is still highly experimental. It was created as a personal introduction to React, Redux and NestJS. You may find some bad practices in the code.

Report bugs or feature requests by opening an [issue](https://github.com/hspoon-aws/logo-quiz-aws/issues).

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  React SPA  │  │    Redux    │  │   Socket.io Client      │  │
│  │   (Vite)    │──│    Store    │──│  (Real-time events)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP REST │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Backend                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   NestJS    │  │   Game      │  │   Socket.io Server      │  │
│  │    REST     │  │  Gateway    │──│  (WebSocket handlers)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DynamoDB                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Users    │  │   Levels    │  │         Logos           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Redux, Vite, SCSS |
| Backend | NestJS 10, TypeScript, Passport JWT |
| Real-time | Socket.io 4.7 (WebSocket) |
| Database | DynamoDB (AWS SDK v3) |
| Auth | Firebase Authentication |
| Container | Docker/Finch |

### Monorepo Structure

```
logo-quiz-aws/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── app/
│   │       │   ├── auth/       # Authentication module
│   │       │   ├── game/       # Battle mode WebSocket gateway
│   │       │   ├── level/      # Levels REST API
│   │       │   ├── logo/       # Logos REST API
│   │       │   └── user/       # Users REST API
│   │       └── shared/
│   │           ├── schema/     # DynamoDB entity definitions
│   │           └── service/    # Shared services (incl. DynamoDBService)
│   │
│   └── logo-quiz/              # React frontend
│       └── src/
│           ├── app/
│           │   └── views/
│           │       ├── Battle/         # Battle mode components
│           │       │   ├── BattleMenu/
│           │       │   ├── CreateRoom/
│           │       │   ├── JoinRoom/
│           │       │   ├── GameLobby/
│           │       │   ├── BattleGame/
│           │       │   └── Scoreboard/
│           │       ├── LevelList/      # Solo mode level selection
│           │       ├── LogoList/       # Logo grid view
│           │       └── LogoVerify/     # Solo mode guessing
│           ├── shared/
│           │   └── services/
│           │       └── socket.service.ts
│           └── store/
│               ├── gameRoom/   # Battle mode state
│               ├── level/      # Single level state
│               ├── levels/     # All levels state
│               └── logo/       # Current logo state
│
└── libs/
    └── models/                 # Shared TypeScript interfaces/DTOs
```

### Battle Mode Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Create  │────▶│  Lobby   │────▶│   Game   │────▶│Scoreboard│
│   Room   │     │ (Ready)  │     │ (Play)   │     │ (Results)│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      │                │                │                │
      ▼                ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────┐
│                    WebSocket Events                           │
├──────────────────────────────────────────────────────────────┤
│ room:create    │ room:ready     │ game:logo      │ game:end  │
│ room:join      │ room:state     │ game:answer    │           │
│ room:leave     │ game:start     │ game:score     │           │
│                │                │ game:timer     │           │
│                │                │ game:revealed  │           │
└──────────────────────────────────────────────────────────────┘
```

### WebSocket Events

#### Client → Server
| Event | Description |
|-------|-------------|
| `room:create` | Create a new game room |
| `room:join` | Join existing room by code |
| `room:leave` | Leave current room |
| `room:ready` | Toggle ready status |
| `game:start` | Host starts the game |
| `game:answer` | Submit answer guess |

#### Server → Client
| Event | Description |
|-------|-------------|
| `room:created` | Room created confirmation |
| `room:joined` | Successfully joined room |
| `room:state` | Room state update (players, ready status) |
| `room:cancelled` | Room was cancelled |
| `game:started` | Game has begun |
| `game:logo` | New logo to guess |
| `game:answer-result` | Answer validation result |
| `game:score` | Leaderboard update |
| `game:timer` | Time remaining |
| `game:answer-revealed` | Someone solved - show answer |
| `game:end` | Game finished with final scores |

### Scoring System

| Action | Points |
|--------|--------|
| Correct answer | +100 to +10 (based on time) |
| Wrong answer | -100 |
| Minimum score | 0 |

Score calculation: `points = max(10, 100 - (timeTaken / totalTime) * 90)`

### Answer Validation

- Case-insensitive comparison
- Space-insensitive (e.g., "GROUNDSTATION" matches "Ground Station")
- Supports multi-word answers with visual spaces in UI

## Contribute

You'll need Docker or Finch to run the local DynamoDB instance. Then run the following commands.

1. Start DynamoDB local
```bash
npm run start:dynamodb
# Or manually: finch run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local
```

2. Seed the database (first time only)
```bash
npm run seed:dynamodb
```

3. Update AWS icons (optional - downloads latest from AWS)
```bash
npm run update:icons
```

4. Run backend
```bash
npm run start:api
```
The backend will run on port 3333

5. Run frontend
```bash
npm run start:frontend
```
The frontend will run on port 4200

### AWS Icons

The logo images are sourced from the official [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) package. To update to the latest icons:

```bash
npm run update:icons           # Check and download if newer version available
npm run update:icons:force     # Force re-download
npm run refresh:icons          # Update icons AND reseed the database
```

## Resources

1. Obfuscate & Randomize: https://repl.it/@caroso1222/obfuscate-randomize
2. Mock credentials. Email: quiz@gmail.com. Pwd: testing
