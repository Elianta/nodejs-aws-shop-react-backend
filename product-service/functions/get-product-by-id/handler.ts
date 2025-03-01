import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { Product, Stock, ProductWithStock } from "/opt/nodejs/types";

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

function isUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log(
      "GET PRODUCTS BY ID LAMBDA: Incoming request with event:",
      JSON.stringify(event, null, 2)
    );

    const productId = event.pathParameters?.productId as string;

    if (!isUUIDv4(productId)) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message: "Invalid product ID format. Expected UUID v4.",
        }),
      };
    }

    const productResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE_NAME,
        Key: { id: productId },
      })
    );
    const product = productResponse.Item as Product;

    if (!product) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    // Get stock for this product
    const stockResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.STOCKS_TABLE_NAME,
        Key: { product_id: productId },
      })
    );

    const stock = stockResponse.Item as Stock;

    // Join product with stock
    const productWithStock: ProductWithStock = {
      ...product,
      count: stock ? stock.count : 0,
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(productWithStock),
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
