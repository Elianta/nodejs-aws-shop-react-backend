import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'path';

export class BffApiStack extends cdk.Stack {
  private api: apigateway.RestApi;
  private swaggerUi: lambda.Function;
  private sharedLayer: lambda.LayerVersion;
  private distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.createSharedLayer();
    this.createLambdaFunctions();
    this.createApiGateway();
    this.createCloudFront();
    this.createOutputs();
  }

  private createSharedLayer(): void {
    this.sharedLayer = new lambda.LayerVersion(this, 'NodeJsLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist-cdk/layers')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Node.js dependencies layer',
    });
  }

  private createLambdaFunctions(): void {
    this.swaggerUi = new lambda.Function(this, 'SwaggerUI', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../dist-cdk/functions/swagger-ui'),
      ),
      layers: [this.sharedLayer],
    });
  }

  private createApiGateway(): void {
    this.api = new apigateway.RestApi(this, 'BffApi');

    // Swagger UI endpoint
    const docs = this.api.root.addResource('docs');
    docs.addMethod('GET', new apigateway.LambdaIntegration(this.swaggerUi));
  }

  private createCloudFront(): void {
    this.distribution = new cloudfront.Distribution(
      this,
      'BffApiDistribution',
      {
        defaultBehavior: {
          origin: new origins.HttpOrigin(process.env.BFF_API_EB_URL as string, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        enabled: true,
      },
    );

    this.distribution.addBehavior(
      '/docs',
      new origins.RestApiOrigin(this.api),
      {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    );
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'BffApiDocs', {
      value: `${this.api.url}docs`,
      description: 'Bff API documentation URL',
    });

    new cdk.CfnOutput(this, 'CloudFrontApiUrl', {
      value: `https://${this.distribution.distributionDomainName}/`,
      description: 'Bff CloudFront API URL',
    });
  }
}
