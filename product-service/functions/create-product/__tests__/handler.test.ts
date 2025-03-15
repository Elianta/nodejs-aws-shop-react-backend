import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ProductWithStock } from "/opt/nodejs/types";
import {
  TEST_PRODUCTS_TABLE,
  TEST_STOCKS_TABLE,
  shouldThrow,
  setupDynamoDBMock,
} from "../../../mocks/dynamodb";
import { setupUuidMock, TEST_UUID } from "../../../mocks/uuid";

// Setup mocks
setupDynamoDBMock();
setupUuidMock();

// Store original env variables to restore later
const originalEnv = { ...process.env };

import { handler } from "../handler";

const invokeHandler = async (body?: any): Promise<APIGatewayProxyResult> => {
  const event = {
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEvent;
  return handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
};

const testProductData: Omit<ProductWithStock, "id"> = {
  title: "Test Product",
  description: "Test Description",
  price: 99.99,
  count: 10,
};

describe("createProduct Lambda", () => {
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

  it("should create a product successfully", async () => {
    const response = await invokeHandler(testProductData);

    expect(response.statusCode).toBe(201);
    const responseBody = JSON.parse(response.body);

    expect(responseBody).toEqual({
      id: TEST_UUID,
      title: testProductData.title,
      description: testProductData.description,
      price: testProductData.price,
      count: testProductData.count,
    });
  });

  it("should include CORS headers in response", async () => {
    const response = await invokeHandler(testProductData);

    expect(response.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    });
  });

  it("should return 400 when request body is missing", async () => {
    const response = await invokeHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: "Request body is missing",
    });
  });

  it("should return 400 when required fields are missing", async () => {
    const incompleteProduct = {
      description: "Missing required fields",
    };

    const response = await invokeHandler(incompleteProduct);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: "Missing required fields: title, price, and count are required",
    });
  });

  it("should return 500 when an error occurs", async () => {
    shouldThrow(true);
    const response = await invokeHandler(testProductData);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });
  });
});
