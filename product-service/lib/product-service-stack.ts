import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import * as path from "path";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsLayer = new lambda.LayerVersion(this, "ProductsLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist/layers")),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Products mock data layer",
    });

    // Create Lambda functions
    const getProductsList = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/get-products-list")
      ),
      layers: [productsLayer],
    });

    const getProductById = new lambda.Function(this, "getProductById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/functions/get-product-by-id")
      ),
      layers: [productsLayer],
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
  }
}
