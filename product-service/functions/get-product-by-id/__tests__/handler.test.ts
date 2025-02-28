import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { products } from "../../../mocks/products";

// Constants
const TEST_PRODUCTS_TABLE = "test-products-table";
const TEST_STOCKS_TABLE = "test-stocks-table";

// Store original env variables to restore later
const originalEnv = { ...process.env };

// Mock control flag
let shouldThrowError = false;

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const originalModule = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...originalModule,
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({
        send: jest.fn().mockImplementation((command) => {
          if (shouldThrowError) {
            return Promise.reject(new Error("DynamoDB error"));
          }

          if (command instanceof originalModule.GetCommand) {
            console.log("table name", command.input.TableName);
            if (command.input.TableName === TEST_PRODUCTS_TABLE) {
              const productId = command.input.Key.id;
              const product = products.find((p) => p.id === productId);

              return Promise.resolve({
                Item: product || null,
              });
            } else if (command.input.TableName === TEST_STOCKS_TABLE) {
              const productId = command.input.Key.product_id;
              const productIndex = products.findIndex(
                (p) => p.id === productId
              );

              if (productIndex !== -1) {
                return Promise.resolve({
                  Item: {
                    product_id: productId,
                    count: (productIndex % 10) + 1, // Deterministic but varied values
                  },
                });
              }

              return Promise.resolve({
                Item: null,
              });
            }
          }
          return Promise.resolve({});
        }),
      }),
    },
    GetCommand: originalModule.GetCommand,
  };
});

import { handler } from "../handler";

const invokeHandler = async (id: string): Promise<APIGatewayProxyResult> => {
  const event = {
    pathParameters: {
      productId: id,
    },
  } as unknown as APIGatewayProxyEvent;
  return handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
};

describe("getProductById Lambda", () => {
  beforeEach(() => {
    // Set environment variables for tests
    process.env.PRODUCTS_TABLE_NAME = TEST_PRODUCTS_TABLE;
    process.env.STOCKS_TABLE_NAME = TEST_STOCKS_TABLE;
  });

  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();
    // Restore original environment variables
    process.env = { ...originalEnv };
    // Reset the error flag
    shouldThrowError = false;
  });

  it("should return product when valid ID is provided", async () => {
    const testProduct = products[0];
    const expectedCount = (0 % 10) + 1; // Same calculation as in the mock

    const response = await invokeHandler(testProduct.id);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ...testProduct,
      count: expectedCount,
    });
  });

  it("should return 404 when product is not found", async () => {
    const nonExistentId = "00000000-0000-4000-8000-000000000000";
    const response = await invokeHandler(nonExistentId);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      message: "Product not found",
    });
  });

  it("should return 400 when invalid UUID format is provided", async () => {
    const response = await invokeHandler("invalid - uuid");

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: "Invalid product ID format. Expected UUID v4.",
    });
  });

  it("should return 500 when an error occurs", async () => {
    shouldThrowError = true;

    const response = await invokeHandler(products[0].id);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });
  });

  it("should include CORS headers in response", async () => {
    const response = await invokeHandler(products[0].id);

    expect(response.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    });
  });
});
