import { Document } from 'mongoose';
import { Timestampable } from './timestampable';

export interface GameAnswer {
  logo: string;
  correct: boolean;
  timeTaken: number; // milliseconds
  points: number;
  answeredAt: Date;
}

export interface GameSession extends Document, Timestampable {
  _id: string;
  gameRoom: string;
  user?: string;
  displayName: string;
  socketId: string;
  score: number;
  answers: GameAnswer[];
  correctAnswers: number;
  finalRank?: number;
}

// DTOs for WebSocket events
export interface SubmitAnswerDto {
  logoId: string;
  guess: string;
}

export interface AnswerResultDto {
  correct: boolean;
  points: number;
  totalScore: number;
  correctAnswer?: string;
}

export interface ScoreUpdateDto {
  leaderboard: {
    displayName: string;
    score: number;
    correctAnswers: number;
  }[];
}

export interface GameLogoDto {
  logoId: string;
  obfuscatedImageUrl: string;
  letters: string;
  obfuscatedName: string; // Pattern like "****_***" showing answer structure with spaces
  logoIndex: number;
  totalLogos: number;
}

export interface FinalScoreboardDto {
  rankings: {
    rank: number;
    displayName: string;
    score: number;
    correctAnswers: number;
  }[];
  totalLogos: number;
  gameTime: number;
}

export interface PlayerScore {
  displayName: string;
  score: number;
  correctAnswers: number;
}
