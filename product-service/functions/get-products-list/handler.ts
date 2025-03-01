import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Product, Stock, ProductWithStock } from "/opt/nodejs/types";

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log(
      "GET PRODUCTS LAMBDA: Incoming request with event:",
      JSON.stringify(event, null, 2)
    );

    const productsResponse = await docClient.send(
      new ScanCommand({
        TableName: process.env.PRODUCTS_TABLE_NAME,
      })
    );
    const products = productsResponse.Items as Product[];

    const stocksResponse = await docClient.send(
      new ScanCommand({
        TableName: process.env.STOCKS_TABLE_NAME,
      })
    );
    const stocks = stocksResponse.Items as Stock[];

    // Join products with stocks
    const productsWithStocks: ProductWithStock[] = products.map((product) => {
      const stock = stocks.find((s) => s.product_id === product.id);
      return {
        ...product,
        count: stock ? stock.count : 0,
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(productsWithStocks),
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
