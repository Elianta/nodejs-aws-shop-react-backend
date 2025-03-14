import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { ProductWithStock } from "/opt/nodejs/types";
import { AppError } from "../../lib/utils/error-handler";

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler: SQSHandler = async (event) => {
  console.log(
    "catalogBatchProcess lambda triggered with event:",
    JSON.stringify(event)
  );

  try {
    for (const record of event.Records) {
      const product = JSON.parse(record.body) as Omit<ProductWithStock, "id">;
      const productId = uuidv4();

      //TODO: implement validation
      if (!product.title || !product.price || !product.count) {
        throw new AppError("Invalid product data: missing required fields");
      }

      const command = new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.PRODUCTS_TABLE!,
              Item: {
                id: productId,
                title: product.title,
                description: product.description,
                price: product.price,
              },
            },
          },
          {
            Put: {
              TableName: process.env.STOCKS_TABLE!,
              Item: {
                product_id: productId,
                count: product.count,
              },
            },
          },
        ],
      });

      await docClient.send(command);
      console.log(`Product created successfully: ${productId}`);
    }
  } catch (error) {
    const appError = AppError.from(error, "Error processing batch");
    console.error(appError);
    throw appError;
  }
};
