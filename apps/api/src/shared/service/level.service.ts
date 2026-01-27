import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Level } from '@logo-quiz/models';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService, TABLES } from './dynamodb.service';
import { LogoService } from './logo.service';

@Injectable()
export class LevelService {
  constructor(
    @Inject(forwardRef(() => DynamoDBService)) private readonly dynamodb: DynamoDBService,
    @Inject(forwardRef(() => LogoService)) private readonly logoService: LogoService,
  ) {}

  async create(createLevelDto: Partial<Level>): Promise<Level> {
    const now = new Date().toISOString();
    const newLevel: Level = {
      levelId: uuidv4(),
      difficulty: createLevelDto.difficulty || 1,
      name: createLevelDto.name || '',
      scoreToUnlock: createLevelDto.scoreToUnlock || 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamodb.put({
      TableName: TABLES.LEVELS,
      Item: newLevel,
    });

    return newLevel;
  }

  async findAll(): Promise<Level[]> {
    const levels = await this.dynamodb.scan<Level>({
      TableName: TABLES.LEVELS,
    });

    // Sort by difficulty
    levels.sort((a, b) => a.difficulty - b.difficulty);

    // Populate logos for each level
    for (const level of levels) {
      level.logos = await this.logoService.findAllByLevel(level.levelId);
    }

    return levels;
  }

  async findOne(levelId: string, projection?: string): Promise<Level | null> {
    const level = await this.dynamodb.get<Level>({
      TableName: TABLES.LEVELS,
      Key: { levelId },
    });

    if (level) {
      level.logos = await this.logoService.findAllByLevel(levelId, projection);
    }

    return level;
  }
}
