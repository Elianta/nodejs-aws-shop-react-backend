import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { products } from "../mocks/products";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const populateTables = async () => {
  try {
    console.log("Starting to populate products...");
    const productIds = [];

    for (const product of products) {
      const productCommand = new PutCommand({
        TableName: "products",
        Item: {
          id: product.id,
          title: product.title,
          description: product.description,
          price: product.price,
        },
      });

      const response = await docClient.send(productCommand);
      console.log(response);
      console.log(`Created product: ${product.title} with ID: ${product.id}`);
      productIds.push(product.id);
    }

    console.log("\nStarting to populate stocks...");

    // Insert stocks for each product
    for (const productId of productIds) {
      const stockCount = Math.floor(Math.random() * 10) + 1;
      const stockCommand = new PutCommand({
        TableName: "stocks",
        Item: {
          product_id: productId,
          count: stockCount,
        },
      });

      await docClient.send(stockCommand);
      console.log(
        `Created stock entry for product ${productId} with count: ${stockCount}`
      );
    }

    console.log("\nAll data populated successfully!");

    console.log(`\nSummary:`);
    console.log(`Products created: ${productIds.length}`);
    console.log(`Stocks created: ${productIds.length}`);
  } catch (error) {
    console.error("Error populating tables:", error);
    throw error;
  }
};

populateTables()
  .then(() => console.log("Script completed successfully"))
  .catch((error) => console.error("Script failed:", error));
