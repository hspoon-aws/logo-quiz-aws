# Agentic Coding: Building a Multiplayer Game on AWS with Claude Code

*A developer's experience using agentic coding to add real-time multiplayer and migrate to serverless AWS infrastructure*

*By [Your Name], [Title] | Published: [Date]*

> *The views expressed in this post are my own. Cost estimates are based on my specific usage patterns and may vary.*

---

## Introduction: What is Agentic Coding?

Agentic coding is a development style where you communicate high-level intent to an AI coding agent, and the agent autonomously handles the implementation details. Instead of writing every line yourself, you describe what you want to achieve, review the agent's approach, and iterate through feedback.

I decided to try this approach with Claude Code on a hobby project: a logo guessing game that needed two major upgrades:
1. **Battle Mode**: Real-time multiplayer competition
2. **AWS Migration**: Production-ready, cost-optimized cloud infrastructure

This post documents my experience—what worked well, what was challenging, and the metrics behind the collaboration.

---

## The Starting Point

The original codebase (master branch) was a functional but local-only application:

- **Frontend**: React 18 SPA with Redux state management
- **Backend**: NestJS REST API
- **Database**: MongoDB
- **Deployment**: Docker Compose for local development
- **Game Mode**: Solo only—players guess AWS Architecture Icons individually

The app worked, but it couldn't be shared with others and had no competitive element.

---

## The Vision

I wanted to transform this into a production-ready multiplayer game:

### Battle Mode
- Real-time multiplayer competition with room codes
- Live leaderboard during gameplay
- Speed bonuses for fast answers
- Wrong answer penalties
- Support for up to 100 players per room

### AWS Architecture Goals
- Serverless where possible (pay-per-use)
- Well-Architected patterns
- Minimal operational overhead
- Cost-effective for a hobby project

---

## Timeline & Milestones

| Phase | Milestone | Key Changes |
|-------|-----------|-------------|
| 1 | Battle Mode v1 | WebSocket game loop, room management, scoring |
| 2 | Scoring refinements | Wrong answer penalty (-100), speed bonus (+50 max) |
| 3 | MongoDB to Amazon DynamoDB | Migrated 7 services, new table design |
| 4 | AWS Infrastructure | CDK stacks for DB, API, Frontend, WebSocket |
| 5 | Production deployment | AWS App Runner, Amazon CloudFront, Amazon API Gateway |
| 6 | Bug fixes & polish | WebSocket dual-mode, payload fixes |
| 7 | Documentation | README, CLAUDE.md, BATTLE_MODE.md updates |

---

## Architecture Deep Dive

### Before (Master Branch)

```
Docker Compose (Local Only)
├── MongoDB container
├── NestJS API container
└── React dev server (Vite)
```

### After (Dev Branch)

```
                    ┌─────────────────────────┐
                    │    Amazon CloudFront    │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
       ┌───────────┐    ┌─────────────┐    ┌────────────────┐
       │ Amazon S3 │    │ AWS App     │    │ Amazon API     │
       │ (React)   │    │ Runner      │    │ Gateway        │
       └───────────┘    │ (REST API)  │    │ (WebSocket)    │
                        └──────┬──────┘    └───────┬────────┘
                               │                   │
                               │                   ▼
                               │           ┌─────────────┐
                               │           │ AWS Lambda  │
                               │           │ (Game)      │
                               │           └──────┬──────┘
                               │                  │
                               └────────┬─────────┘
                                        ▼
                               ┌─────────────────┐
                               │ Amazon DynamoDB │
                               │   (6 tables)    │
                               └─────────────────┘
```

> **Note**: For production use, consider creating this diagram using [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) for a more professional presentation.

### The Dual-Mode WebSocket Pattern

A key architectural decision was supporting both Socket.io (local development) and AWS API Gateway WebSocket (production) with a single codebase.

The `SocketService` detects the environment and uses the appropriate transport:

