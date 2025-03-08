import { S3Event } from "aws-lambda";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const TEST_REGION = "us-east-1";
const TEST_BUCKET_NAME = "test-bucket";

jest.mock("@aws-sdk/client-s3", () => {
  const originalModule = jest.requireActual("@aws-sdk/client-s3");
  const mockReadableStream = new Readable({
    read() {
      this.push("id,name,price\n");
      this.push("1,Test Product,99.99\n");
      this.push(null);
    },
  });

  const mockSend = jest.fn().mockImplementation((command) => {
    if (command.constructor.name === "GetObjectCommand") {
      return Promise.resolve({
        Body: mockReadableStream,
      });
    }
    return Promise.resolve({});
  });

  return {
    ...originalModule,
    S3Client: jest.fn(() => ({
      send: mockSend,
    })),
    GetObjectCommand: jest.fn().mockImplementation((params) => ({
      input: params,
      constructor: { name: "GetObjectCommand" },
    })),
    CopyObjectCommand: jest.fn().mockImplementation((params) => ({
      input: params,
      constructor: { name: "CopyObjectCommand" },
    })),
    DeleteObjectCommand: jest.fn().mockImplementation((params) => ({
      input: params,
      constructor: { name: "DeleteObjectCommand" },
    })),
  };
});

// Mock the csv-parser and stream/promises
jest.mock("csv-parser", () => {
  return jest.fn().mockImplementation(() => {
    const csvTransform = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        callback(null, { id: "1", name: "Test Product", price: "99.99" });
      },
    });
    return csvTransform;
  });
});

jest.mock("stream/promises", () => {
  return {
    pipeline: jest.fn().mockResolvedValue(undefined),
  };
});

import { handler } from "../handler";

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

  return await handler(mockEvent, {} as any, () => {});
};

describe("import-file-parser Lambda", () => {
  const originalEnv = process.env;
  let s3ClientMock: any;

  beforeEach(() => {
    // Set environment variables for tests
    process.env.REGION = TEST_REGION;

    // Create a new instance of the S3Client before each test
    // This ensures we have access to the mock even if the handler doesn't use it
    s3ClientMock = new S3Client({});

    // Clear console mocks between tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = { ...originalEnv };
    // Clear all mocks
    jest.clearAllMocks();
  });

  it("should process S3 events and handle CSV files correctly", async () => {
    const fileName = "test-file.csv";
    await invokeHandler([`uploaded/${fileName}`]);

    // Verify S3 operations were called correctly
    // 3 operations per file: GetObject, CopyObject, DeleteObject
    expect(s3ClientMock.send).toHaveBeenCalledTimes(3);

    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: TEST_BUCKET_NAME,
      Key: `uploaded/${fileName}`,
    });

    expect(CopyObjectCommand).toHaveBeenCalledWith({
      Bucket: TEST_BUCKET_NAME,
      CopySource: `${TEST_BUCKET_NAME}/uploaded/${fileName}`,
      Key: `parsed/${fileName}`,
    });

    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: TEST_BUCKET_NAME,
      Key: `uploaded/${fileName}`,
    });

    expect(pipeline).toHaveBeenCalled();
  });

  it("should skip files not in the 'uploaded' folder", async () => {
    await invokeHandler(["other-folder/test-file.csv"]);

    expect(s3ClientMock.send).not.toHaveBeenCalled();
    expect(GetObjectCommand).not.toHaveBeenCalled();
    expect(CopyObjectCommand).not.toHaveBeenCalled();
    expect(DeleteObjectCommand).not.toHaveBeenCalled();
  });

  it("should handle multiple records in the event", async () => {
    await invokeHandler(["uploaded/test-file1.csv", "uploaded/test-file2.csv"]);

    expect(s3ClientMock.send).toHaveBeenCalledTimes(6);

    // Check GetObjectCommand was called for both files
    const getObjectCalls = (GetObjectCommand as unknown as jest.Mock).mock
      .calls;
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

  it("should handle errors gracefully", async () => {
    s3ClientMock.send.mockRejectedValueOnce(new Error("S3 operation failed"));

    await expect(invokeHandler(["uploaded/test-file.csv"])).rejects.toThrow(
      "S3 operation failed"
    );

    expect(console.error).toHaveBeenCalled();
  });
});
