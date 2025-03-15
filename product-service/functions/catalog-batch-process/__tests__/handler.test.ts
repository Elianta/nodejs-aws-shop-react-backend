import { SQSEvent } from "aws-lambda";
import { ProductWithStock } from "/opt/nodejs/types";
import {
  TEST_PRODUCTS_TABLE,
  TEST_STOCKS_TABLE,
  TEST_PRODUCT_TITLES_TABLE,
  setupDynamoDBMock,
} from "../../../mocks/dynamodb";
import { setupUuidMock, TEST_UUID } from "../../../mocks/uuid";
import {
  TEST_CREATE_PRODUCT_TOPIC_ARN,
  setupSnsMock,
} from "../../../mocks/sns";

const setupTestEnvironment = () => {
  // Setup all mocks
  setupDynamoDBMock();
  setupUuidMock();
  setupSnsMock();

  // Get all mocked modules
  const { DynamoDBClient } = jest.requireMock("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, TransactWriteCommand } = jest.requireMock(
    "@aws-sdk/lib-dynamodb"
  );
  const { SNSClient, PublishCommand } = jest.requireMock("@aws-sdk/client-sns");
  const { handler } = require("../handler");

  // Create mock instances
  const dynamoDBClientMock = DynamoDBClient();
  const docClientMock = DynamoDBDocumentClient.from(dynamoDBClientMock);
  const snsClientMock = SNSClient();

  return {
    handler,
    mocks: {
      dynamoDBClientMock,
      docClientMock,
      snsClientMock,
      commands: {
        TransactWriteCommand,
        SNSPublishCommand: PublishCommand,
      },
    },
  };
};

const testProductsData: Omit<ProductWithStock, "id">[] = [
  {
    title: "Test Product",
    description: "Test Description",
    price: 99.99,
    count: 10,
  },
  {
    title: "Product 2",
    description: "Description 2",
    price: 199.99,
    count: 20,
  },
];

describe("catalogBatchProcess Lambda", () => {
  const originalEnv = { ...process.env };
  let testEnv: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.PRODUCTS_TABLE_NAME = TEST_PRODUCTS_TABLE;
    process.env.STOCKS_TABLE_NAME = TEST_STOCKS_TABLE;
    process.env.PRODUCT_TITLES_TABLE_NAME = TEST_PRODUCT_TITLES_TABLE;
    process.env.CREATE_PRODUCT_TOPIC_ARN = TEST_CREATE_PRODUCT_TOPIC_ARN;

    testEnv = setupTestEnvironment();

    // Clear console mocks between tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  const invokeHandler = async (data: any[]) => {
    const event = {
      Records: data.map((item) => ({
        messageId: "test-message-id",
        body: JSON.stringify(item),
      })),
    } as unknown as SQSEvent;
    return testEnv.handler(event, {} as any, () => {});
  };

  it("should process SQS messages and create products", async () => {
    await invokeHandler([testProductsData[0]]);

    const { mocks } = testEnv;
    expect(mocks.commands.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: [
        {
          Put: {
            TableName: TEST_PRODUCT_TITLES_TABLE,
            Item: {
              title: testProductsData[0].title,
            },
            ConditionExpression: "attribute_not_exists(title)",
          },
        },
        {
          Put: {
            TableName: TEST_PRODUCTS_TABLE,
            Item: {
              id: TEST_UUID,
              title: testProductsData[0].title,
              description: testProductsData[0].description,
              price: testProductsData[0].price,
            },
          },
        },
        {
          Put: {
            TableName: TEST_STOCKS_TABLE,
            Item: {
              product_id: TEST_UUID,
              count: testProductsData[0].count,
            },
          },
        },
      ],
    });

    expect(mocks.docClientMock.send).toHaveBeenCalled();
  });

  it("should process valid products and publish to SNS", async () => {
    await invokeHandler([testProductsData[0]]);

    const { mocks } = testEnv;

    expect(mocks.snsClientMock.send).toHaveBeenCalledTimes(1);
    expect(mocks.commands.SNSPublishCommand).toHaveBeenCalledWith({
      TopicArn: TEST_CREATE_PRODUCT_TOPIC_ARN,
      Message: JSON.stringify({
        message: "Product created successfully",
        product: {
          id: TEST_UUID,
          title: testProductsData[0].title,
          description: testProductsData[0].description,
          price: testProductsData[0].price,
          count: testProductsData[0].count,
        },
      }),
      MessageAttributes: {
        count: {
          DataType: "Number",
          StringValue: testProductsData[0].count.toString(),
        },
      },
    });
  });

  it("should handle multiple records in the event", async () => {
    await invokeHandler(testProductsData);

    const { mocks } = testEnv;
    expect(mocks.commands.TransactWriteCommand).toHaveBeenCalledTimes(2);
    expect(mocks.docClientMock.send).toHaveBeenCalledTimes(2);
  });

  it("should handle invalid product data", async () => {
    const { mocks } = testEnv;
    const result = await invokeHandler([{ description: "Test Description" }]);

    expect(result.batchItemFailures).toEqual([]);
    expect(mocks.snsClientMock.send).not.toHaveBeenCalled();
    expect(mocks.docClientMock.send).not.toHaveBeenCalled();
  });

  it("should handle invalid JSON in message body", async () => {
    const result = await invokeHandler(["invalid-json"]);

    expect(result.batchItemFailures).toEqual([]);
  });

  it("should handle DynamoDB errors", async () => {
    const { mocks } = testEnv;
    mocks.docClientMock.send.mockRejectedValueOnce(new Error("DynamoDB error"));

    const result = await invokeHandler([testProductsData[0]]);

    expect(result.batchItemFailures).toHaveLength(1);
    expect(result.batchItemFailures[0].itemIdentifier).toBeDefined();
    expect(mocks.snsClientMock.send).not.toHaveBeenCalled();
  });

  it("should handle product already exists condition", async () => {
    const { mocks } = testEnv;
    const conditionalError = {
      name: "TransactionCanceledException",
      CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
    };
    mocks.docClientMock.send.mockRejectedValueOnce(conditionalError);

    const result = await invokeHandler([testProductsData[0]]);

    // Should not mark as failed
    expect(result.batchItemFailures).toEqual([]);
    expect(mocks.snsClientMock.send).not.toHaveBeenCalled();
  });
});
