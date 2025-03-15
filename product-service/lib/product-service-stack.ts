import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { BaseLambdaConfig, LambdaFunctionBuilder } from "./builders";
import { AppError } from "../layers/nodejs/utils/error-handler";

interface LambdaConfig extends BaseLambdaConfig {
  permissions: {
    productsTable: "read" | "write" | "both";
    stocksTable: "read" | "write" | "both";
    productTitlesTable: "read" | "write" | "both";
  };
}

export class ProductServiceStack extends cdk.Stack {
  private productsTable: dynamodb.ITable;
  private stocksTable: dynamodb.ITable;
  private productTitlesTable: dynamodb.ITable;
  private sharedLayer: lambda.LayerVersion;
  private lambdaEnv: Record<string, string>;
  private api: apigateway.RestApi;
  private catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    try {
      this.initializeDynamoDbTables();
      this.createSharedLayer();
      this.setupLambdaEnvironment();
      this.createApiGateway();

      const lambdaFunctions = this.createLambdaFunctions();
      this.setupApiEndpoints(lambdaFunctions);
      this.createCatalogProcessing();
      this.createOutputs();
    } catch (error) {
      throw AppError.from(error, "Failed to initialize stack");
    }
  }

  private initializeDynamoDbTables(): void {
    try {
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

      this.productTitlesTable = dynamodb.Table.fromTableName(
        this,
        "ProductTitles",
        "product-titles"
      );
    } catch (error) {
      throw AppError.from(error, "Failed to initialize DynamoDB tables");
    }
  }

  private createSharedLayer(): void {
    try {
      this.sharedLayer = new lambda.LayerVersion(this, "NodeJsLayer", {
        code: lambda.Code.fromAsset(path.join(__dirname, "../dist/layers")),
        compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
        description: "Node.js dependencies layer",
      });
    } catch (error) {
      throw AppError.from(error, "Failed to create shared layer");
    }
  }

  private setupLambdaEnvironment(): void {
    try {
      // Common environment variables for Lambda functions
      this.lambdaEnv = {
        PRODUCTS_TABLE_NAME: this.productsTable.tableName,
        STOCKS_TABLE_NAME: this.stocksTable.tableName,
        PRODUCT_TITLES_TABLE_NAME: this.productTitlesTable.tableName,
        REGION: cdk.Stack.of(this).region,
      };
    } catch (error) {
      throw AppError.from(error, "Failed to setup Lambda environment");
    }
  }

  private createApiGateway(): void {
    try {
      this.api = new apigateway.RestApi(this, "ProductsApi", {
        restApiName: "Products Service",
        defaultCorsPreflightOptions: {
          allowOrigins: apigateway.Cors.ALL_ORIGINS,
          allowMethods: apigateway.Cors.ALL_METHODS,
        },
      });
    } catch (error) {
      throw AppError.from(error, "Failed to create API Gateway");
    }
  }

  private createCatalogProcessing(): void {
    try {
      this.catalogItemsQueue = new sqs.Queue(this, "CatalogItemsQueue", {
        queueName: "catalogItemsQueue",
        retentionPeriod: cdk.Duration.days(1),
      });

      const catalogBatchBuilder = new LambdaFunctionBuilder(
        this,
        {
          id: "CatalogBatchProcessLambda",
          handlerPath: "catalog-batch-process",
        },
        {
          runtime: lambda.Runtime.NODEJS_20_X,
          handler: "handler.handler",
          code: lambda.Code.fromAsset(
            path.join(__dirname, "../dist/functions/catalog-batch-process")
          ),
          environment: {
            ...this.lambdaEnv,
          },
          layers: [this.sharedLayer],
        }
      );

      catalogBatchBuilder
        .addTablePermissions(this.productsTable, "write")
        .addTablePermissions(this.stocksTable, "write")
        .addTablePermissions(this.productTitlesTable, "write")
        .addEventSource(this.catalogItemsQueue, {
          batchSize: 5,
          reportBatchItemFailures: true,
        })
        .build();
    } catch (error) {
      throw AppError.from(
        error,
        "Failed to create catalog processing resources"
      );
    }
  }

  private createLambdaFunction(config: LambdaConfig): lambda.Function {
    try {
      const builder = new LambdaFunctionBuilder(this, config, {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, `../dist/functions/${config.handlerPath}`)
        ),
        layers: [this.sharedLayer],
        environment: this.lambdaEnv,
      });

      return builder
        .addTablePermissions(
          this.productsTable,
          config.permissions.productsTable
        )
        .addTablePermissions(this.stocksTable, config.permissions.stocksTable)
        .addTablePermissions(
          this.productTitlesTable,
          config.permissions.productTitlesTable
        )
        .build();
    } catch (error) {
      throw AppError.from(
        error,
        `Failed to create Lambda function ${config.id}`
      );
    }
  }

  private createLambdaFunctions(): Record<string, lambda.Function> {
    try {
      const getProductsList = this.createLambdaFunction({
        id: "getProductsList",
        handlerPath: "get-products-list",
        permissions: {
          productsTable: "read",
          stocksTable: "read",
          productTitlesTable: "read",
        },
      });

      const getProductById = this.createLambdaFunction({
        id: "getProductById",
        handlerPath: "get-product-by-id",
        permissions: {
          productsTable: "read",
          stocksTable: "read",
          productTitlesTable: "read",
        },
      });

      const createProduct = this.createLambdaFunction({
        id: "createProduct",
        handlerPath: "create-product",
        permissions: {
          productsTable: "write",
          stocksTable: "write",
          productTitlesTable: "write",
        },
      });

      const swaggerUi = new LambdaFunctionBuilder(
        this,
        {
          id: "SwaggerUI",
          handlerPath: "swagger-ui",
        },
        {
          runtime: lambda.Runtime.NODEJS_20_X,
          handler: "handler.handler",
          code: lambda.Code.fromAsset(
            path.join(__dirname, "../dist/functions/swagger-ui")
          ),
          layers: [this.sharedLayer],
        }
      ).build();

      return {
        getProductsList,
        getProductById,
        createProduct,
        swaggerUi,
      };
    } catch (error) {
      throw AppError.from(error, "Failed to create Lambda functions");
    }
  }

  private setupApiEndpoints(
    lambdaFunctions: Record<string, lambda.Function>
  ): void {
    try {
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
    } catch (error) {
      throw AppError.from(error, "Failed to setup API endpoints");
    }
  }

  private createOutputs(): void {
    try {
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
    } catch (error) {
      throw AppError.from(error, "Failed to create stack outputs");
    }
  }
}
