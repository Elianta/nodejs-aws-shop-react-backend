import { products } from "./products";

// Constants
export const TEST_PRODUCTS_TABLE = "test-products-table";
export const TEST_STOCKS_TABLE = "test-stocks-table";

// Mock control flag
let shouldThrowError = false;

export const shouldThrow = (state: boolean) => {
  shouldThrowError = state;
};

export const setupDynamoDBMock = () => {
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

            // Handle ScanCommand (for get-products-list)
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

            // Handle GetCommand (for get-product-by-id)
            if (command instanceof originalModule.GetCommand) {
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
                      count: (productIndex % 10) + 1,
                    },
                  });
                }
                return Promise.resolve({
                  Item: null,
                });
              }
            }

            // Handle TransactWriteCommand (for create-product)
            if (command instanceof originalModule.TransactWriteCommand) {
              return Promise.resolve({});
            }

            return Promise.resolve({});
          }),
        }),
      },
      ScanCommand: originalModule.ScanCommand,
      GetCommand: originalModule.GetCommand,
      TransactWriteCommand: originalModule.TransactWriteCommand,
    };
  });
};
