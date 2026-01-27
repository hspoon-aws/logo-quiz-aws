import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import {
  GameSession,
  GameAnswer,
  PlayerScore,
  FinalScoreboardDto,
} from '@logo-quiz/models';

@Injectable()
export class GameSessionService {
  constructor(
    @Inject('GAME_SESSION_MODEL') private readonly gameSessionModel: Model<GameSession>,
  ) {}

  async createSession(
    gameRoomId: string,
    socketId: string,
    displayName: string,
    userId?: string,
  ): Promise<GameSession> {
    // Check if session already exists
    const existingSession = await this.gameSessionModel.findOne({
      gameRoom: gameRoomId,
      socketId,
    }).exec();

    if (existingSession) {
      return existingSession;
    }

    const session = new this.gameSessionModel({
      gameRoom: gameRoomId,
      user: userId || null,
      displayName,
      socketId,
      score: 0,
      answers: [],
      correctAnswers: 0,
    });

    return await session.save();
  }

  async findByRoomAndSocket(gameRoomId: string, socketId: string): Promise<GameSession | null> {
    return this.gameSessionModel.findOne({
      gameRoom: gameRoomId,
      socketId,
    }).exec();
  }

  async findAllByRoom(gameRoomId: string): Promise<GameSession[]> {
    return this.gameSessionModel.find({ gameRoom: gameRoomId }).exec();
  }

  calculatePoints(timeTaken: number, totalGameTime: number): number {
    const basePoints = 100;
    // Speed bonus: up to 50 extra points (faster = more bonus)
    // timeTaken is in milliseconds, totalGameTime is in seconds
    const timeRatio = Math.min(timeTaken / (totalGameTime * 1000), 1);
    const speedBonus = Math.floor(50 * (1 - timeRatio));
    return basePoints + speedBonus;
  }

  async recordAnswer(
    gameRoomId: string,
    socketId: string,
    logoId: string,
    correct: boolean,
    timeTaken: number,
    totalGameTime: number,
  ): Promise<{ session: GameSession; points: number }> {
    const session = await this.findByRoomAndSocket(gameRoomId, socketId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if already answered this logo
    const alreadyAnswered = session.answers.some(a => a.logo === logoId);
    if (alreadyAnswered) {
      return { session, points: 0 };
    }

    // Calculate points: positive for correct, negative penalty for wrong
    const wrongAnswerPenalty = 25;
    const points = correct ? this.calculatePoints(timeTaken, totalGameTime) : -wrongAnswerPenalty;

    const answer: GameAnswer = {
      logo: logoId,
      correct,
      timeTaken,
      points,
      answeredAt: new Date(),
    };

    session.answers.push(answer);
    if (correct) {
      session.score += points;
      session.correctAnswers++;
    } else {
      // Deduct points for wrong answer, but don't go below 0
      session.score = Math.max(0, session.score + points);
    }

    await session.save();
    return { session, points };
  }

  async getLeaderboard(gameRoomId: string): Promise<PlayerScore[]> {
    const sessions = await this.findAllByRoom(gameRoomId);
    return sessions
      .map(s => ({
        displayName: s.displayName,
        score: s.score,
        correctAnswers: s.correctAnswers,
      }))
      .sort((a, b) => b.score - a.score);
  }

  async finalizeSessions(gameRoomId: string, gameTime: number, totalLogos: number): Promise<FinalScoreboardDto> {
    const sessions = await this.findAllByRoom(gameRoomId);
    const sortedSessions = sessions.sort((a, b) => b.score - a.score);

    // Update final ranks
    for (let i = 0; i < sortedSessions.length; i++) {
      sortedSessions[i].finalRank = i + 1;
      await sortedSessions[i].save();
    }

    return {
      rankings: sortedSessions.map((s, i) => ({
        rank: i + 1,
        displayName: s.displayName,
        score: s.score,
        correctAnswers: s.correctAnswers,
      })),
      totalLogos,
      gameTime,
    };
  }

  async deleteSessionsByRoom(gameRoomId: string): Promise<void> {
    await this.gameSessionModel.deleteMany({ gameRoom: gameRoomId }).exec();
  }
}
