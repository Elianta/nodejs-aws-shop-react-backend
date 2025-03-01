import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Product, ProductWithStock } from "/opt/nodejs/types";

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log(
      "CREATE PRODUCT LAMBDA: Incoming request with event:",
      JSON.stringify(event, null, 2)
    );

    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({ message: "Request body is missing" }),
      };
    }

    const { title, description, price, count } = JSON.parse(event.body) as Omit<
      ProductWithStock,
      "id"
    >;

    // Validate required fields
    if (!title || price === undefined || count === undefined) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message:
            "Missing required fields: title, price, and count are required",
        }),
      };
    }

    const productId = uuidv4();

    // Create product in both tables using a transaction
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.PRODUCTS_TABLE_NAME,
              Item: {
                id: productId,
                title,
                description: description || "",
                price,
              },
            },
          },
          {
            Put: {
              TableName: process.env.STOCKS_TABLE_NAME,
              Item: {
                product_id: productId,
                count,
              },
            },
          },
        ],
      })
    );

    const newProduct: Product & { count: number } = {
      id: productId,
      title,
      description: description || "",
      price,
      count,
    };

    return {
      statusCode: 201,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(newProduct),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
