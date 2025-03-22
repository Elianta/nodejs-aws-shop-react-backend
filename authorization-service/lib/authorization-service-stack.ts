import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export class AuthorizationServiceStack extends cdk.Stack {
  private lambdaEnv: Record<string, string>;
  public basicAuthorizerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.setupLambdaEnvironment();
    this.setupBasicAuthorizer();
    this.createOutputs();
  }

  private setupLambdaEnvironment(): void {
    const envVars: { [key: string]: string } = {};

    // GitHub username validation rules:
    // 1. Only alphanumeric characters and single hyphens (-) are allowed
    // 2. Cannot start or end with a hyphen
    // 3. Cannot contain consecutive hyphens
    // 4. Minimum length: 1 character
    // 5. Maximum length: 39 characters
    const validGithubUsername =
      /^[a-zA-Z0-9](?!.*--)[a-zA-Z0-9-]{0,37}[a-zA-Z0-9]$/;

    for (const [key, value] of Object.entries(process.env)) {
      // Keep only valid GitHub usernames with a non-empty value
      if (validGithubUsername.test(key) && value) {
        envVars[key] = value;
      }
    }

    this.lambdaEnv = envVars;
  }

  private setupBasicAuthorizer(): void {
    this.basicAuthorizerFunction = new lambda.Function(
      this,
      "BasicAuthorizerFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../dist/functions/basic-authorizer")
        ),
        environment: this.lambdaEnv,
      }
    );

    const apiId = cdk.Fn.importValue("ImportServiceApiId");

    this.basicAuthorizerFunction.addPermission("ApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${apiId}/*/*/*`,
    });

    this.basicAuthorizerFunction.addPermission("ApiGatewayAuthorizerTest", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${apiId}/authorizers/*`,
    });
  }

  private createOutputs(): void {
    // can be used in other services to reference the authorizer function ARN dynamically
    new cdk.CfnOutput(this, "BasicAuthorizerArn", {
      value: this.basicAuthorizerFunction.functionArn,
      exportName: "BasicAuthorizerArn",
    });
  }
}
