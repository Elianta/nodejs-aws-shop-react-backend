import { S3Event } from "aws-lambda";
import { setupClientS3Mock } from "../../../mocks/client-s3";
import { setupClientSqsMock } from "../../../mocks/client-sqs";
import { setupCsvParserMock } from "../../../mocks/csv-parser";

const TEST_REGION = "us-east-1";
const TEST_BUCKET_NAME = "test-bucket";
const TEST_SQS_URL = "https://sqs.test.url";

const setupTestEnvironment = () => {
  // Setup all mocks
  setupClientS3Mock();
  setupClientSqsMock();
  setupCsvParserMock();

  // Get all mocked modules
  const { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } =
    jest.requireMock("@aws-sdk/client-s3");
  const { SQSClient, SendMessageCommand } = jest.requireMock(
    "@aws-sdk/client-sqs"
  );
  const { handler } = require("../handler");

  // Create mock instances
  const s3ClientMock = S3Client();
  const sqsClientMock = SQSClient();

  return {
    handler,
    mocks: {
      s3ClientMock,
      sqsClientMock,
      commands: {
        GetObjectCommand,
        CopyObjectCommand,
        DeleteObjectCommand,
        SendMessageCommand,
      },
    },
  };
};

describe("import-file-parser Lambda", () => {
  const originalEnv = process.env;
  let testEnv: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REGION = TEST_REGION;
    process.env.SQS_URL = TEST_SQS_URL;

    testEnv = setupTestEnvironment();

    // Clear console mocks between tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  const invokeHandler = async (fileNames: string[]) => {
    const mockEvent = {
      Records: fileNames.map((fileName) => ({
        s3: {
          bucket: {
            name: TEST_BUCKET_NAME,
          },
          object: {
            key: fileName,
          },
        },
      })),
    } as S3Event;

    return await testEnv.handler(mockEvent, {} as any, () => {});
  };

  it("should process S3 events and handle CSV files correctly", async () => {
    const fileName = "test-file.csv";
    await invokeHandler([`uploaded/${fileName}`]);

    const { mocks } = testEnv;

    // Verify S3 operations were called correctly
    // 3 operations per file: GetObject, CopyObject, DeleteObject
    expect(mocks.s3ClientMock.send).toHaveBeenCalledTimes(3);

    expect(mocks.commands.GetObjectCommand).toHaveBeenCalledWith({
      Bucket: TEST_BUCKET_NAME,
      Key: `uploaded/${fileName}`,
    });

    expect(mocks.commands.CopyObjectCommand).toHaveBeenCalledWith({
      Bucket: TEST_BUCKET_NAME,
      CopySource: `${TEST_BUCKET_NAME}/uploaded/${fileName}`,
      Key: `parsed/${fileName}`,
    });

    expect(mocks.commands.DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: TEST_BUCKET_NAME,
      Key: `uploaded/${fileName}`,
    });
  });

  it("should process S3 events and send messages to SQS", async () => {
    const fileName = "test-file.csv";
    await invokeHandler([`uploaded/${fileName}`]);

    const { mocks } = testEnv;

    expect(mocks.s3ClientMock.send).toHaveBeenCalledTimes(3);

    expect(mocks.sqsClientMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          QueueUrl: TEST_SQS_URL,
          MessageBody: expect.any(String),
          MessageAttributes: {
            fileName: {
              DataType: "String",
              StringValue: `uploaded/${fileName}`,
            },
          },
        },
        constructor: {
          name: "SendMessageCommand",
        },
      })
    );

    expect(mocks.commands.SendMessageCommand).toHaveBeenCalledWith({
      QueueUrl: TEST_SQS_URL,
      MessageBody: JSON.stringify({
        id: "1",
        name: "Test Product",
        price: "99.99",
      }),
      MessageAttributes: {
        fileName: {
          DataType: "String",
          StringValue: `uploaded/${fileName}`,
        },
      },
    });
  });

  it("should skip files not in the 'uploaded' folder", async () => {
    await invokeHandler(["other-folder/test-file.csv"]);

    const { mocks } = testEnv;

    expect(mocks.s3ClientMock.send).not.toHaveBeenCalled();
    expect(mocks.commands.GetObjectCommand).not.toHaveBeenCalled();
    expect(mocks.commands.CopyObjectCommand).not.toHaveBeenCalled();
    expect(mocks.commands.DeleteObjectCommand).not.toHaveBeenCalled();
    expect(mocks.sqsClientMock.send).not.toHaveBeenCalled();
    expect(mocks.commands.SendMessageCommand).not.toHaveBeenCalled();
  });

  it("should handle multiple records in the event", async () => {
    await invokeHandler(["uploaded/test-file1.csv", "uploaded/test-file2.csv"]);

    const { mocks } = testEnv;
    expect(mocks.s3ClientMock.send).toHaveBeenCalledTimes(6);

    // Check GetObjectCommand was called for both files
    const getObjectCalls = (
      mocks.commands.GetObjectCommand as unknown as jest.Mock
    ).mock.calls;
    expect(getObjectCalls).toContainEqual([
      {
        Bucket: TEST_BUCKET_NAME,
        Key: "uploaded/test-file1.csv",
      },
    ]);
    expect(getObjectCalls).toContainEqual([
      {
        Bucket: TEST_BUCKET_NAME,
        Key: "uploaded/test-file2.csv",
      },
    ]);
  });

  it("should handle S3 send errors gracefully", async () => {
    const { mocks } = testEnv;
    const errorMsg = "S3 operation failed";
    mocks.s3ClientMock.send.mockRejectedValueOnce(new Error(errorMsg));

    await expect(invokeHandler(["uploaded/test-file.csv"])).rejects.toThrow(
      errorMsg
    );
    expect(console.error).toHaveBeenCalled();
  });

  it("should handle SQS send errors gracefully", async () => {
    const { mocks } = testEnv;
    const errorMsg = "SQS error";
    mocks.sqsClientMock.send.mockRejectedValueOnce(new Error(errorMsg));

    await expect(invokeHandler(["uploaded/test-file.csv"])).rejects.toThrow(
      errorMsg
    );
    expect(console.error).toHaveBeenCalled();
  });
});
