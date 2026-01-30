import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { DatabaseTables } from './database-stack';
import * as path from 'path';

export interface WebSocketStackProps extends cdk.StackProps {
  prefix: string;
  tables: DatabaseTables;
}

export class WebSocketStack extends cdk.Stack {
  public readonly webSocketApi: apigatewayv2.CfnApi;
  public readonly webSocketUrl: string;

  constructor(scope: Construct, id: string, props: WebSocketStackProps) {
    super(scope, id, props);

    const { prefix, tables } = props;

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'WebSocketLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for WebSocket Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB access
    tables.gameRooms.grantReadWriteData(lambdaRole);
    tables.gameSessions.grantReadWriteData(lambdaRole);
    tables.logos.grantReadData(lambdaRole);

    // WebSocket API
    this.webSocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: `${prefix}-websocket`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    // Grant API Gateway management permissions to Lambda
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*`,
      ],
    }));

    // Common Lambda environment variables
    const lambdaEnv = {
      WEBSOCKET_API_ID: this.webSocketApi.ref,
      WEBSOCKET_STAGE: 'prod',
      AWS_REGION_NAME: this.region,
      TABLE_GAME_ROOMS: tables.gameRooms.tableName,
      TABLE_GAME_SESSIONS: tables.gameSessions.tableName,
      TABLE_LOGOS: tables.logos.tableName,
    };

    // Lambda layer for shared code (optional, inline for simplicity)
    const lambdaProps: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    };

    // $connect handler
    const connectHandler = new lambda.Function(this, 'ConnectHandler', {
      ...lambdaProps,
      functionName: `${prefix}-ws-connect`,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

        const client = new DynamoDBClient({});
        const ddb = DynamoDBDocumentClient.from(client);

        exports.handler = async (event) => {
          console.log('Connect:', event.requestContext.connectionId);

          // Store connection in GameSessions table temporarily
          await ddb.send(new PutCommand({
            TableName: process.env.TABLE_GAME_SESSIONS,
            Item: {
              roomCode: '__CONNECTIONS__',
              socketId: event.requestContext.connectionId,
              connectedAt: new Date().toISOString(),
              status: 'connected',
            },
          }));

          return { statusCode: 200, body: 'Connected' };
        };
      `),
    } as lambda.FunctionProps);

    // $disconnect handler
    const disconnectHandler = new lambda.Function(this, 'DisconnectHandler', {
      ...lambdaProps,
      functionName: `${prefix}-ws-disconnect`,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, DeleteCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
        const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

        const client = new DynamoDBClient({});
        const ddb = DynamoDBDocumentClient.from(client);

        exports.handler = async (event) => {
          const connectionId = event.requestContext.connectionId;
          console.log('Disconnect:', connectionId);

          // Remove from connections
          await ddb.send(new DeleteCommand({
            TableName: process.env.TABLE_GAME_SESSIONS,
            Key: { roomCode: '__CONNECTIONS__', socketId: connectionId },
          }));

          // Find and leave any room the user was in
          const rooms = await ddb.send(new ScanCommand({
            TableName: process.env.TABLE_GAME_ROOMS,
            FilterExpression: 'hostSocketId = :sid OR contains(playerSocketIds, :sid)',
            ExpressionAttributeValues: { ':sid': connectionId },
          }));

          for (const room of rooms.Items || []) {
            if (room.hostSocketId === connectionId) {
              // Host left - cancel the room
              await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                Key: { roomCode: room.roomCode },
                UpdateExpression: 'SET #status = :status',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':status': 'cancelled' },
              }));

              // Notify other players
              const apiClient = new ApiGatewayManagementApiClient({
                endpoint: \`https://\${process.env.WEBSOCKET_API_ID}.execute-api.\${process.env.AWS_REGION_NAME}.amazonaws.com/\${process.env.WEBSOCKET_STAGE}\`,
              });

              for (const playerId of room.playerSocketIds || []) {
                try {
                  await apiClient.send(new PostToConnectionCommand({
                    ConnectionId: playerId,
                    Data: JSON.stringify({ action: 'room:cancelled', reason: 'Host disconnected' }),
                  }));
                } catch (e) { console.log('Failed to notify:', playerId); }
              }
            }
          }

          return { statusCode: 200, body: 'Disconnected' };
        };
      `),
    } as lambda.FunctionProps);

    // $default handler (routes all game messages)
    const defaultHandler = new lambda.Function(this, 'DefaultHandler', {
      ...lambdaProps,
      functionName: `${prefix}-ws-default`,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
        const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

        const client = new DynamoDBClient({});
        const ddb = DynamoDBDocumentClient.from(client);

        let apiClient;
        const getApiClient = (event) => {
          if (!apiClient) {
            const domain = event.requestContext.domainName;
            const stage = event.requestContext.stage;
            apiClient = new ApiGatewayManagementApiClient({
              endpoint: \`https://\${domain}/\${stage}\`,
            });
          }
          return apiClient;
        };

        const sendToConnection = async (event, connectionId, data) => {
          try {
            await getApiClient(event).send(new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: JSON.stringify(data),
            }));
            return true;
          } catch (e) {
            console.log('Failed to send to', connectionId, e.message);
            return false;
          }
        };

        const broadcastToRoom = async (event, room, data, excludeConnectionId = null) => {
          const connections = [room.hostSocketId, ...(room.playerSocketIds || [])];
          for (const connId of connections) {
            if (connId && connId !== excludeConnectionId) {
              await sendToConnection(event, connId, data);
            }
          }
        };

        const generateRoomCode = () => {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = '';
          for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
          return code;
        };

        // Fisher-Yates shuffle for unbiased randomization
        const shuffle = (array) => {
          const result = [...array];
          for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
          }
          return result;
        };

        const getRoomState = (room) => ({
          roomCode: room.roomCode,
          hostDisplayName: room.hostDisplayName,
          players: (room.players || []).map(p => ({
            displayName: p.displayName,
            isReady: p.isReady,
            isHost: p.isHost || false,
          })),
          settings: room.settings,
          status: room.status,
          currentLogoIndex: room.currentLogoIndex || 0,
          totalLogos: room.logoIds?.length || room.settings?.logoCount || 10,
        });

        exports.handler = async (event) => {
          const connectionId = event.requestContext.connectionId;
          let body;

          try {
            body = JSON.parse(event.body);
          } catch (e) {
            return { statusCode: 400, body: 'Invalid JSON' };
          }

          const { action, data } = body;
          console.log('Action:', action, 'from:', connectionId);

          switch (action) {
            case 'room:create': {
              const { displayName, settings } = data || {};
              if (!displayName) {
                await sendToConnection(event, connectionId, { action: 'error', message: 'Display name required' });
                return { statusCode: 400, body: 'Display name required' };
              }

              let roomCode;
              let attempts = 0;
              do {
                roomCode = generateRoomCode();
                const existing = await ddb.send(new GetCommand({
                  TableName: process.env.TABLE_GAME_ROOMS,
                  Key: { roomCode },
                }));
                if (!existing.Item || existing.Item.status === 'cancelled' || existing.Item.status === 'completed') break;
                attempts++;
              } while (attempts < 10);

              const room = {
                roomCode,
                hostSocketId: connectionId,
                hostDisplayName: displayName,
                players: [{ displayName, isReady: true, isHost: true }], // Host is first player
                playerSocketIds: [],
                settings: { timeLimit: 120, logoCount: 10, maxPlayers: 100, minPlayers: 2, ...settings },
                status: 'waiting',
                logoIds: [],
                currentLogoIndex: 0,
                createdAt: new Date().toISOString(),
              };

              await ddb.send(new PutCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                Item: room,
              }));

              await sendToConnection(event, connectionId, {
                action: 'room:created',
                roomCode,
                state: getRoomState(room),
              });

              return { statusCode: 200, body: 'Room created' };
            }

            case 'room:join': {
              const { roomCode, displayName } = data || {};
              if (!roomCode || !displayName) {
                await sendToConnection(event, connectionId, { action: 'room:error', message: 'Room code and display name required' });
                return { statusCode: 400, body: 'Missing params' };
              }

              const result = await ddb.send(new GetCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                Key: { roomCode: roomCode.toUpperCase() },
              }));

              const room = result.Item;
              if (!room || room.status !== 'waiting') {
                await sendToConnection(event, connectionId, { action: 'room:error', message: 'Room not found or cannot join' });
                return { statusCode: 404, body: 'Room not found' };
              }

              // Add player
              room.players = room.players || [];
              room.playerSocketIds = room.playerSocketIds || [];
              room.players.push({ displayName, isReady: false, joinedAt: new Date().toISOString() });
              room.playerSocketIds.push(connectionId);

              await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                Key: { roomCode: room.roomCode },
                UpdateExpression: 'SET players = :players, playerSocketIds = :pids',
                ExpressionAttributeValues: {
                  ':players': room.players,
                  ':pids': room.playerSocketIds,
                },
              }));

              const state = getRoomState(room);
              await sendToConnection(event, connectionId, { action: 'room:joined', roomCode: room.roomCode, state });
              await broadcastToRoom(event, room, { action: 'room:state', ...state }, connectionId);

              return { statusCode: 200, body: 'Joined' };
            }

            case 'room:ready': {
              const { isReady } = data || {};

              // Find room by connection (check both host and players)
              const rooms = await ddb.send(new ScanCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                FilterExpression: 'hostSocketId = :sid OR contains(playerSocketIds, :sid)',
                ExpressionAttributeValues: { ':sid': connectionId },
              }));

              const room = rooms.Items?.[0];
              if (!room) {
                await sendToConnection(event, connectionId, { action: 'error', message: 'Not in a room' });
                return { statusCode: 404, body: 'Not in room' };
              }

              // Update player ready status - find the player in the array
              const isHost = room.hostSocketId === connectionId;
              if (isHost) {
                // Host is always at index 0 in players array
                if (room.players[0]) {
                  room.players[0].isReady = isReady;
                }
              } else {
                const playerIndex = room.playerSocketIds.indexOf(connectionId);
                // Non-host players start at index 1 in players array
                if (playerIndex >= 0 && room.players[playerIndex + 1]) {
                  room.players[playerIndex + 1].isReady = isReady;
                }
              }

              await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                Key: { roomCode: room.roomCode },
                UpdateExpression: 'SET players = :players',
                ExpressionAttributeValues: { ':players': room.players },
              }));

              await broadcastToRoom(event, room, { action: 'room:state', ...getRoomState(room) });
              return { statusCode: 200, body: 'Ready updated' };
            }

            case 'game:start': {
              // Find room where user is host
              const rooms = await ddb.send(new ScanCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                FilterExpression: 'hostSocketId = :sid AND #status = :waiting',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':sid': connectionId, ':waiting': 'waiting' },
              }));

              const room = rooms.Items?.[0];
              if (!room) {
                await sendToConnection(event, connectionId, { action: 'error', message: 'Not host or room not found' });
                return { statusCode: 404, body: 'Not host' };
              }

              // Check all players ready
              console.log('Checking players ready:', JSON.stringify(room.players));
              const players = room.players || [];
              let allReady = true;
              for (const p of players) {
                if (!p.isReady) {
                  allReady = false;
                  break;
                }
              }
              console.log('allReady:', allReady, 'players.length:', players.length);
              if (!allReady || players.length < 1) {
                await sendToConnection(event, connectionId, { action: 'error', message: 'Not all players ready' });
                return { statusCode: 400, body: 'Not ready' };
              }

              // Get random logos
              const logosResult = await ddb.send(new ScanCommand({
                TableName: process.env.TABLE_LOGOS,
              }));
              const allLogos = logosResult.Items || [];
              const shuffled = shuffle(allLogos);
              const selectedLogos = shuffled.slice(0, room.settings.logoCount);
              const logoIds = selectedLogos.map(l => l.logoId);

              // Update room status
              await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                Key: { roomCode: room.roomCode },
                UpdateExpression: 'SET #status = :status, logoIds = :logoIds, currentLogoIndex = :idx, gameStartedAt = :startedAt, logos = :logos',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                  ':status': 'in_progress',
                  ':logoIds': logoIds,
                  ':idx': 0,
                  ':startedAt': new Date().toISOString(),
                  ':logos': selectedLogos,
                },
              }));

              // Initialize scores
              const allConnections = [room.hostSocketId, ...room.playerSocketIds];
              for (const connId of allConnections) {
                await ddb.send(new PutCommand({
                  TableName: process.env.TABLE_GAME_SESSIONS,
                  Item: {
                    roomCode: room.roomCode,
                    socketId: connId,
                    score: 0,
                    correctAnswers: 0,
                  },
                }));
              }

              // Broadcast game started
              await broadcastToRoom(event, room, {
                action: 'game:started',
                totalLogos: selectedLogos.length,
                timeLimit: room.settings.timeLimit,
              });

              // Send first logo
              const firstLogo = selectedLogos[0];
              const obfuscatedName = firstLogo.name.toLowerCase().replace(/[a-z]/gi, '*').replace(/ /g, '_');
              const answerLetters = firstLogo.name.toUpperCase().replace(/[^A-Z]/g, '');
              // Shuffle only the answer letters (no extra letters)
              const letters = shuffle(answerLetters.split('')).join('');

              // Store logo sent timestamp for speed bonus calculation
              await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                Key: { roomCode: room.roomCode },
                UpdateExpression: 'SET logoSentAt = :sentAt',
                ExpressionAttributeValues: { ':sentAt': Date.now() },
              }));

              await broadcastToRoom(event, room, {
                action: 'game:logo',
                logoId: firstLogo.logoId,
                obfuscatedImageUrl: firstLogo.obfuscatedImageUrl || '',
                letters,
                obfuscatedName,
                logoIndex: 0,
                totalLogos: selectedLogos.length,
              });

              return { statusCode: 200, body: 'Game started' };
            }

            case 'game:answer': {
              const { logoId, guess } = data || {};

              // Find room
              const rooms = await ddb.send(new ScanCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                FilterExpression: '(hostSocketId = :sid OR contains(playerSocketIds, :sid)) AND #status = :status',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':sid': connectionId, ':status': 'in_progress' },
              }));

              const room = rooms.Items?.[0];
              if (!room) return { statusCode: 404, body: 'Not in game' };

              const currentLogoId = room.logoIds[room.currentLogoIndex];
              if (logoId !== currentLogoId) {
                await sendToConnection(event, connectionId, { action: 'game:answer-rejected', reason: 'Wrong logo' });
                return { statusCode: 400, body: 'Wrong logo' };
              }

              const currentLogo = room.logos.find(l => l.logoId === currentLogoId);
              const normalizedGuess = guess.toLowerCase().replace(/\\s/g, '');
              const normalizedName = currentLogo.name.toLowerCase().replace(/\\s/g, '');
              const isCorrect = normalizedGuess === normalizedName;

              // Get/update session
              const sessionResult = await ddb.send(new GetCommand({
                TableName: process.env.TABLE_GAME_SESSIONS,
                Key: { roomCode: room.roomCode, socketId: connectionId },
              }));
              const session = sessionResult.Item || { score: 0, correctAnswers: 0 };

              // Calculate points with speed bonus for correct answers
              let points = -100; // Wrong answer penalty
              if (isCorrect) {
                const basePoints = 100;
                const timeTaken = Date.now() - (room.logoSentAt || Date.now());
                const totalGameTime = room.settings?.timeLimit || 60; // in seconds
                const timeRatio = Math.min(timeTaken / (totalGameTime * 1000), 1);
                const speedBonus = Math.floor(50 * (1 - timeRatio));
                points = basePoints + speedBonus;
              }
              session.score = (session.score || 0) + points;
              if (isCorrect) session.correctAnswers = (session.correctAnswers || 0) + 1;

              await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_GAME_SESSIONS,
                Key: { roomCode: room.roomCode, socketId: connectionId },
                UpdateExpression: 'SET score = :score, correctAnswers = :ca',
                ExpressionAttributeValues: { ':score': session.score, ':ca': session.correctAnswers },
              }));

              // Send result to player
              await sendToConnection(event, connectionId, {
                action: 'game:answer-result',
                correct: isCorrect,
                points,
                totalScore: session.score,
                correctAnswer: isCorrect ? undefined : currentLogo.name,
              });

              // Get leaderboard
              const sessions = await ddb.send(new QueryCommand({
                TableName: process.env.TABLE_GAME_SESSIONS,
                KeyConditionExpression: 'roomCode = :rc',
                ExpressionAttributeValues: { ':rc': room.roomCode },
              }));

              const leaderboard = (sessions.Items || [])
                .filter(s => s.socketId !== '__CONNECTIONS__')
                .map(s => {
                  const isHost = s.socketId === room.hostSocketId;
                  const playerIdx = room.playerSocketIds?.indexOf(s.socketId);
                  // playerSocketIds doesn't include host, but players[0] is host
                  // So non-host players are at players[playerIdx + 1]
                  const displayName = isHost ? room.hostDisplayName : room.players[playerIdx + 1]?.displayName || 'Unknown';
                  return { displayName, score: s.score || 0, correctAnswers: s.correctAnswers || 0 };
                })
                .sort((a, b) => b.score - a.score);

              await broadcastToRoom(event, room, { action: 'game:score-update', leaderboard });

              // If correct, advance to next logo
              if (isCorrect) {
                const solverIsHost = connectionId === room.hostSocketId;
                const solverIdx = room.playerSocketIds?.indexOf(connectionId);
                // players[0] is host, non-host players are at players[solverIdx + 1]
                const solverName = solverIsHost ? room.hostDisplayName : room.players[solverIdx + 1]?.displayName || 'Someone';

                await broadcastToRoom(event, room, {
                  action: 'game:answer-revealed',
                  answer: currentLogo.name,
                  solvedBy: solverName,
                  logoIndex: room.currentLogoIndex,
                });

                const nextIndex = room.currentLogoIndex + 1;
                if (nextIndex < room.logoIds.length) {
                  // Send next logo after delay
                  const nextLogo = room.logos[nextIndex];
                  const nextObfuscatedName = nextLogo.name.toLowerCase().replace(/[a-z]/gi, '*').replace(/ /g, '_');
                  const nextAnswerLetters = nextLogo.name.toUpperCase().replace(/[^A-Z]/g, '');
                  // Shuffle only the answer letters (no extra letters)
                  const nextLetters = shuffle(nextAnswerLetters.split('')).join('');

                  // Small delay before next logo
                  await new Promise(r => setTimeout(r, 2000));

                  // Update index and logo sent timestamp for speed bonus calculation
                  await ddb.send(new UpdateCommand({
                    TableName: process.env.TABLE_GAME_ROOMS,
                    Key: { roomCode: room.roomCode },
                    UpdateExpression: 'SET currentLogoIndex = :idx, logoSentAt = :sentAt',
                    ExpressionAttributeValues: { ':idx': nextIndex, ':sentAt': Date.now() },
                  }));

                  await broadcastToRoom(event, room, {
                    action: 'game:logo',
                    logoId: nextLogo.logoId,
                    obfuscatedImageUrl: nextLogo.obfuscatedImageUrl || '',
                    letters: nextLetters,
                    obfuscatedName: nextObfuscatedName,
                    logoIndex: nextIndex,
                    totalLogos: room.logoIds.length,
                  });
                } else {
                  // Game over
                  await ddb.send(new UpdateCommand({
                    TableName: process.env.TABLE_GAME_ROOMS,
                    Key: { roomCode: room.roomCode },
                    UpdateExpression: 'SET #status = :status, gameEndedAt = :endedAt',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'completed', ':endedAt': new Date().toISOString() },
                  }));

                  // Convert leaderboard to rankings with rank field
                  const rankings = leaderboard.map((entry, idx) => ({
                    rank: idx + 1,
                    displayName: entry.displayName,
                    score: entry.score,
                    correctAnswers: entry.correctAnswers,
                  }));

                  const gameTime = room.settings?.timeLimit || 120;

                  await broadcastToRoom(event, room, {
                    action: 'game:end',
                    rankings,
                    totalLogos: room.logoIds.length,
                    gameTime,
                  });
                }
              }

              return { statusCode: 200, body: 'Answer processed' };
            }

            case 'game:timeout': {
              // Client-side timer expired - end the game
              const rooms = await ddb.send(new ScanCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                FilterExpression: '(hostSocketId = :sid OR contains(playerSocketIds, :sid)) AND #status = :status',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':sid': connectionId, ':status': 'in_progress' },
              }));

              const room = rooms.Items?.[0];
              if (!room) return { statusCode: 404, body: 'Not in game' };

              // Only allow host to end the game (prevent duplicate ends)
              if (room.hostSocketId !== connectionId) {
                return { statusCode: 200, body: 'Only host can end game' };
              }

              // Get all sessions for leaderboard
              const sessionsResult = await ddb.send(new QueryCommand({
                TableName: process.env.TABLE_GAME_SESSIONS,
                KeyConditionExpression: 'roomCode = :rc',
                ExpressionAttributeValues: { ':rc': room.roomCode },
              }));

              const leaderboard = (sessionsResult.Items || [])
                .filter(s => s.socketId !== '__CONNECTIONS__')
                .map(s => {
                  const isHost = s.socketId === room.hostSocketId;
                  const playerIdx = room.playerSocketIds?.indexOf(s.socketId);
                  // players[0] is host, non-host players are at players[playerIdx + 1]
                  const displayName = isHost ? room.hostDisplayName : room.players[playerIdx + 1]?.displayName || 'Unknown';
                  return { displayName, score: s.score || 0, correctAnswers: s.correctAnswers || 0 };
                })
                .sort((a, b) => b.score - a.score);

              // Convert leaderboard to rankings with rank field
              const rankings = leaderboard.map((entry, idx) => ({
                rank: idx + 1,
                displayName: entry.displayName,
                score: entry.score,
                correctAnswers: entry.correctAnswers,
              }));

              const gameTime = room.settings?.timeLimit || 120;

              // Update room status
              await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_GAME_ROOMS,
                Key: { roomCode: room.roomCode },
                UpdateExpression: 'SET #status = :status, gameEndedAt = :endedAt',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':status': 'completed', ':endedAt': new Date().toISOString() },
              }));

              // Broadcast game end
              await broadcastToRoom(event, room, {
                action: 'game:end',
                rankings,
                totalLogos: room.logoIds?.length || 0,
                gameTime,
              });

              return { statusCode: 200, body: 'Game ended by timeout' };
            }

            default:
              console.log('Unknown action:', action);
              return { statusCode: 400, body: 'Unknown action' };
          }
        };
      `),
    } as lambda.FunctionProps);

    // Integration for $connect
    const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: this.webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${connectHandler.functionArn}/invocations`,
    });

    // Integration for $disconnect
    const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: this.webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${disconnectHandler.functionArn}/invocations`,
    });

    // Integration for $default
    const defaultIntegration = new apigatewayv2.CfnIntegration(this, 'DefaultIntegration', {
      apiId: this.webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${defaultHandler.functionArn}/invocations`,
    });

    // Routes
    const connectRoute = new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
      apiId: this.webSocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: `integrations/${connectIntegration.ref}`,
    });

    const disconnectRoute = new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: this.webSocketApi.ref,
      routeKey: '$disconnect',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    const defaultRoute = new apigatewayv2.CfnRoute(this, 'DefaultRoute', {
      apiId: this.webSocketApi.ref,
      routeKey: '$default',
      target: `integrations/${defaultIntegration.ref}`,
    });

    // Lambda permissions for API Gateway
    connectHandler.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*/$connect`,
    });

    disconnectHandler.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*/$disconnect`,
    });

    defaultHandler.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*/$default`,
    });

    // Stage
    const stage = new apigatewayv2.CfnStage(this, 'ProdStage', {
      apiId: this.webSocketApi.ref,
      stageName: 'prod',
      autoDeploy: true,
    });

    // Deployment
    const deployment = new apigatewayv2.CfnDeployment(this, 'Deployment', {
      apiId: this.webSocketApi.ref,
    });
    deployment.addDependency(connectRoute);
    deployment.addDependency(disconnectRoute);
    deployment.addDependency(defaultRoute);

    this.webSocketUrl = `wss://${this.webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/prod`;

    // Outputs
    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: this.webSocketUrl,
      description: 'WebSocket API URL',
    });

    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: this.webSocketApi.ref,
      description: 'WebSocket API ID',
    });
  }
}
