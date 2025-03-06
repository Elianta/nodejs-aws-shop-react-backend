import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as path from "path";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference the existing S3 bucket (created manually in console)
    const importBucket = s3.Bucket.fromBucketName(
      this,
      "ImportBucket",
      "import-service-bucket-fdrh6bfdj7klv"
    );

    // Create Lambda function for importProductsFile
    const importProductsFileLambda = new lambda.Function(
      this,
      "ImportProductsFileFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../dist/functions/import-products-file")
        ),
        environment: {
          BUCKET_NAME: importBucket.bucketName,
          REGION: this.region,
        },
      }
    );

    // Grant permissions to the Lambda to generate signed URLs for the S3 bucket
    importBucket.grantReadWrite(importProductsFileLambda);

    // Create API Gateway
    const api = new apigateway.RestApi(this, "ImportServiceApi", {
      restApiName: "Import Service",
      description: "API for importing products from CSV files",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create /import resource
    const importResource = api.root.addResource("import");

    // Add request parameter for fileName
    const importIntegration = new apigateway.LambdaIntegration(
      importProductsFileLambda,
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

    // Output the API URL
    new cdk.CfnOutput(this, "ImportServiceApiUrl", {
      value: api.url,
      description: "URL of the Import Service API",
    });
  }
}
