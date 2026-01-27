import { Document } from 'mongoose';
import { Timestampable } from './timestampable';

export interface GameRoomSettings {
  timeLimit: number; // seconds
  maxPlayers: number;
  minPlayers: number;
  level?: string;
  logoCount: number;
  autoStart: boolean;
}

export interface GameRoomPlayer {
  user?: string;
  displayName: string;
  joinedAt: Date;
  isReady: boolean;
  socketId: string;
}

export type GameRoomStatus = 'waiting' | 'starting' | 'in_progress' | 'completed' | 'cancelled';

export interface GameRoom extends Document, Timestampable {
  _id: string;
  roomCode: string;
  host?: string;
  hostSocketId: string;
  hostDisplayName: string;
  players: GameRoomPlayer[];
  settings: GameRoomSettings;
  status: GameRoomStatus;
  logos: string[];
  currentLogoIndex: number;
  gameStartedAt?: Date;
  gameEndedAt?: Date;
}

// DTOs for WebSocket events
export interface CreateRoomDto {
  displayName: string;
  settings?: Partial<GameRoomSettings>;
}

export interface JoinRoomDto {
  roomCode: string;
  displayName: string;
}

export interface RoomStateDto {
  roomCode: string;
  hostDisplayName: string;
  players: {
    displayName: string;
    isReady: boolean;
    isHost: boolean;
  }[];
  settings: GameRoomSettings;
  status: GameRoomStatus;
  currentLogoIndex?: number;
  totalLogos?: number;
  timeRemaining?: number;
}
