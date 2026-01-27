import { Timestampable } from './timestampable';

export interface GameRoomSettings {
  timeLimit: number; // seconds
  maxPlayers: number;
  minPlayers: number;
  levelId?: string;
  logoCount: number;
  autoStart: boolean;
}

export interface GameRoomPlayer {
  userId?: string;
  displayName: string;
  joinedAt: string; // ISO date string
  isReady: boolean;
  socketId: string;
}

export type GameRoomStatus = 'waiting' | 'starting' | 'in_progress' | 'completed' | 'cancelled';

export interface GameRoom extends Timestampable {
  roomCode: string; // Partition key
  hostUserId?: string;
  hostSocketId: string;
  hostDisplayName: string;
  players: GameRoomPlayer[];
  settings: GameRoomSettings;
  status: GameRoomStatus;
  logoIds: string[]; // Array of logo IDs for the game
  currentLogoIndex: number;
  gameStartedAt?: string; // ISO date string
  gameEndedAt?: string; // ISO date string
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
