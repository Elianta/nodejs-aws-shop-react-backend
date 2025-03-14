import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";
import { AppError } from "../../layers/nodejs/utils/error-handler";
import { Duration } from "aws-cdk-lib";

export interface BaseLambdaConfig {
  id: string;
  handlerPath: string;
}

export type TablePermission = "read" | "write" | "both";

export class LambdaFunctionBuilder {
  private readonly function: lambda.Function;

  constructor(
    scope: Construct,
    config: BaseLambdaConfig,
    props: lambda.FunctionProps
  ) {
    try {
      this.function = new lambda.Function(scope, config.id, props);
    } catch (error) {
      throw AppError.from(
        error,
        `Failed to create Lambda function ${config.id}`
      );
    }
  }

  addTablePermissions(
    table: dynamodb.ITable,
    permission: TablePermission
  ): this {
    try {
      if (permission === "read" || permission === "both") {
        table.grantReadData(this.function);
      }
      if (permission === "write" || permission === "both") {
        table.grantWriteData(this.function);
      }
      return this;
    } catch (error) {
      throw AppError.from(
        error,
        `Failed to add table permissions for ${table.tableName}`
      );
    }
  }

  addEventSource(
    queue: sqs.Queue,
    batchSize: number,
    maxBatchingWindowInSeconds?: number
  ): this {
    try {
      this.function.addEventSource(
        new lambdaEventSources.SqsEventSource(queue, {
          batchSize,
          maxBatchingWindow: Duration.seconds(maxBatchingWindowInSeconds || 10),
        })
      );
      return this;
    } catch (error) {
      throw AppError.from(
        error,
        `Failed to add event source for queue ${queue.queueName}`
      );
    }
  }

  build(): lambda.Function {
    return this.function;
  }
}
