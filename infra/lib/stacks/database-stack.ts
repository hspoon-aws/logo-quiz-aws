import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  prefix: string;
}

export interface DatabaseTables {
  users: dynamodb.Table;
  levels: dynamodb.Table;
  logos: dynamodb.Table;
  userState: dynamodb.Table;
  gameRooms: dynamodb.Table;
  gameSessions: dynamodb.Table;
}

export class DatabaseStack extends cdk.Stack {
  public readonly tables: DatabaseTables;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { prefix } = props;

    // Users table
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `${prefix}-Users`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Levels table
    const levelsTable = new dynamodb.Table(this, 'LevelsTable', {
      tableName: `${prefix}-Levels`,
      partitionKey: { name: 'levelId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Logos table
    const logosTable = new dynamodb.Table(this, 'LogosTable', {
      tableName: `${prefix}-Logos`,
      partitionKey: { name: 'logoId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    logosTable.addGlobalSecondaryIndex({
      indexName: 'levelId-index',
      partitionKey: { name: 'levelId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // UserState table
    const userStateTable = new dynamodb.Table(this, 'UserStateTable', {
      tableName: `${prefix}-UserState`,
      partitionKey: { name: 'stateId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    userStateTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GameRooms table
    const gameRoomsTable = new dynamodb.Table(this, 'GameRoomsTable', {
      tableName: `${prefix}-GameRooms`,
      partitionKey: { name: 'roomCode', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Game rooms are ephemeral
      timeToLiveAttribute: 'ttl', // Auto-cleanup old rooms
    });

    // GameSessions table
    const gameSessionsTable = new dynamodb.Table(this, 'GameSessionsTable', {
      tableName: `${prefix}-GameSessions`,
      partitionKey: { name: 'roomCode', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'socketId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Sessions are ephemeral
      timeToLiveAttribute: 'ttl', // Auto-cleanup old sessions
    });

    this.tables = {
      users: usersTable,
      levels: levelsTable,
      logos: logosTable,
      userState: userStateTable,
      gameRooms: gameRoomsTable,
      gameSessions: gameSessionsTable,
    };

    // Outputs
    new cdk.CfnOutput(this, 'UsersTableName', { value: usersTable.tableName });
    new cdk.CfnOutput(this, 'LevelsTableName', { value: levelsTable.tableName });
    new cdk.CfnOutput(this, 'LogosTableName', { value: logosTable.tableName });
    new cdk.CfnOutput(this, 'UserStateTableName', { value: userStateTable.tableName });
    new cdk.CfnOutput(this, 'GameRoomsTableName', { value: gameRoomsTable.tableName });
    new cdk.CfnOutput(this, 'GameSessionsTableName', { value: gameSessionsTable.tableName });
  }
}
