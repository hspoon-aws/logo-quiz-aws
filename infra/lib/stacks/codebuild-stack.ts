import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CodeBuildStackProps extends cdk.StackProps {
  prefix: string;
  repository: ecr.IRepository;
}

export class CodeBuildStack extends cdk.Stack {
  public readonly project: codebuild.Project;
  public readonly sourceBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CodeBuildStackProps) {
    super(scope, id, props);

    const { prefix, repository } = props;

    // S3 bucket for source code
    this.sourceBucket = new s3.Bucket(this, 'SourceBucket', {
      bucketName: `${prefix.toLowerCase()}-codebuild-source-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // CodeBuild project
    this.project = new codebuild.Project(this, 'ApiImageBuild', {
      projectName: `${prefix}-api-build`,
      description: 'Build Logo Quiz API Docker image',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true, // Required for Docker builds
      },
      source: codebuild.Source.s3({
        bucket: this.sourceBucket,
        path: 'source.zip',
      }),
      environmentVariables: {
        AWS_DEFAULT_REGION: {
          value: this.region,
        },
        AWS_ACCOUNT_ID: {
          value: this.account,
        },
        IMAGE_REPO_NAME: {
          value: repository.repositoryName,
        },
        IMAGE_TAG: {
          value: 'latest',
        },
      },
      timeout: cdk.Duration.minutes(30),
    });

    // Grant ECR permissions
    repository.grantPullPush(this.project);

    // Grant ECR login permissions
    this.project.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));

    // Outputs
    new cdk.CfnOutput(this, 'ProjectName', {
      value: this.project.projectName,
      description: 'CodeBuild project name',
    });

    new cdk.CfnOutput(this, 'SourceBucketName', {
      value: this.sourceBucket.bucketName,
      description: 'S3 bucket for source code',
    });
  }
}
