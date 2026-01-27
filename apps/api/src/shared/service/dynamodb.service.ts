import { Injectable } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

// Table name prefix for environment isolation
const TABLE_PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'LogoQuiz';

// Table names
export const TABLES = {
  USERS: `${TABLE_PREFIX}-Users`,
  LEVELS: `${TABLE_PREFIX}-Levels`,
  LOGOS: `${TABLE_PREFIX}-Logos`,
  USER_STATE: `${TABLE_PREFIX}-UserState`,
  GAME_ROOMS: `${TABLE_PREFIX}-GameRooms`,
  GAME_SESSIONS: `${TABLE_PREFIX}-GameSessions`,
} as const;

@Injectable()
export class DynamoDBService {
  private readonly docClient: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      // For local development with DynamoDB Local
      ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT,
        credentials: {
          accessKeyId: 'local',
          secretAccessKey: 'local',
        },
      }),
    });

    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });
  }

  async get<T>(params: GetCommandInput): Promise<T | null> {
    const result = await this.docClient.send(new GetCommand(params));
    return (result.Item as T) || null;
  }

  async put<T>(params: PutCommandInput): Promise<T> {
    await this.docClient.send(new PutCommand(params));
    return params.Item as T;
  }

  async update<T>(params: UpdateCommandInput): Promise<T | null> {
    const result = await this.docClient.send(new UpdateCommand(params));
    return (result.Attributes as T) || null;
  }

  async delete(params: DeleteCommandInput): Promise<void> {
    await this.docClient.send(new DeleteCommand(params));
  }

  async query<T>(params: QueryCommandInput): Promise<T[]> {
    const result = await this.docClient.send(new QueryCommand(params));
    return (result.Items as T[]) || [];
  }

  async scan<T>(params: ScanCommandInput): Promise<T[]> {
    const items: T[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const result = await this.docClient.send(
        new ScanCommand({
          ...params,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );
      items.push(...((result.Items as T[]) || []));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  }

  async batchWrite(params: BatchWriteCommandInput): Promise<void> {
    await this.docClient.send(new BatchWriteCommand(params));
  }

  // Helper to batch write with automatic chunking (DynamoDB limit is 25 items per batch)
  async batchWriteAll(tableName: string, items: Record<string, any>[]): Promise<void> {
    const BATCH_SIZE = 25;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await this.batchWrite({
        RequestItems: {
          [tableName]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      });
    }
  }
}
