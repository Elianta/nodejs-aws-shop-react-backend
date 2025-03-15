import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { ProductWithStock } from "/opt/nodejs/types";
import { AppError } from "/opt/nodejs/utils/error-handler";

interface ValidationResult {
  isValid: boolean;
  validatedProduct?: Omit<ProductWithStock, "id">;
  error?: string;
}

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler: SQSHandler = async (event) => {
  console.log(
    "catalogBatchProcess lambda triggered with event:",
    JSON.stringify(event)
  );

  const failedMessageIds: string[] = [];

    for (const record of event.Records) {
      try {
      let rawProduct: Omit<ProductWithStock, "id"> | null = null;
        rawProduct = JSON.parse(record.body) as Omit<ProductWithStock, "id">;
        const validationResult = validateProduct(rawProduct);

        if (!validationResult.isValid || !validationResult.validatedProduct) {
        console.log(validationResult.error || "Invalid product data");
        continue;
        }

        const product = validationResult.validatedProduct;
        const productId = uuidv4();

      try {
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
              },
            },
            {
              Put: {
                TableName: process.env.STOCKS_TABLE_NAME!,
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
      } catch (error: any) {
        // Check if error is due to ConditionExpression - don't retry
        if (
          error.name === "TransactionCanceledException" &&
          error.CancellationReasons?.some(
            (reason: any) => reason.Code === "ConditionalCheckFailed"
          )
        ) {
          console.log(`Product ${rawProduct?.title} already exists - skipping`);
          continue;
        }
        throw error; // Re-throw other errors to be caught by outer try-catch
    }
  } catch (error) {
    const appError = AppError.from(error, "Error processing batch");
    console.error(appError);
      failedMessageIds.push(record.messageId);
    }
  }
  return {
    batchItemFailures: failedMessageIds.map((id) => ({ itemIdentifier: id })),
  };
};

function validateProduct(product: any): ValidationResult {
  try {
    if (typeof product.title !== "string" || !product.title.trim()) {
      return {
        isValid: false,
        error: "Invalid product data: title must be a non-empty string",
      };
    }

    const price = Number(product.price);
    if (isNaN(price) || price <= 0) {
      return {
        isValid: false,
        error: "Invalid product data: price must be a positive number",
      };
    }

    const count = Number(product.count);
    if (isNaN(count) || count <= 0) {
      return {
        isValid: false,
        error: "Invalid product data: count must be a positive number",
      };
    }

    if (
      product.description !== undefined &&
      typeof product.description !== "string"
    ) {
      return {
        isValid: false,
        error: "Invalid product data: description must be a string",
      };
    }

    const validatedProduct: Omit<ProductWithStock, "id"> = {
      title: product.title.trim(),
      price: price,
      count: count,
      description: product.description,
    };

    return {
      isValid: true,
      validatedProduct,
    };
  } catch (error) {
    return {
      isValid: false,
      error: "Invalid product data: unexpected error during validation",
    };
  }
}
