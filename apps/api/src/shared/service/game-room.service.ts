import { Injectable, Inject, forwardRef } from '@nestjs/common';
import {
  GameRoom,
  GameRoomPlayer,
  GameRoomSettings,
  GameRoomStatus,
  RoomStateDto,
} from '@logo-quiz/models';
import { DynamoDBService, TABLES } from './dynamodb.service';

@Injectable()
export class GameRoomService {
  constructor(@Inject(forwardRef(() => DynamoDBService)) private readonly dynamodb: DynamoDBService) {}

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createRoom(
    hostSocketId: string,
    hostDisplayName: string,
    hostUserId?: string,
    settings?: Partial<GameRoomSettings>,
  ): Promise<GameRoom> {
    let roomCode: string;
    let existingRoom: GameRoom | null;

    // Generate unique room code
    do {
      roomCode = this.generateRoomCode();
      existingRoom = await this.findActiveByRoomCode(roomCode);
    } while (existingRoom);

    const now = new Date().toISOString();
    const room: GameRoom = {
      roomCode,
      hostUserId: hostUserId || undefined,
      hostSocketId,
      hostDisplayName,
      players: [],
      settings: {
        timeLimit: 120,
        maxPlayers: 100,
        minPlayers: 2,
        logoCount: 10,
        autoStart: false,
        ...settings,
      },
      status: 'waiting',
      logoIds: [],
      currentLogoIndex: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamodb.put({
      TableName: TABLES.GAME_ROOMS,
      Item: room,
    });

    return room;
  }

  async findByRoomCode(roomCode: string): Promise<GameRoom | null> {
    return this.dynamodb.get<GameRoom>({
      TableName: TABLES.GAME_ROOMS,
      Key: { roomCode },
    });
  }

  async findActiveByRoomCode(roomCode: string): Promise<GameRoom | null> {
    const room = await this.findByRoomCode(roomCode);
    if (!room) return null;
    if (!['waiting', 'starting', 'in_progress'].includes(room.status)) return null;
    return room;
  }

  async joinRoom(
    roomCode: string,
    socketId: string,
    displayName: string,
    userId?: string,
  ): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;
    if (room.status !== 'waiting') return null;
    if (room.players.length >= room.settings.maxPlayers) return null;

    // Check if player with same socketId already exists
    const existingPlayer = room.players.find((p) => p.socketId === socketId);
    if (existingPlayer) return room;

    const player: GameRoomPlayer = {
      userId: userId || undefined,
      displayName,
      joinedAt: new Date().toISOString(),
      isReady: false,
      socketId,
    };

    room.players.push(player);

    await this.dynamodb.update({
      TableName: TABLES.GAME_ROOMS,
      Key: { roomCode },
      UpdateExpression: 'SET players = :players, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':players': room.players,
        ':updatedAt': new Date().toISOString(),
      },
    });