```typescript
// apps/logo-quiz/src/shared/services/socket.service.ts
// Note: Simplified for readability; production code uses proper Socket.io types

class SocketService {
  private socket: any = null;        // Socket.io client (typed in actual code)
  private ws: WebSocket | null = null; // Native WebSocket

  private get useNativeWebSocket(): boolean {
    return !!environment.webSocketUrl;
  }

  connect(): Promise<void> {
    if (this.useNativeWebSocket) {
      return this.connectNativeWebSocket();
    } else {
      return this.connectSocketIO();
    }
  }

  private connectNativeWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = environment.webSocketUrl!;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(new Error('WebSocket connection failed'));
      this.ws.onmessage = (event) => this.handleWebSocketMessage(event.data);
    });
  }

  private connectSocketIO(): Promise<void> {
    return new Promise((resolve, reject) => {
      const apiUrl = environment.apiUrl.replace('/api', '');
      this.socket = io(`${apiUrl}/game`, {
        transports: ['websocket'],
      });

      this.socket.on('connect', () => resolve());
      this.socket.on('connect_error', (error: Error) => reject(error));
    });
  }
}
```

**Why this pattern?**
- Socket.io provides excellent DX locally (auto-reconnection, debugging)
- [Amazon API Gateway WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html) are serverless and cost-effective in production
- The abstraction keeps game logic unchanged across environments

### Amazon DynamoDB Table Design

