import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { ProductWithStock } from "/opt/nodejs/types";
import { AppError } from "/opt/nodejs/utils/error-handler";

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler: SQSHandler = async (event) => {
  console.log(
    "catalogBatchProcess lambda triggered with event:",
    JSON.stringify(event)
  );

  try {
    for (const record of event.Records) {
      let product: Omit<ProductWithStock, "id">;
      try {
        product = JSON.parse(record.body) as Omit<ProductWithStock, "id">;

        //TODO: implement validation
        if (!product.title || !product.price || !product.count) {
          throw new AppError("Invalid product data: missing required fields");
        }

        const productId = uuidv4();

        const command = new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: process.env.PRODUCT_TITLES_TABLE_NAME!,
                Item: {
                  title: product.title,
                },
                ConditionExpression: "attribute_not_exists(title)",
              },
            },
            {
              Put: {
                TableName: process.env.PRODUCTS_TABLE_NAME!,
                Item: {
                  id: productId,
                  title: product.title,
                  description: product.description,
                  price: product.price,
                },
                ConditionExpression: "attribute_not_exists(id)",
              },
            },
            {
              Put: {
                TableName: process.env.STOCKS_TABLE_NAME!,
                Item: {
                  product_id: productId,
                  count: product.count,
                },
                ConditionExpression: "attribute_not_exists(product_id)",
              },
            },
          ],
        });

        await docClient.send(command);
        console.log(`Product created successfully: ${productId}`);
      } catch (error) {
        throw error; // Re-throw other errors to be caught by outer try-catch
      }
    }
  } catch (error) {
    const appError = AppError.from(error, "Error processing batch");
    console.error(appError);
    throw appError;
  }
};
