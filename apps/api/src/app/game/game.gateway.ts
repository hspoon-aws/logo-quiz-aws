import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { GameRoomService } from '../../shared/service/game-room.service';
import { GameSessionService } from '../../shared/service/game-session.service';
import { GameTimerService } from '../../shared/service/game-timer.service';
import { LogoService } from '../../shared/service/logo.service';
import { WsJwtGuard } from '../../shared/guards/ws-jwt.guard';
import {
  CreateRoomDto,
  JoinRoomDto,
  SubmitAnswerDto,
  GameLogoDto,
  Logo,
} from '@logo-quiz/models';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/game',
})
@UseGuards(WsJwtGuard)
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('GameGateway');

  constructor(
    @Inject(forwardRef(() => GameRoomService))
    private readonly gameRoomService: GameRoomService,
    @Inject(forwardRef(() => GameSessionService))
    private readonly gameSessionService: GameSessionService,
    @Inject(forwardRef(() => GameTimerService))
    private readonly gameTimerService: GameTimerService,
    @Inject(forwardRef(() => LogoService))
    private readonly logoService: LogoService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Guard against undefined service (can happen during hot-reload)
    if (!this.gameRoomService) {
      this.logger.warn('GameRoomService not available during disconnect');
      return;
    }

    // Find and handle room cleanup
    const room = await this.gameRoomService.findRoomBySocketId(client.id);
    if (room) {
      const updatedRoom = await this.gameRoomService.leaveRoom(room.roomCode, client.id);
      if (updatedRoom) {
        if (updatedRoom.status === 'cancelled') {
          // Host left, notify all players
          this.server.to(room.roomCode).emit('room:cancelled', {
            reason: 'Host has left the room',
          });
          this.gameTimerService.stopTimer(room.roomCode);
        } else {
          // Player left, update room state
          this.server.to(room.roomCode).emit('room:state',
            this.gameRoomService.getRoomState(updatedRoom, this.gameTimerService.getTimeRemaining(room.roomCode))
          );
        }
      }
    }
  }

  @SubscribeMessage('room:create')
  async handleCreateRoom(
    @MessageBody() data: CreateRoomDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ event: string; data: any }> {
    try {
      const userId = (client.data && client.data.user && client.data.user.sub) || null;
      const room = await this.gameRoomService.createRoom(
        client.id,
        data.displayName,
        userId,
        data.settings,
      );

      // Join the socket room
      client.join(room.roomCode);

      this.logger.log(`Room created: ${room.roomCode} by ${data.displayName}`);

      const response = {
        event: 'room:created',
        data: {
          roomCode: room.roomCode,
          state: this.gameRoomService.getRoomState(room),
        },
      };

      // Also emit directly in case acknowledgment doesn't work
      client.emit('room:created', response.data);

      return response;
    } catch (error) {
      this.logger.error(`Error creating room: ${error.message}`);
      throw new WsException('Failed to create room');
    }
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = (client.data && client.data.user && client.data.user.sub) || null;
      const roomCode = data.roomCode.toUpperCase();
      const room = await this.gameRoomService.joinRoom(
        roomCode,
        client.id,
        data.displayName,
        userId,
      );

      if (!room) {
        return {
          event: 'room:error',
          data: { message: 'Room not found or cannot join' },
        };
      }

      // Join the socket room
      client.join(roomCode);

      this.logger.log(`Player ${data.displayName} joined room: ${roomCode}`);

      const roomState = this.gameRoomService.getRoomState(room);

      // Broadcast updated state to all players in room
      this.server.to(roomCode).emit('room:state', roomState);

      const response = {
        event: 'room:joined',
        data: {
          roomCode: room.roomCode,
          state: roomState,
        },
      };

      // Also emit directly in case acknowledgment doesn't work
      client.emit('room:joined', response.data);

      return response;
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      throw new WsException('Failed to join room');
    }
  }

  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const room = await this.gameRoomService.findRoomBySocketId(client.id);
      if (!room) return;

      const updatedRoom = await this.gameRoomService.leaveRoom(room.roomCode, client.id);
      client.leave(room.roomCode);

      if (updatedRoom && updatedRoom.status === 'cancelled') {
        this.server.to(room.roomCode).emit('room:cancelled', {
          reason: 'Host has left the room',
        });
        this.gameTimerService.stopTimer(room.roomCode);
      } else if (updatedRoom) {
        this.server.to(room.roomCode).emit('room:state', this.gameRoomService.getRoomState(updatedRoom));
      }

      return { event: 'room:left', data: {} };
    } catch (error) {
      this.logger.error(`Error leaving room: ${error.message}`);
    }
  }

  @SubscribeMessage('room:ready')
  async handleReady(
    @MessageBody() data: { isReady: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const room = await this.gameRoomService.findRoomBySocketId(client.id);
      if (!room) {
        throw new WsException('Not in a room');
      }

      const updatedRoom = await this.gameRoomService.setPlayerReady(
        room.roomCode,
        client.id,
        data.isReady,
      );

      if (updatedRoom) {
        this.server.to(room.roomCode).emit('room:state', this.gameRoomService.getRoomState(updatedRoom));

        // Check for auto-start
        if (updatedRoom.settings.autoStart && this.gameRoomService.canStartGame(updatedRoom)) {
          await this.startGame(room.roomCode, client);
        }
      }

      return { event: 'room:ready-updated', data: { isReady: data.isReady } };
    } catch (error) {
      this.logger.error(`Error updating ready status: ${error.message}`);
      throw new WsException('Failed to update ready status');
    }
  }

  @SubscribeMessage('game:start')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const room = await this.gameRoomService.findRoomBySocketId(client.id);
      if (!room) {
        throw new WsException('Not in a room');
      }

      // Only host can start
      if (room.hostSocketId !== client.id) {
        throw new WsException('Only the host can start the game');
      }

      if (!this.gameRoomService.canStartGame(room)) {
        throw new WsException('Cannot start game: not enough players ready');
      }

      await this.startGame(room.roomCode, client);

      return { event: 'game:starting', data: {} };
    } catch (error) {
      this.logger.error(`Error starting game: ${error.message}`);
      throw error;
    }
  }

  private async startGame(roomCode: string, hostClient: Socket) {
    const room = await this.gameRoomService.findActiveByRoomCode(roomCode);
    if (!room) return;

    // Select random logos
    const allLogos = await this.logoService.findAll();
    const shuffled = allLogos.sort(() => Math.random() - 0.5);
    const selectedLogos = shuffled.slice(0, room.settings.logoCount);
    const logoIds = selectedLogos.map((l) => l.logoId);

    // Start the game
    const updatedRoom = await this.gameRoomService.startGame(roomCode, logoIds);
    if (!updatedRoom) return;

    // Create sessions for all players (including host)
    const hostUserId = (hostClient.data && hostClient.data.user && hostClient.data.user.sub) || null;
    await this.gameSessionService.createSession(
      roomCode,
      room.hostSocketId,
      room.hostDisplayName,
      hostUserId,
    );

    for (const player of room.players) {
      await this.gameSessionService.createSession(
        roomCode,
        player.socketId,
        player.displayName,
        player.userId || undefined,
      );
    }

    // Broadcast game started
    this.server.to(roomCode).emit('game:started', {
      totalLogos: selectedLogos.length,
      timeLimit: room.settings.timeLimit,
    });

    // Send first logo
    this.sendCurrentLogo(roomCode, selectedLogos[0], 0, selectedLogos.length);

    // Start the game timer
    this.gameTimerService.startTimer(
      roomCode,
      room.settings.timeLimit,
      (timeRemaining) => {
        this.server.to(roomCode).emit('game:timer', { timeRemaining });
      },
      async () => {
        await this.endGame(roomCode);
      },
    );
  }

  private sendCurrentLogo(roomCode: string, logo: Logo, index: number, total: number) {
    // Generate obfuscatedName if not present
    let obfuscatedName = logo.obfuscatedName || '';
    if (!obfuscatedName && logo.name) {
      obfuscatedName = logo.name.toLowerCase().replace(/[a-z]/gi, '*').replace(/ /g, '_');
    }

    // Ensure letters has enough characters for the answer
    let letters = logo.letters || '';
    const answerLetters = logo.name.toUpperCase().replace(/[^A-Z]/g, '');

    // If letters doesn't have enough chars, regenerate with answer letters + extras
    if (letters.length < answerLetters.length) {
      const extraLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const extraCount = Math.max(4, 12 - answerLetters.length); // Add 4-12 extra letters
      let pool = answerLetters;
      for (let i = 0; i < extraCount; i++) {
        pool += extraLetters[Math.floor(Math.random() * extraLetters.length)];
      }
      // Shuffle the letters
      letters = pool.split('').sort(() => Math.random() - 0.5).join('');
    }

    const logoDto: GameLogoDto = {
      logoId: logo.logoId,
      obfuscatedImageUrl: logo.obfuscatedImageUrl || '',
      letters: letters,
      obfuscatedName: obfuscatedName,
      logoIndex: index,
      totalLogos: total,
    };

    this.server.to(roomCode).emit('game:logo', logoDto);
  }

  @SubscribeMessage('game:answer')
  async handleAnswer(
    @MessageBody() data: SubmitAnswerDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const room = await this.gameRoomService.findRoomBySocketId(client.id);
      if (!room || room.status !== 'in_progress') {
        throw new WsException('Game not in progress');
      }

      // Get the current logo
      const currentLogoId = room.logoIds[room.currentLogoIndex];
      if (data.logoId !== currentLogoId) {
        // Answering wrong logo (maybe out of sync)
        return { event: 'game:answer-rejected', data: { reason: 'Wrong logo' } };
      }

      // Validate the answer - normalize by removing spaces for comparison
      const logo = await this.logoService.findOne(currentLogoId);
      const normalizedGuess = data.guess.toLowerCase().replace(/\s/g, '');
      const normalizedName = logo ? logo.name.toLowerCase().replace(/\s/g, '') : '';
      const isCorrect = logo && normalizedName === normalizedGuess;

      // Record the answer
      const elapsedTime = this.gameTimerService.getElapsedTime(room.roomCode);
      const { session, points } = await this.gameSessionService.recordAnswer(
        room.roomCode,
        client.id,
        currentLogoId,
        isCorrect,
        elapsedTime,
        room.settings.timeLimit,
      );

      // Send result to the player
      client.emit('game:answer-result', {
        correct: isCorrect,
        points,
        totalScore: session.score,
        correctAnswer: isCorrect ? undefined : (logo && logo.name),
      });

      // Update leaderboard for everyone (scores change on both correct and wrong answers)
      const leaderboard = await this.gameSessionService.getLeaderboard(room.roomCode);
      this.server.to(room.roomCode).emit('game:score-update', { leaderboard });

      // If correct, broadcast the answer to everyone and advance to next logo
      if (isCorrect) {
        // Find the player's display name
        const player = room.players.find((p) => p.socketId === client.id);
        const solverName = player ? player.displayName :
          (room.hostSocketId === client.id ? room.hostDisplayName : 'Someone');

        // Broadcast the correct answer to all players
        this.server.to(room.roomCode).emit('game:answer-revealed', {
          answer: logo.name,
          solvedBy: solverName,
          logoIndex: room.currentLogoIndex,
        });

        // Advance to next logo after a short delay (let players see the answer)
        const nextIndex = room.currentLogoIndex + 1;
        setTimeout(async () => {
          if (nextIndex < room.logoIds.length) {
            const updatedRoom = await this.gameRoomService.advanceToNextLogo(room.roomCode);
            if (updatedRoom) {
              const nextLogo = await this.logoService.findOne(room.logoIds[nextIndex]);
              if (nextLogo) {
                this.sendCurrentLogo(room.roomCode, nextLogo, nextIndex, room.logoIds.length);
              }
            }
          } else {
            // All logos completed, end the game early
            await this.endGame(room.roomCode);
          }
        }, 2000); // 2 second delay to show the answer
      }

      return { event: 'game:answer-processed', data: {} };
    } catch (error) {
      this.logger.error(`Error processing answer: ${error.message}`);
      throw new WsException('Failed to process answer');
    }
  }

  private async endGame(roomCode: string) {
    this.gameTimerService.stopTimer(roomCode);

    const room = await this.gameRoomService.findByRoomCode(roomCode);
    if (!room) return;

    await this.gameRoomService.endGame(roomCode);

    const gameTime = room.settings.timeLimit - this.gameTimerService.getTimeRemaining(roomCode);
    const finalScoreboard = await this.gameSessionService.finalizeSessions(
      roomCode,
      gameTime,
      room.logoIds.length,
    );

    this.server.to(roomCode).emit('game:end', finalScoreboard);

    this.logger.log(`Game ended in room: ${roomCode}`);
  }

  @SubscribeMessage('room:state-request')
  async handleStateRequest(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const room = await this.gameRoomService.findRoomBySocketId(client.id);
      if (!room) {
        return { event: 'room:error', data: { message: 'Not in a room' } };
      }

      const timeRemaining = this.gameTimerService.getTimeRemaining(room.roomCode);
      return {
        event: 'room:state',
        data: this.gameRoomService.getRoomState(room, timeRemaining),
      };
    } catch (error) {
      this.logger.error(`Error getting room state: ${error.message}`);
      throw new WsException('Failed to get room state');
    }
  }
}
