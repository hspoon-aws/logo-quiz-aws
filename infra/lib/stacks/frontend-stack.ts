import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface FrontendStackProps extends cdk.StackProps {
  prefix: string;
  apiUrl: string;
  webSocketUrl?: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly distributionUrl: string;
  public readonly bucketName: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { prefix, apiUrl, webSocketUrl } = props;

    // S3 Bucket for static website
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `${prefix.toLowerCase()}-frontend-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for ${prefix} frontend`,
    });

    // Grant CloudFront access to S3
    websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [websiteBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId),
        ],
      })
    );

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${prefix} Frontend Distribution`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      // Handle SPA routing - return index.html for 404s
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
      enableLogging: false,
    });

    this.distributionUrl = `https://${distribution.distributionDomainName}`;
    this.bucketName = websiteBucket.bucketName;

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 bucket for frontend assets',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: this.distributionUrl,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: apiUrl,
      description: 'API URL (for frontend config)',
    });

    if (webSocketUrl) {
      new cdk.CfnOutput(this, 'WebSocketUrl', {
        value: webSocketUrl,
        description: 'WebSocket API URL (for frontend config)',
      });
    }

    // Note about deployment
    new cdk.CfnOutput(this, 'DeployCommand', {
      value: `aws s3 sync dist/apps/logo-quiz s3://${websiteBucket.bucketName} --delete && aws cloudfront create-invalidation --distribution-id ${distribution.distributionId} --paths "/*"`,
      description: 'Command to deploy frontend',
    });
  }
}
