import { Injectable, Inject, forwardRef } from '@nestjs/common';
import {
  GameSession,
  GameAnswer,
  PlayerScore,
  FinalScoreboardDto,
} from '@logo-quiz/models';
import { DynamoDBService, TABLES } from './dynamodb.service';

@Injectable()
export class GameSessionService {
  constructor(@Inject(forwardRef(() => DynamoDBService)) private readonly dynamodb: DynamoDBService) {}

  async createSession(
    roomCode: string,
    socketId: string,
    displayName: string,
    userId?: string,
  ): Promise<GameSession> {
    // Check if session already exists
    const existingSession = await this.findByRoomAndSocket(roomCode, socketId);
    if (existingSession) {
      return existingSession;
    }

    const now = new Date().toISOString();
    const session: GameSession = {
      roomCode,
      socketId,
      userId: userId || undefined,
      displayName,
      score: 0,
      answers: [],
      correctAnswers: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamodb.put({
      TableName: TABLES.GAME_SESSIONS,
      Item: session,
    });

    return session;
  }

  async findByRoomAndSocket(roomCode: string, socketId: string): Promise<GameSession | null> {
    return this.dynamodb.get<GameSession>({
      TableName: TABLES.GAME_SESSIONS,
      Key: { roomCode, socketId },
    });
  }

  async findAllByRoom(roomCode: string): Promise<GameSession[]> {
    return this.dynamodb.query<GameSession>({
      TableName: TABLES.GAME_SESSIONS,
      KeyConditionExpression: 'roomCode = :roomCode',
      ExpressionAttributeValues: {
        ':roomCode': roomCode,
      },
    });
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
    roomCode: string,
    socketId: string,
    logoId: string,
    correct: boolean,
    timeTaken: number,
    totalGameTime: number,
  ): Promise<{ session: GameSession; points: number }> {
    const session = await this.findByRoomAndSocket(roomCode, socketId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if already answered this logo
    const alreadyAnswered = session.answers.some((a) => a.logoId === logoId);
    if (alreadyAnswered) {
      return { session, points: 0 };
    }

    // Calculate points: positive for correct, negative penalty for wrong
    const wrongAnswerPenalty = 100;
    const points = correct ? this.calculatePoints(timeTaken, totalGameTime) : -wrongAnswerPenalty;

    const answer: GameAnswer = {
      logoId,
      correct,
      timeTaken,
      points,
      answeredAt: new Date().toISOString(),
    };

    session.answers.push(answer);
    if (correct) {
      session.score += points;
      session.correctAnswers++;
    } else {
      // Deduct points for wrong answer, but don't go below 0
      session.score = Math.max(0, session.score + points);
    }

    await this.dynamodb.update({
      TableName: TABLES.GAME_SESSIONS,
      Key: { roomCode, socketId },
      UpdateExpression:
        'SET answers = :answers, score = :score, correctAnswers = :correctAnswers, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':answers': session.answers,
        ':score': session.score,
        ':correctAnswers': session.correctAnswers,
        ':updatedAt': new Date().toISOString(),
      },
    });

    return { session, points };
  }

  async getLeaderboard(roomCode: string): Promise<PlayerScore[]> {
    const sessions = await this.findAllByRoom(roomCode);
    return sessions
      .map((s) => ({
        displayName: s.displayName,
        score: s.score,
        correctAnswers: s.correctAnswers,
      }))
      .sort((a, b) => b.score - a.score);
  }

  async finalizeSessions(roomCode: string, gameTime: number, totalLogos: number): Promise<FinalScoreboardDto> {
    const sessions = await this.findAllByRoom(roomCode);
    const sortedSessions = sessions.sort((a, b) => b.score - a.score);

    // Update final ranks
    for (let i = 0; i < sortedSessions.length; i++) {
      sortedSessions[i].finalRank = i + 1;
      await this.dynamodb.update({
        TableName: TABLES.GAME_SESSIONS,
        Key: { roomCode, socketId: sortedSessions[i].socketId },
        UpdateExpression: 'SET finalRank = :rank, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':rank': i + 1,
          ':updatedAt': new Date().toISOString(),
        },
      });
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

  async deleteSessionsByRoom(roomCode: string): Promise<void> {
    const sessions = await this.findAllByRoom(roomCode);
    for (const session of sessions) {
      await this.dynamodb.delete({
        TableName: TABLES.GAME_SESSIONS,
        Key: { roomCode, socketId: session.socketId },
      });
    }
  }
}
