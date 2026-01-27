import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Level, Logo, UserState } from '@logo-quiz/models';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService, TABLES } from './dynamodb.service';

@Injectable()
export class LogoService {
  constructor(@Inject(forwardRef(() => DynamoDBService)) private readonly dynamodb: DynamoDBService) {}

  async create(createLogoDto: Partial<Logo>): Promise<Logo> {
    const now = new Date().toISOString();
    const newLogo: Logo = {
      logoId: uuidv4(),
      levelId: createLogoDto.levelId || '',
      obfuscatedImageUrl: createLogoDto.obfuscatedImageUrl || '',
      realImageUrl: createLogoDto.realImageUrl || '',
      name: createLogoDto.name || '',
      letters: createLogoDto.letters || '',
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamodb.put({
      TableName: TABLES.LOGOS,
      Item: newLogo,
    });

    return newLogo;
  }

  async findAll(): Promise<Logo[]> {
    return this.dynamodb.scan<Logo>({
      TableName: TABLES.LOGOS,
    });
  }

  async findAllByLevel(levelId: string, projection?: string): Promise<Logo[]> {
    const logos = await this.dynamodb.query<Logo>({
      TableName: TABLES.LOGOS,
      IndexName: 'levelId-index',
      KeyConditionExpression: 'levelId = :levelId',
      ExpressionAttributeValues: {
        ':levelId': levelId,
      },
    });

    // Apply projection if specified (filter out sensitive fields)
    if (projection === 'obfuscatedImageUrl') {
      return logos.map((logo) => ({
        logoId: logo.logoId,
        levelId: logo.levelId,
        obfuscatedImageUrl: logo.obfuscatedImageUrl,
        letters: logo.letters,
        name: logo.name, // Include name for answer validation
        realImageUrl: '', // Hide real URL
        createdAt: logo.createdAt,
        updatedAt: logo.updatedAt,
      }));
    }

    return logos;
  }

  async findOne(logoId: string): Promise<Logo | null> {
    return this.dynamodb.get<Logo>({
      TableName: TABLES.LOGOS,
      Key: { logoId },
    });
  }

  findNextInvalidLogo(currentLogo: Logo, level: Level, state: UserState): Logo | null {
    if (!level.logos || level.logos.length === 0) return null;

    let nextLogo: Logo | null = null;
    // Find index of current logo
    let index = level.logos.findIndex((item) => item.logoId === currentLogo.logoId) + 1;
    let loop = 0;

    while (nextLogo === null && loop < level.logos.length) {
      // Make sure index wraps around
      index = index >= level.logos.length ? 0 : index;
      const item = level.logos[index];

      // Check if logo is not already completed by user
      if (!state.logos.includes(item.logoId)) {
        nextLogo = item;
      }
      index++;
      loop++;
    }

    return nextLogo;
  }

  async findAllCount(): Promise<number> {
    const logos = await this.dynamodb.scan<Logo>({
      TableName: TABLES.LOGOS,
      Select: 'COUNT',
    });
    // When using Select: 'COUNT', we need to get the count differently
    // Actually scan returns items, so let's just count them
    const allLogos = await this.findAll();
    return allLogos.length;
  }

  async isGameCompleted(state: UserState): Promise<boolean> {
    const totalCount = await this.findAllCount();
    return totalCount === state.logos.length;
  }

  async getValidLogos(level: Level, state: UserState): Promise<number> {
    if (!level.logos) return 0;
    return level.logos.reduce((total: number, logo: Logo) => {
      return state.logos.includes(logo.logoId) ? total + 1 : total;
    }, 0);
  }
}
