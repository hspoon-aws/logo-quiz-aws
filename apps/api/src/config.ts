import * as dotenv from 'dotenv';

dotenv.config({ path: './apps/api/.env' });

export type EnvironmentName = 'production' | 'staging' | 'development';

interface Config {
  environment: EnvironmentName;
  version: string;
  isProduction: boolean;
  awsRegion: string;
  dynamoDbEndpoint?: string;
  dynamoDbTablePrefix: string;
  salt: string;
  session: {
    domain?: string;
    secret: string;
    timeout?: number;
  };
}

export const config: Partial<Config> = {
  environment: <EnvironmentName>process.env.NODE_ENV || 'development',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  dynamoDbEndpoint: process.env.DYNAMODB_ENDPOINT, // For local development
  dynamoDbTablePrefix: process.env.DYNAMODB_TABLE_PREFIX || 'LogoQuiz',
  salt: process.env.APP_SALT || 'mysalt',
  session: {
    secret: process.env.APP_SESSION_SECRET || 'mysecret',
  },
};
