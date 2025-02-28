import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { products } from "../../../mocks/products";
import { ProductWithStock } from "/opt/nodejs/types";

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

          if (command instanceof originalModule.ScanCommand) {
            if (command.input.TableName === TEST_PRODUCTS_TABLE) {
              return Promise.resolve({
                Items: products,
              });
            } else if (command.input.TableName === TEST_STOCKS_TABLE) {
              const mockStocks = products.map((product, index) => ({
                product_id: product.id,
                count: (index % 10) + 1, // Deterministic but varied values
              }));
              return Promise.resolve({
                Items: mockStocks,
              });
            }
          }
          return Promise.resolve({});
        }),
      }),
    },
    ScanCommand: originalModule.ScanCommand,
  };
});

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
    shouldThrowError = true;

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
