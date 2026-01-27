import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UserCompletedLogo } from '@logo-quiz/models';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService, TABLES } from './dynamodb.service';

// Note: This service is largely unused since UserState now tracks completed logos directly
// Keeping for backwards compatibility
@Injectable()
export class UserCompletedLogoService {
  constructor(@Inject(forwardRef(() => DynamoDBService)) private readonly dynamodb: DynamoDBService) {}

  async insert(stateId: string, logoId: string): Promise<UserCompletedLogo> {
    const now = new Date().toISOString();
    const record: UserCompletedLogo = {
      id: uuidv4(),
      stateId,
      logoId,
      createdAt: now,
      updatedAt: now,
    };

    // This could be stored in a separate table if needed
    // For now, we just return the record as UserState tracks logos
    return record;
  }

  async findByState(stateId: string): Promise<UserCompletedLogo[]> {
    // This is deprecated - use UserStateService.getUserLogos instead
    return [];
  }
}
