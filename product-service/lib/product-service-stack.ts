import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Import existing DynamoDB tables
    const productsTable = dynamodb.Table.fromTableName(
      this,
      "ProductsTable",
      "products"
    );

    const stocksTable = dynamodb.Table.fromTableName(
      this,
      "StocksTable",
      "stocks"
    );

    const sharedLayer = new lambda.LayerVersion(this, "NodeJsLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist/layers")),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Node.js dependencies layer",
    });

    // Common environment variables for Lambda functions
    const lambdaEnv = {
      PRODUCTS_TABLE_NAME: productsTable.tableName,
      STOCKS_TABLE_NAME: stocksTable.tableName,
      REGION: cdk.Stack.of(this).region,
    };

    // Create Lambda functions
    const getProductsList = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/get-products-list")
      ),
      layers: [sharedLayer],
      environment: lambdaEnv,
    });

    const getProductById = new lambda.Function(this, "getProductById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/get-product-by-id")
      ),
      layers: [sharedLayer],
    });

    // Grant permissions to Lambda functions
    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    // Create Swagger UI Lambda
    const swaggerUi = new lambda.Function(this, "SwaggerUI", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/swagger-ui")
      ),
      layers: [sharedLayer],
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create resources and methods
    const products = api.root.addResource("products");
    products.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsList)
    );

    new cdk.CfnOutput(this, "ProductsListURL", {
      value: `${api.url}products`,
      description: "Products list URL",
    });

    const product = products.addResource("{productId}");
    product.addMethod("GET", new apigateway.LambdaIntegration(getProductById));

    new cdk.CfnOutput(this, "ProductByIdURL", {
      value: `${api.url}products/{productId}`,
      description: "Product by ID URL",
    });

    const docs = api.root.addResource("docs");
    docs.addMethod("GET", new apigateway.LambdaIntegration(swaggerUi));

    new cdk.CfnOutput(this, "SwaggerUIDocsURL", {
      value: `${api.url}docs`,
      description: "Swagger UI URL",
    });
  }
}
