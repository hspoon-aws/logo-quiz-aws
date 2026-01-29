import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { DatabaseTables } from './database-stack';

export interface ApiStackProps extends cdk.StackProps {
  prefix: string;
  tables: DatabaseTables;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { prefix, tables } = props;

    // ECR Repository for API container
    this.repository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: `${prefix.toLowerCase()}-api`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 5,
          description: 'Keep only 5 images',
        },
      ],
    });

    // Secrets for API
    const appSecrets = new secretsmanager.Secret(this, 'AppSecrets', {
      secretName: `${prefix}/api-secrets`,
      description: 'Logo Quiz API secrets',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          APP_SALT: 'change-me-in-console',
          APP_SESSION_SECRET: 'change-me-in-console',
        }),
        generateStringKey: 'generated',
      },
    });

    // IAM Role for App Runner
    const instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'Role for Logo Quiz App Runner instance',
    });

    // Grant DynamoDB access
    tables.users.grantReadWriteData(instanceRole);
    tables.levels.grantReadData(instanceRole);
    tables.logos.grantReadData(instanceRole);
    tables.userState.grantReadWriteData(instanceRole);
    tables.gameRooms.grantReadWriteData(instanceRole);
    tables.gameSessions.grantReadWriteData(instanceRole);

    // Grant secrets access
    appSecrets.grantRead(instanceRole);

    // IAM Role for App Runner to access ECR
    const accessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      description: 'Role for App Runner to access ECR',
    });
    this.repository.grantPull(accessRole);

    // Check if we should create App Runner (only after image is pushed)
    const createAppRunner = this.node.tryGetContext('createAppRunner') !== 'false';

    if (createAppRunner) {
      // App Runner Service
      const appRunnerService = new apprunner.CfnService(this, 'ApiService', {
        serviceName: `${prefix}-api`,
        sourceConfiguration: {
          authenticationConfiguration: {
            accessRoleArn: accessRole.roleArn,
          },
          autoDeploymentsEnabled: true,
          imageRepository: {
            imageIdentifier: `${this.repository.repositoryUri}:latest`,
            imageRepositoryType: 'ECR',
            imageConfiguration: {
              port: '3333',
              runtimeEnvironmentVariables: [
                { name: 'NODE_ENV', value: 'production' },
                { name: 'AWS_REGION', value: this.region },
                { name: 'DYNAMODB_TABLE_PREFIX', value: prefix },
                { name: 'PORT', value: '3333' },
              ],
              runtimeEnvironmentSecrets: [
                {
                  name: 'APP_SALT',
                  value: `${appSecrets.secretArn}:APP_SALT::`,
                },
                {
                  name: 'APP_SESSION_SECRET',
                  value: `${appSecrets.secretArn}:APP_SESSION_SECRET::`,
                },
              ],
            },
          },
        },
        instanceConfiguration: {
          cpu: '0.25 vCPU',
          memory: '0.5 GB',
          instanceRoleArn: instanceRole.roleArn,
        },
        healthCheckConfiguration: {
          protocol: 'HTTP',
          path: '/api/health',
          interval: 10,
          timeout: 5,
          healthyThreshold: 1,
          unhealthyThreshold: 5,
        },
        networkConfiguration: {
          egressConfiguration: {
            egressType: 'DEFAULT',
          },
        },
      });

      this.apiUrl = `https://${appRunnerService.attrServiceUrl}`;
    } else {
      this.apiUrl = 'https://placeholder-deploy-image-first.aws';
    }

    // Outputs
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'ECR Repository URI for API image',
    });

    new cdk.CfnOutput(this, 'ApiServiceUrl', {
      value: this.apiUrl,
      description: 'App Runner API URL',
    });

    new cdk.CfnOutput(this, 'SecretsArn', {
      value: appSecrets.secretArn,
      description: 'Secrets Manager ARN (update secrets in console)',
    });
  }
}
