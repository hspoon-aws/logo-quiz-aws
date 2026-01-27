import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import {
  GameRoom,
  GameRoomPlayer,
  GameRoomSettings,
  GameRoomStatus,
  RoomStateDto,
} from '@logo-quiz/models';

@Injectable()
export class GameRoomService {
  constructor(
    @Inject('GAME_ROOM_MODEL') private readonly gameRoomModel: Model<GameRoom>,
  ) {}

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
    let existingRoom: GameRoom;

    // Generate unique room code
    do {
      roomCode = this.generateRoomCode();
      existingRoom = await this.gameRoomModel.findOne({
        roomCode,
        status: { $in: ['waiting', 'starting', 'in_progress'] }
      }).exec();
    } while (existingRoom);

    const room = new this.gameRoomModel({
      roomCode,
      host: hostUserId || null,
      hostSocketId,
      hostDisplayName,
      players: [],
      settings: {
        timeLimit: 120,
        maxPlayers: 100, // Virtual limit - always allow joining
        minPlayers: 2,
        logoCount: 10,
        autoStart: false,
        ...settings,
      },
      status: 'waiting',
    });

    return await room.save();
  }

  async findByRoomCode(roomCode: string): Promise<GameRoom | null> {
    return this.gameRoomModel.findOne({ roomCode }).exec();
  }

  async findActiveByRoomCode(roomCode: string): Promise<GameRoom | null> {
    return this.gameRoomModel.findOne({
      roomCode,
      status: { $in: ['waiting', 'starting', 'in_progress'] },
    }).exec();
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
    const existingPlayer = room.players.find(p => p.socketId === socketId);
    if (existingPlayer) return room;

    const player: GameRoomPlayer = {
      user: userId || null,
      displayName,
      joinedAt: new Date(),
      isReady: false,
      socketId,
    };

    room.players.push(player);
    return await room.save();
  }

  async leaveRoom(roomCode: string, socketId: string): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;

    // If host is leaving, cancel the room
    if (room.hostSocketId === socketId) {
      room.status = 'cancelled';
      return await room.save();
    }

    // Remove player
    room.players = room.players.filter(p => p.socketId !== socketId);
    return await room.save();
  }

  async setPlayerReady(roomCode: string, socketId: string, isReady: boolean): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;
    if (room.status !== 'waiting') return null;

    const player = room.players.find(p => p.socketId === socketId);
    if (player) {
      player.isReady = isReady;
      return await room.save();
    }
    return room;
  }

  async startGame(roomCode: string, logos: string[]): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;
    if (room.status !== 'waiting') return null;

    room.status = 'in_progress';
    room.logos = logos;
    room.currentLogoIndex = 0;
    room.gameStartedAt = new Date();
    return await room.save();
  }

  async advanceToNextLogo(roomCode: string): Promise<GameRoom | null> {
    const room = await this.findActiveByRoomCode(roomCode);
    if (!room) return null;
    if (room.status !== 'in_progress') return null;

    room.currentLogoIndex++;
    return await room.save();
  }

  async endGame(roomCode: string): Promise<GameRoom | null> {
    const room = await this.gameRoomModel.findOne({ roomCode }).exec();
    if (!room) return null;

    room.status = 'completed';
    room.gameEndedAt = new Date();
    return await room.save();
  }

  async updateStatus(roomCode: string, status: GameRoomStatus): Promise<GameRoom | null> {
    return this.gameRoomModel.findOneAndUpdate(
      { roomCode },
      { status },
      { new: true },
    ).exec();
  }

  canStartGame(room: GameRoom): boolean {
    // Check minimum players (host + at least minPlayers-1 players)
    const totalPlayers = room.players.length + 1; // +1 for host
    if (totalPlayers < room.settings.minPlayers) return false;

    // Check if all players are ready
    const allPlayersReady = room.players.every(p => p.isReady);
    return allPlayersReady;
  }

  getRoomState(room: GameRoom, timeRemaining?: number): RoomStateDto {
    return {
      roomCode: room.roomCode,
      hostDisplayName: room.hostDisplayName,
      players: [
        { displayName: room.hostDisplayName, isReady: true, isHost: true },
        ...room.players.map(p => ({
          displayName: p.displayName,
          isReady: p.isReady,
          isHost: false,
        })),
      ],
      settings: room.settings,
      status: room.status,
      currentLogoIndex: room.currentLogoIndex,
      totalLogos: (room.logos && room.logos.length) || room.settings.logoCount,
      timeRemaining,
    };
  }

  async findRoomBySocketId(socketId: string): Promise<GameRoom | null> {
    // Find room where user is host or a player
    return this.gameRoomModel.findOne({
      status: { $in: ['waiting', 'starting', 'in_progress'] },
      $or: [
        { hostSocketId: socketId },
        { 'players.socketId': socketId },
      ],
    }).exec();
  }
}