    return room;
  }

  async leaveRoom(roomCode: string, socketId: string): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;

    // If host is leaving, cancel the room
    if (room.hostSocketId === socketId) {
      room.status = 'cancelled';
      await this.dynamodb.update({
        TableName: TABLES.GAME_ROOMS,
        Key: { roomCode },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'cancelled',
          ':updatedAt': new Date().toISOString(),
        },
      });
      return room;
    }

    // Remove player
    room.players = room.players.filter((p) => p.socketId !== socketId);
    await this.dynamodb.update({
      TableName: TABLES.GAME_ROOMS,
      Key: { roomCode },
      UpdateExpression: 'SET players = :players, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':players': room.players,
        ':updatedAt': new Date().toISOString(),
      },
    });

    return room;
  }

  async setPlayerReady(roomCode: string, socketId: string, isReady: boolean): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;
    if (room.status !== 'waiting') return null;

    const playerIndex = room.players.findIndex((p) => p.socketId === socketId);
    if (playerIndex !== -1) {
      room.players[playerIndex].isReady = isReady;
      await this.dynamodb.update({
        TableName: TABLES.GAME_ROOMS,
        Key: { roomCode },
        UpdateExpression: 'SET players = :players, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':players': room.players,
          ':updatedAt': new Date().toISOString(),
        },
      });
    }
    return room;
  }

  async startGame(roomCode: string, logoIds: string[]): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;
    if (room.status !== 'waiting') return null;

    const now = new Date().toISOString();
    await this.dynamodb.update({
      TableName: TABLES.GAME_ROOMS,
      Key: { roomCode },
      UpdateExpression:
        'SET #status = :status, logoIds = :logoIds, currentLogoIndex = :idx, gameStartedAt = :startedAt, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'in_progress',
        ':logoIds': logoIds,
        ':idx': 0,
        ':startedAt': now,
        ':updatedAt': now,
      },
    });

    room.status = 'in_progress';
    room.logoIds = logoIds;
    room.currentLogoIndex = 0;
    room.gameStartedAt = now;

    return room;
  }

  async advanceToNextLogo(roomCode: string): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;
    if (room.status !== 'in_progress') return null;

    room.currentLogoIndex++;
    await this.dynamodb.update({
      TableName: TABLES.GAME_ROOMS,
      Key: { roomCode },
      UpdateExpression: 'SET currentLogoIndex = :idx, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':idx': room.currentLogoIndex,
        ':updatedAt': new Date().toISOString(),
      },
    });

    return room;
  }

  async endGame(roomCode: string): Promise<GameRoom | null> {
    const room = await this.findByRoomCode(roomCode);
    if (!room) return null;

    const now = new Date().toISOString();
    await this.dynamodb.update({
      TableName: TABLES.GAME_ROOMS,
      Key: { roomCode },
      UpdateExpression: 'SET #status = :status, gameEndedAt = :endedAt, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':endedAt': now,
        ':updatedAt': now,
      },
    });

    room.status = 'completed';
    room.gameEndedAt = now;

    return room;
  }

  async updateStatus(roomCode: string, status: GameRoomStatus): Promise<GameRoom | null> {
    await this.dynamodb.update({
      TableName: TABLES.GAME_ROOMS,
      Key: { roomCode },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
      },
    });

    return this.findByRoomCode(roomCode);
  }

  canStartGame(room: GameRoom): boolean {
    // Check minimum players (host + at least minPlayers-1 players)
    const totalPlayers = room.players.length + 1; // +1 for host
    if (totalPlayers < room.settings.minPlayers) return false;

    // Check if all players are ready
    const allPlayersReady = room.players.every((p) => p.isReady);
    return allPlayersReady;
  }

  getRoomState(room: GameRoom, timeRemaining?: number): RoomStateDto {
    return {
      roomCode: room.roomCode,
      hostDisplayName: room.hostDisplayName,
      players: [
        { displayName: room.hostDisplayName, isReady: true, isHost: true },
        ...room.players.map((p) => ({
          displayName: p.displayName,
          isReady: p.isReady,
          isHost: false,
        })),
      ],
      settings: room.settings,
      status: room.status,
      currentLogoIndex: room.currentLogoIndex,
      totalLogos: room.logoIds?.length || room.settings.logoCount,
      timeRemaining,
    };
  }

  async findRoomBySocketId(socketId: string): Promise<GameRoom | null> {
    // Scan for all active rooms - DynamoDB's contains() doesn't work for nested object properties
    // We filter client-side to find rooms where user is host or a player
    const rooms = await this.dynamodb.scan<GameRoom>({
      TableName: TABLES.GAME_ROOMS,
      FilterExpression: '#status IN (:waiting, :starting, :in_progress)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':waiting': 'waiting',
        ':starting': 'starting',
        ':in_progress': 'in_progress',
      },
    });

    // Find room where user is host or a player by checking socketId
    return (
      rooms.find((room) => room.hostSocketId === socketId || room.players.some((p) => p.socketId === socketId)) ||
      null
    );
  }
}
