#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from './stacks/database-stack';
import { ApiStack } from './stacks/api-stack';
import { FrontendStack } from './stacks/frontend-stack';
import { CodeBuildStack } from './stacks/codebuild-stack';
import { WebSocketStack } from './stacks/websocket-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack naming prefix
const prefix = app.node.tryGetContext('prefix') || 'LogoQuiz';

// Database Stack - DynamoDB tables
const databaseStack = new DatabaseStack(app, `${prefix}Database`, {
  env,
  prefix,
  description: 'Logo Quiz - DynamoDB Tables',
});

// API Stack - App Runner + ECR
const apiStack = new ApiStack(app, `${prefix}Api`, {
  env,
  prefix,
  tables: databaseStack.tables,
  description: 'Logo Quiz - API (App Runner)',
});
apiStack.addDependency(databaseStack);

// CodeBuild Stack - Build Docker images
const codeBuildStack = new CodeBuildStack(app, `${prefix}CodeBuild`, {
  env,
  prefix,
  repository: apiStack.repository,
  description: 'Logo Quiz - CodeBuild for Docker images',
});
codeBuildStack.addDependency(apiStack);

// WebSocket Stack - API Gateway WebSocket
const webSocketStack = new WebSocketStack(app, `${prefix}WebSocket`, {
  env,
  prefix,
  tables: databaseStack.tables,
  description: 'Logo Quiz - WebSocket API (API Gateway)',
});
webSocketStack.addDependency(databaseStack);

// Frontend Stack - S3 + CloudFront
const frontendStack = new FrontendStack(app, `${prefix}Frontend`, {
  env,
  prefix,
  apiUrl: apiStack.apiUrl,
  webSocketUrl: webSocketStack.webSocketUrl,
  description: 'Logo Quiz - Frontend (S3 + CloudFront)',
});
frontendStack.addDependency(apiStack);
frontendStack.addDependency(webSocketStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'LogoQuiz');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
