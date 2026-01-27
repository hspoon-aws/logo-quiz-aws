import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { User } from '@logo-quiz/models';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService, TABLES } from './dynamodb.service';
import { passwordHash } from '../utils/password-hash';

@Injectable()
export class UserService {
  constructor(@Inject(forwardRef(() => DynamoDBService)) private readonly dynamodb: DynamoDBService) {}

  async create(user: Partial<User>): Promise<User> {
    const now = new Date().toISOString();
    const newUser: User = {
      userId: uuidv4(),
      email: user.email || '',
      password: user.password || '',
      name: user.name || '',
      lastAccessAt: new Date(),
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamodb.put({
      TableName: TABLES.USERS,
      Item: newUser,
    });

    return newUser;
  }

  async findAll(): Promise<User[]> {
    return this.dynamodb.scan<User>({
      TableName: TABLES.USERS,
    });
  }

  async findOne(userId: string): Promise<User | null> {
    return this.dynamodb.get<User>({
      TableName: TABLES.USERS,
      Key: { userId },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = await this.dynamodb.query<User>({
      TableName: TABLES.USERS,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
    });
    return users.length > 0 ? users[0] : null;
  }

  async findOneAndUpdate(userId: string, payload: Partial<User> = {}): Promise<User | null> {
    const updateExpressions: string[] = ['updatedAt = :updatedAt'];
    const expressionValues: Record<string, any> = {
      ':updatedAt': new Date().toISOString(),
    };

    Object.entries(payload).forEach(([key, value]) => {
      if (key !== 'userId' && value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionValues[`:${key}`] = value;
      }
    });

    const expressionNames: Record<string, string> = {};
    Object.keys(payload).forEach((key) => {
      if (key !== 'userId') {
        expressionNames[`#${key}`] = key;
      }
    });

    return this.dynamodb.update<User>({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionValues,
      ...(Object.keys(expressionNames).length > 0 && {
        ExpressionAttributeNames: expressionNames,
      }),
      ReturnValues: 'ALL_NEW',
    });
  }

  async login(credentials: { email: string; password: string }): Promise<User> {
    const hashedPassword = passwordHash(credentials.password);

    // Query by email using GSI
    const users = await this.dynamodb.query<User>({
      TableName: TABLES.USERS,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': credentials.email,
      },
    });

    const user = users.find((u) => u.password === hashedPassword);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async signup(credentials: { email: string; password: string }): Promise<User> {
    const now = new Date().toISOString();
    const newUser: User = {
      userId: uuidv4(),
      email: credentials.email,
      password: passwordHash(credentials.password),
      name: '',
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamodb.put({
      TableName: TABLES.USERS,
      Item: newUser,
      ConditionExpression: 'attribute_not_exists(userId)',
    });

    return newUser;
  }
}
