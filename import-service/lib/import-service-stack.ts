import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as path from "path";

export class ImportServiceStack extends cdk.Stack {
  private importBucket: s3.IBucket;
  private importProductsFileLambda: lambda.Function;
  private importFileParserLambda: lambda.Function;
  private swaggerUi: lambda.Function;
  private sharedLayer: lambda.LayerVersion;
  private api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.createSharedLayer();
    this.createS3Bucket();
    this.createLambdaFunctions();
    this.setupS3Permissions();
    this.setupS3EventNotifications();
    this.createApiGateway();
    this.setupApiEndpoints();
    this.createOutputs();
  }

  private createSharedLayer(): void {
    this.sharedLayer = new lambda.LayerVersion(this, "NodeJsLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist/layers")),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Node.js dependencies layer",
    });
  }

  private createS3Bucket(): void {
    this.importBucket = s3.Bucket.fromBucketName(
      this,
      "ImportBucket",
      "import-service-bucket-fdrh6bfdj7klv"
    );
  }

  private createLambdaFunctions(): void {
    // Create Lambda function for importProductsFile
    this.importProductsFileLambda = new lambda.Function(
      this,
      "ImportProductsFileFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../dist/functions/import-products-file")
        ),
        environment: {
          BUCKET_NAME: this.importBucket.bucketName,
          REGION: this.region,
        },
      }
    );

    // Create the importFileParser Lambda function
    this.importFileParserLambda = new lambda.Function(
      this,
      "ImportFileParserFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../dist/functions/import-file-parser")
        ),
        environment: {
          REGION: this.region,
          BUCKET_NAME: this.importBucket.bucketName,
        },
        layers: [this.sharedLayer],
        timeout: cdk.Duration.seconds(30),
      }
    );

    // Create the Swagger UI Lambda function
    this.swaggerUi = new lambda.Function(this, "SwaggerUI", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/swagger-ui")
      ),
      layers: [this.sharedLayer],
    });
  }

  private setupS3Permissions(): void {
    this.importBucket.grantReadWrite(this.importProductsFileLambda);
    this.importBucket.grantReadWrite(this.importFileParserLambda);
  }

  private setupS3EventNotifications(): void {
    this.importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.importFileParserLambda),
      { prefix: "uploaded/" }
    );
  }

  private createApiGateway(): void {
    this.api = new apigateway.RestApi(this, "ImportServiceApi", {
      restApiName: "Import Service",
      description: "API for importing products from CSV files",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
  }

  private setupApiEndpoints(): void {
    // Create /import resource
    const importResource = this.api.root.addResource("import");

    // Add request parameter for fileName
    const importIntegration = new apigateway.LambdaIntegration(
      this.importProductsFileLambda,
      {
        requestParameters: {
          "integration.request.querystring.name":
            "method.request.querystring.name",
        },
      }
    );

    // Add GET method with required query parameter
    importResource.addMethod("GET", importIntegration, {
      requestParameters: {
        "method.request.querystring.name": true, // Required parameter
      },
    });

    // Swagger UI endpoint
    const docs = this.api.root.addResource("docs");
    docs.addMethod("GET", new apigateway.LambdaIntegration(this.swaggerUi));
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, "ImportServiceApiUrl", {
      value: this.api.url,
      description: "URL of the Import Service API",
    });

    new cdk.CfnOutput(this, "SwaggerUIDocsURL", {
      value: `${this.api.url}docs`,
      description: "Swagger UI URL",
    });
  }
}
