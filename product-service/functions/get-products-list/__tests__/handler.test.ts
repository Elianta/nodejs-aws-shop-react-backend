import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { products } from "../../../mocks/products";
import { ProductWithStock } from "/opt/nodejs/types";
import {
  TEST_PRODUCTS_TABLE,
  TEST_STOCKS_TABLE,
  shouldThrow,
  setupDynamoDBMock,
} from "../../../mocks/dynamodb";

// Setup mocks
setupDynamoDBMock();

// Store original env variables to restore later
const originalEnv = { ...process.env };

import { handler } from "../handler";

const invokeHandler = async (): Promise<APIGatewayProxyResult> => {
  const event = {} as unknown as APIGatewayProxyEvent;
  return handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
};

describe("getProductsList Lambda", () => {
  beforeEach(() => {
    // Set environment variables for tests
    process.env.PRODUCTS_TABLE_NAME = TEST_PRODUCTS_TABLE;
    process.env.STOCKS_TABLE_NAME = TEST_STOCKS_TABLE;

    // Clear console mocks between tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();
    // Restore original environment variables
    process.env = { ...originalEnv };
    // Reset the error flag
    shouldThrow(false);
  });

  it("should return all products", async () => {
    const response = await invokeHandler();

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.length).toBe(products.length);

    responseBody.forEach((product: ProductWithStock) => {
      expect(product).toHaveProperty("id");
      expect(product).toHaveProperty("title");
      expect(product).toHaveProperty("description");
      expect(product).toHaveProperty("price");
      expect(product).toHaveProperty("count");
      expect(typeof product.count).toBe("number");
    });
  });

  it("should include CORS headers in response", async () => {
    const response = await invokeHandler();

    expect(response.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    });
  });

  it("should return 500 when an error occurs", async () => {
    shouldThrow(true);

    const response = await invokeHandler();

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });
  });

  it("should correctly join product and stock data", async () => {
    const response = await invokeHandler();
    const responseBody = JSON.parse(response.body);

    const firstProduct = responseBody.find(
      (p: ProductWithStock) => p.id === products[0].id
    );
    expect(firstProduct).toBeDefined();
    expect(firstProduct.count).toBeDefined();
    expect(typeof firstProduct.count).toBe("number");
    expect(firstProduct.count).toBe(1);
  });
});
