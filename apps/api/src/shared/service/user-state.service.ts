import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UserState, Logo } from '@logo-quiz/models';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService, TABLES } from './dynamodb.service';

@Injectable()
export class UserStateService {
  constructor(@Inject(forwardRef(() => DynamoDBService)) private readonly dynamodb: DynamoDBService) {}

  async insert(userId: string): Promise<UserState> {
    const now = new Date().toISOString();
    const newState: UserState = {
      stateId: uuidv4(),
      userId,
      logos: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamodb.put({
      TableName: TABLES.USER_STATE,
      Item: newState,
    });

    return newState;
  }

  async findByUser(userId: string): Promise<UserState | null> {
    const states = await this.dynamodb.query<UserState>({
      TableName: TABLES.USER_STATE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    return states.length > 0 ? states[0] : null;
  }

  async verifyValidatedLogo(logoId: string, userId: string): Promise<boolean> {
    const logos = await this.getUserLogos(userId);
    return logos.includes(logoId);
  }

  async insertLogo(userId: string, logo: Logo): Promise<UserState | null> {
    const state = await this.findByUser(userId);
    if (!state) return null;

    // Add logo to the list if not already present
    if (!state.logos.includes(logo.logoId)) {
      state.logos.push(logo.logoId);

      await this.dynamodb.update({
        TableName: TABLES.USER_STATE,
        Key: { stateId: state.stateId },
        UpdateExpression: 'SET logos = :logos, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':logos': state.logos,
          ':updatedAt': new Date().toISOString(),
        },
      });
    }

    return state;
  }

  async getUserLogos(userId: string): Promise<string[]> {
    const state = await this.findByUser(userId);
    return state?.logos || [];
  }
}
