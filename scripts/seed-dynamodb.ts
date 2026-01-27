/**
 * DynamoDB Seed Script
 *
 * This script creates DynamoDB tables and seeds them with initial data.
 * Run with: npx tsx scripts/seed-dynamodb.ts
 *
 * Environment variables:
 * - AWS_REGION: AWS region (default: us-east-1)
 * - DYNAMODB_ENDPOINT: Local DynamoDB endpoint (for local development)
 * - DYNAMODB_TABLE_PREFIX: Table name prefix (default: LogoQuiz)
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT;
const TABLE_PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'LogoQuiz';

// Table names
const TABLES = {
  USERS: `${TABLE_PREFIX}-Users`,
  LEVELS: `${TABLE_PREFIX}-Levels`,
  LOGOS: `${TABLE_PREFIX}-Logos`,
  USER_STATE: `${TABLE_PREFIX}-UserState`,
  GAME_ROOMS: `${TABLE_PREFIX}-GameRooms`,
  GAME_SESSIONS: `${TABLE_PREFIX}-GameSessions`,
};

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: AWS_REGION,
  ...(DYNAMODB_ENDPOINT && {
    endpoint: DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  }),
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

// Table definitions
const tableDefinitions = [
  {
    TableName: TABLES.USERS,
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: TABLES.LEVELS,
    KeySchema: [{ AttributeName: 'levelId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'levelId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: TABLES.LOGOS,
    KeySchema: [{ AttributeName: 'logoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'logoId', AttributeType: 'S' },
      { AttributeName: 'levelId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'levelId-index',
        KeySchema: [{ AttributeName: 'levelId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: TABLES.USER_STATE,
    KeySchema: [{ AttributeName: 'stateId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'stateId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-index',
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: TABLES.GAME_ROOMS,
    KeySchema: [{ AttributeName: 'roomCode', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'roomCode', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: TABLES.GAME_SESSIONS,
    KeySchema: [
      { AttributeName: 'roomCode', KeyType: 'HASH' },
      { AttributeName: 'socketId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'roomCode', AttributeType: 'S' },
      { AttributeName: 'socketId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function tableExists(tableName: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }
    throw error;
  }
}

async function createTables(): Promise<void> {
  console.log('Creating DynamoDB tables...\n');

  for (const tableDefinition of tableDefinitions) {
    const tableName = tableDefinition.TableName;

    if (await tableExists(tableName)) {
      console.log(`✓ Table ${tableName} already exists`);
      continue;
    }

    try {
      await client.send(new CreateTableCommand(tableDefinition as any));
      console.log(`✓ Created table ${tableName}`);

      // Wait for table to be active
      let isActive = false;
      while (!isActive) {
        const response = await client.send(new DescribeTableCommand({ TableName: tableName }));
        isActive = response.Table?.TableStatus === 'ACTIVE';
        if (!isActive) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error(`✗ Error creating table ${tableName}:`, error);
      throw error;
    }
  }

  console.log('\nAll tables created successfully!\n');
}

function processIconPath(iconPath: string, levelId: string) {
  const sessions = iconPath.split('/');
  const filename = sessions[4];
  if (!filename) return null;

  // Extract service name from filename
  let serviceName = filename.split('_')[1];
  if (!serviceName) return null;

  serviceName = serviceName
    .replace('AWS-', '')
    .replace('Amazon-', '')
    .replace('.png', '')
    .replace(/-/g, ' ');

  // Generate scrambled letters
  const letters = serviceName
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');

  const now = new Date().toISOString();

  return {
    logoId: uuidv4(),
    levelId,
    obfuscatedImageUrl: iconPath,
    realImageUrl: iconPath,
    name: serviceName.toLowerCase(),
    letters: letters.replace(/ /g, '').toLowerCase(),
    createdAt: now,
    updatedAt: now,
  };
}

async function seedLevelsAndLogos(): Promise<void> {
  console.log('Seeding levels and logos...\n');

  // Read icon paths
  const iconPathFile = path.join(__dirname, '../docker/api/icon_path_64.txt');
  if (!fs.existsSync(iconPathFile)) {
    console.error('Icon path file not found:', iconPathFile);
    console.log('Skipping logo seeding...');
    return;
  }

  const iconPaths = fs
    .readFileSync(iconPathFile, 'utf8')
    .split('\n')
    .filter((p) => p.trim())
    .sort((a, b) => a.length - b.length);

  console.log(`Found ${iconPaths.length} icon paths`);

  const now = new Date().toISOString();

  // Create levels
  const levels = [
    {
      levelId: uuidv4(),
      difficulty: 1,
      name: 'Level 1',
      scoreToUnlock: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      levelId: uuidv4(),
      difficulty: 2,
      name: 'Level 2',
      scoreToUnlock: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      levelId: uuidv4(),
      difficulty: 3,
      name: 'Level 3',
      scoreToUnlock: 2,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Insert levels
  for (const level of levels) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.LEVELS,
        Item: level,
      }),
    );
    console.log(`✓ Created level: ${level.name}`);
  }

  // Process logos for each level
  const levelLogos = [
    { levelId: levels[0].levelId, start: 0, end: 30 },
    { levelId: levels[1].levelId, start: 30, end: 80 },
    { levelId: levels[2].levelId, start: 80, end: 200 },
  ];

  for (const { levelId, start, end } of levelLogos) {
    const logos = iconPaths
      .slice(start, Math.min(end, iconPaths.length))
      .map((path) => processIconPath(path, levelId))
      .filter((logo) => logo !== null);

    // Batch write logos (25 at a time)
    const BATCH_SIZE = 25;
    for (let i = 0; i < logos.length; i += BATCH_SIZE) {
      const batch = logos.slice(i, i + BATCH_SIZE);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLES.LOGOS]: batch.map((logo) => ({
              PutRequest: { Item: logo },
            })),
          },
        }),
      );
    }

    console.log(`✓ Created ${logos.length} logos for level ${levelId}`);
  }

  console.log('\nLevels and logos seeded successfully!\n');
}

async function seedTestUser(): Promise<void> {
  console.log('Seeding test user...\n');

  const salt = process.env.APP_SALT || 'mysalt';
  const password = crypto.createHmac('sha256', salt).update('testing').digest('hex');
  const now = new Date().toISOString();

  const userId = uuidv4();
  const user = {
    userId,
    email: 'quiz@gmail.com',
    password,
    name: 'Test User',
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.USERS,
      Item: user,
    }),
  );

  // Create user state
  const userState = {
    stateId: uuidv4(),
    userId,
    logos: [],
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.USER_STATE,
      Item: userState,
    }),
  );

  console.log(`✓ Created test user: ${user.email}`);
  console.log('\nTest user seeded successfully!\n');
}

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('DynamoDB Seed Script');
  console.log('='.repeat(50));
  console.log(`Region: ${AWS_REGION}`);
  console.log(`Endpoint: ${DYNAMODB_ENDPOINT || 'AWS (default)'}`);
  console.log(`Table Prefix: ${TABLE_PREFIX}`);
  console.log('='.repeat(50));
  console.log();

  try {
    await createTables();
    await seedLevelsAndLogos();
    await seedTestUser();

    console.log('='.repeat(50));
    console.log('Seeding completed successfully!');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

main();
