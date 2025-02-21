import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import * as path from "path";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sharedLayer = new lambda.LayerVersion(this, "NodeJsLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist/layers")),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Node.js dependencies layer",
    });

    // Create Lambda functions
    const getProductsList = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/get-products-list")
      ),
      layers: [sharedLayer],
    });

    const getProductById = new lambda.Function(this, "getProductById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/get-product-by-id")
      ),
      layers: [sharedLayer],
    });

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

    const product = products.addResource("{productId}");
    product.addMethod("GET", new apigateway.LambdaIntegration(getProductById));

    const docs = api.root.addResource("docs");
    docs.addMethod("GET", new apigateway.LambdaIntegration(swaggerUi));

    new cdk.CfnOutput(this, "SwaggerUIDocsURL", {
      value: `${api.url}docs`,
      description: "Swagger UI URL",
    });
  }
}
