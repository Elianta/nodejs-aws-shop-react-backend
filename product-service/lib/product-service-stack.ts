import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface LambdaConfig {
  id: string;
  handlerPath: string;
  permissions: {
    productsTable: "read" | "write" | "both";
    stocksTable: "read" | "write" | "both";
  };
}

export class ProductServiceStack extends cdk.Stack {
  private productsTable: dynamodb.ITable;
  private stocksTable: dynamodb.ITable;
  private sharedLayer: lambda.LayerVersion;
  private lambdaEnv: Record<string, string>;
  private api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.initializeDynamoDbTables();
    this.createSharedLayer();
    this.setupLambdaEnvironment();
    this.createApiGateway();

    const lambdaFunctions = this.createLambdaFunctions();
    this.setupApiEndpoints(lambdaFunctions);
    this.createOutputs();
  }

  private initializeDynamoDbTables(): void {
    // Import existing DynamoDB tables
    this.productsTable = dynamodb.Table.fromTableName(
      this,
      "ProductsTable",
      "products"
    );

    this.stocksTable = dynamodb.Table.fromTableName(
      this,
      "StocksTable",
      "stocks"
    );
  }

  private createSharedLayer(): void {
    this.sharedLayer = new lambda.LayerVersion(this, "NodeJsLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist/layers")),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Node.js dependencies layer",
    });
  }

  private setupLambdaEnvironment(): void {
    // Common environment variables for Lambda functions
    this.lambdaEnv = {
      PRODUCTS_TABLE_NAME: this.productsTable.tableName,
      STOCKS_TABLE_NAME: this.stocksTable.tableName,
      REGION: cdk.Stack.of(this).region,
    };
  }

  private createApiGateway(): void {
    this.api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
  }

  private createLambdaFunction(config: LambdaConfig): lambda.Function {
    const lambdaFunction = new lambda.Function(this, config.id, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, `../dist/functions/${config.handlerPath}`)
      ),
      layers: [this.sharedLayer],
      environment: this.lambdaEnv,
    });

    // Grant permissions based on configuration
    if (
      config.permissions.productsTable === "read" ||
      config.permissions.productsTable === "both"
    ) {
      this.productsTable.grantReadData(lambdaFunction);
    }
    if (
      config.permissions.productsTable === "write" ||
      config.permissions.productsTable === "both"
    ) {
      this.productsTable.grantWriteData(lambdaFunction);
    }
    if (
      config.permissions.stocksTable === "read" ||
      config.permissions.stocksTable === "both"
    ) {
      this.stocksTable.grantReadData(lambdaFunction);
    }
    if (
      config.permissions.stocksTable === "write" ||
      config.permissions.stocksTable === "both"
    ) {
      this.stocksTable.grantWriteData(lambdaFunction);
    }

    return lambdaFunction;
  }

  private createLambdaFunctions(): Record<string, lambda.Function> {
    const getProductsList = this.createLambdaFunction({
      id: "getProductsList",
      handlerPath: "get-products-list",
      permissions: {
        productsTable: "read",
        stocksTable: "read",
      },
    });

    const getProductById = this.createLambdaFunction({
      id: "getProductById",
      handlerPath: "get-product-by-id",
      permissions: {
        productsTable: "read",
        stocksTable: "read",
      },
    });

    const createProduct = this.createLambdaFunction({
      id: "createProduct",
      handlerPath: "create-product",
      permissions: {
        productsTable: "write",
        stocksTable: "write",
      },
    });

    const swaggerUi = new lambda.Function(this, "SwaggerUI", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/swagger-ui")
      ),
      layers: [this.sharedLayer],
    });

    return {
      getProductsList,
      getProductById,
      createProduct,
      swaggerUi,
    };
  }

  private setupApiEndpoints(
    lambdaFunctions: Record<string, lambda.Function>
  ): void {
    // Products endpoints
    const products = this.api.root.addResource("products");
    products.addMethod(
      "GET",
      new apigateway.LambdaIntegration(lambdaFunctions.getProductsList)
    );
    products.addMethod(
      "POST",
      new apigateway.LambdaIntegration(lambdaFunctions.createProduct)
    );

    // Product by ID endpoint
    const product = products.addResource("{productId}");
    product.addMethod(
      "GET",
      new apigateway.LambdaIntegration(lambdaFunctions.getProductById)
    );

    // Swagger UI endpoint
    const docs = this.api.root.addResource("docs");
    docs.addMethod(
      "GET",
      new apigateway.LambdaIntegration(lambdaFunctions.swaggerUi)
    );
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, "ProductsListURL", {
      value: `${this.api.url}products`,
      description: "Products list URL",
    });

    new cdk.CfnOutput(this, "ProductByIdURL", {
      value: `${this.api.url}products/{productId}`,
      description: "Product by ID URL",
    });

    new cdk.CfnOutput(this, "SwaggerUIDocsURL", {
      value: `${this.api.url}docs`,
      description: "Swagger UI URL",
    });
  }
}