Migrating from MongoDB required rethinking the data model for [Amazon DynamoDB's](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html) key-value paradigm:

| Table | Partition Key | Sort Key | Purpose |
|-------|--------------|----------|---------|
| `LogoQuiz-Users` | `userId` | - | User accounts |
| `LogoQuiz-Levels` | `levelId` | - | Game levels |
| `LogoQuiz-Logos` | `logoId` | - | Logo data |
| `LogoQuiz-UserState` | `stateId` | - | Player progress |
| `LogoQuiz-GameRooms` | `roomCode` | - | Battle Mode rooms |
| `LogoQuiz-GameSessions` | `roomCode` | `socketId` | Player sessions |

The `GameSessions` table uses a composite key to efficiently query all players in a room while maintaining per-player state.

### AWS CDK Infrastructure as Code

All infrastructure is defined using [AWS Cloud Development Kit (CDK)](https://docs.aws.amazon.com/cdk/v2/guide/home.html) in TypeScript. Here's the WebSocket stack that creates the serverless Battle Mode backend:

```typescript
// infra/lib/stacks/websocket-stack.ts (excerpt)

export class WebSocketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebSocketStackProps) {
    super(scope, id, props);

    // WebSocket API with route selection based on action field
    this.webSocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: `${prefix}-websocket`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    // Lambda handles all game logic
    const defaultHandler = new lambda.Function(this, 'DefaultHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      // ... game logic inline
    });

    // Three routes: $connect, $disconnect, $default
    // All game events flow through $default
  }
}
```

---

## The AI Collaboration Experience

### The Workflow Pattern

My typical collaboration loop with Claude Code:

1. **Intent Communication**: Describe the high-level goal
   - "Add multiplayer battle mode with room codes"
   - "Migrate from MongoDB to DynamoDB"

2. **AI Planning**: Claude explores the codebase and proposes architecture
   - Reads existing code to understand patterns
   - Suggests file structure and data flow
   - Identifies potential issues early

3. **Human Review**: Approve or modify the plan before execution
   - Catch architectural misalignments early
   - Add constraints or preferences

4. **AI Implementation**: Code generation and refactoring
   - Creates new files following existing conventions
   - Updates imports and dependencies
   - Handles boilerplate and repetitive changes

5. **Testing & Feedback**: Run the app, report issues, iterate
   - "Getting this error when I click Start Game"
   - "The leaderboard isn't updating"

6. **Production Deployment**: AI handles deployment scripts
   - CDK deploy commands
   - Environment configuration
   - Troubleshooting deployment issues

### What Worked Well

**Rapid Prototyping**: Battle Mode went from concept to working code in hours. The full game loop—room creation, player joining, real-time gameplay, scoring, and scoreboard—was implemented iteratively through conversation.

**Database Migration**: Translating MongoDB queries to Amazon DynamoDB patterns is tedious work. Claude handled the mechanical translation while I focused on validating the data model.

**Infrastructure as Code**: The AWS CDK stacks were generated with best practices—IAM least-privilege, proper log retention, environment variables. I would have spent significant time researching these patterns myself.

**Real-time Debugging**: When production errors occurred, the feedback loop was fast:
- Me: "Getting 'Cannot read properties of undefined' in the scoreboard"
- Claude: Identified that the API Gateway returns a different payload structure than Socket.io
- Fixed the response handling and deployed within minutes

**Documentation as Byproduct**: Claude naturally documented decisions as it worked. The BATTLE_MODE.md file was generated during implementation, not as an afterthought.

### Example Collaboration Loops

**Loop 1: Feature Development**
```
Me: "Add multiplayer battle mode with room codes"

Claude: [Explored codebase structure]
        [Proposed WebSocket architecture with Socket.io]
        [Created Redux slice for game state]
        [Implemented 6 new views: BattleMenu, CreateRoom, JoinRoom,
         GameLobby, BattleGame, Scoreboard]
        [Added NestJS Gateway for WebSocket events]

Result: Working Battle Mode with lobby, gameplay, and scoreboard
```

**Loop 2: Bug Fix**
```
Me: "Getting 'right-hand side of in should be an object' error"

Claude: [Identified null check missing in WebSocket response handling]
        [The production API Gateway returns {action, ...data} directly
         while development Socket.io wraps it differently]
        [Added defensive checks in event handlers]

Result: Fixed and deployed in minutes
```

**Loop 3: Architecture Decision**
```
Me: "How should we handle WebSocket in production?"

Claude: [Analyzed options]
        Option A: Socket.io on AWS App Runner (persistent connections, $$$)
        Option B: Amazon API Gateway + AWS Lambda (serverless, pay-per-message)

        [Proposed dual-mode pattern]
        - Socket.io locally for fast iteration
        - API Gateway in production for cost efficiency
        - Single codebase with environment detection

Result: Cost-effective serverless WebSocket in production
```

### Challenges & Learnings

**Payload Mismatches**: Production returned different response formats than development. This highlighted the importance of integration testing, not just unit tests.

**Context Window Management**: Very long sessions benefited from periodic summaries. Starting fresh sessions with a clear CLAUDE.md file (a project-specific instruction file that helps the AI understand your codebase conventions) helped maintain context.

**Knowing When to Intervene**: Sometimes Claude would head down a path that wouldn't work. Learning when to redirect vs. let it explore was a skill developed over time.

**Client-Side Timer Tradeoff**: AWS Lambda can't send periodic WebSocket messages (no background threads), so the game timer runs client-side in production. This was an acceptable tradeoff for serverless simplicity.

---

## By The Numbers

| Metric | Value |
|--------|-------|
| Claude API interaction time | 5h 7m |
| Wall clock time | ~1.5 days |
| TypeScript files changed | 66 |
| Lines added | 4,453 |
| Lines removed | 439 |
| Claude API cost | $117.76 |
| Estimated monthly AWS cost | $6-20 |

### Cost Analysis

**One-time AI development cost**: $118
- This covered feature development, database migration, infrastructure setup, debugging, and documentation

**Ongoing infrastructure cost**: $6-20/month
- Amazon DynamoDB: Pay-per-request pricing (~$0-5 depending on usage)
- AWS App Runner: $5 minimum + compute time
- Amazon API Gateway: $1 per million WebSocket messages
- Amazon CloudFront + Amazon S3: Pennies for static hosting

**Compared to manual development**: Estimating 2-4 weeks of part-time work for the same scope, the AI-assisted approach was significantly faster for the monetary cost.

### Why Claude Code on Amazon Bedrock?

For this project, I used Claude Code connected to Amazon Bedrock rather than a traditional per-seat subscription. This approach offers several advantages for testing and experimentation:

**Pay-per-use vs. license commitment**
- No upfront commitment or minimum term
- Pay only for actual API usage ($117.76 for this entire project)
- Perfect for exploratory projects where usage is unpredictable

**Enterprise-friendly for POCs**
- Use existing AWS billing—no separate vendor contracts
- AWS credits can offset experimentation costs
- Easier procurement for "let's try this" scenarios

**Cost predictability for testing**
- Set AWS budget alerts to cap spending
- Full visibility through AWS Cost Explorer
- Stop anytime without wasting a subscription period

For teams evaluating AI-assisted development, [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html) provides a low-risk entry point. You can run a proof-of-concept like this one, measure actual costs, and make data-driven decisions about longer-term tooling investments.

**Getting started**: To use Claude Code with Amazon Bedrock, configure the `ANTHROPIC_MODEL` environment variable with your Bedrock model ID and ensure your AWS credentials have `bedrock:InvokeModel` permissions. See the [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for detailed setup instructions.

---

## AWS Well-Architected Assessment

Brief notes on how the architecture addresses the [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/) five pillars:

### Security
- Environment variables managed through AWS App Runner configuration (consider [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) for sensitive credentials)
- IAM roles scoped to specific DynamoDB tables and API Gateway management
- Amazon CloudFront Origin Access Identity restricts Amazon S3 access
- No hardcoded credentials in code or configs

### Reliability
- Amazon DynamoDB with on-demand capacity (Point-in-Time Recovery recommended for production)
- Health checks on AWS App Runner
- TTL on game session data for automatic cleanup

### Performance Efficiency
- Amazon CloudFront for global static asset delivery
- Amazon DynamoDB GSIs for efficient queries
- AWS Lambda cold starts acceptable for game use case

### Cost Optimization
- Pay-per-request Amazon DynamoDB (no provisioned capacity)
- Serverless WebSocket via Amazon API Gateway (no idle servers)
- AWS App Runner automatically scales based on traffic (minimum instance charge applies)

### Operational Excellence
- All infrastructure as code (AWS CDK)
- Deployment scripts for repeatable deployments
- Amazon CloudWatch logs with retention policies

---

## Key Takeaways

1. **AI accelerates the "boring" parts**—boilerplate, migrations, infrastructure setup, and documentation. These are areas where Claude excels because the patterns are well-established.

2. **Human judgment remains critical**—architecture decisions, trade-off analysis, and debugging strategy still require human insight. AI proposes; human disposes.

3. **Iterative collaboration works**—describe intent, review output, refine. Small feedback loops catch issues early.

4. **Documentation is a byproduct**—when AI documents as it implements, you end up with accurate documentation that reflects the actual code.

5. **Real production requires real testing**—AI can't catch all runtime issues. Integration testing and production monitoring remain essential.

---

## What's Next?

Future improvements planned for the project:

- **CI/CD Pipeline**: GitHub Actions for automated testing and deployment
- **Enhanced Monitoring**: Amazon CloudWatch dashboards for game metrics
- **WebSocket Authentication**: JWT validation on connection
- **Mobile-Responsive UI**: Better experience on smaller screens
- **Reconnection Handling**: Allow players to rejoin if disconnected

---

## Try It Yourself

**Live Demo**: https://d1ph47sejrykr7.cloudfront.net

**GitHub Repository**: 
- Original: https://github.com/hspoon-aws/logo-quiz-aws/tree/master
- After AI-coded MultiplePlayer Mode: https://github.com/hspoon-aws/logo-quiz-aws/tree/dev


**How to Play Battle Mode**:
1. Click "Battle Mode" on the home screen
2. Create a room and share the code with friends
3. Once everyone is ready, the host starts the game
4. Guess AWS service logos faster than your opponents
5. First to answer gets speed bonus points!

---

## Conclusion

Agentic coding with Claude Code proved effective for this project. The combination of AI-generated code with human oversight produced a working multiplayer game on AWS infrastructure in a fraction of the time manual development would have taken.

The approach isn't magic—you still need to understand the systems you're building, catch AI mistakes, and make architectural decisions. But for a developer comfortable with the technologies, AI assistance significantly accelerates implementation while maintaining code quality.

The $118 spent on AI assistance delivered real-time multiplayer, a serverless AWS backend, and production deployment—a worthwhile investment for a hobby project that's now live and shareable.

---

*Built with Claude Code on Amazon Bedrock. Deployed on AWS. Played by friends.*
