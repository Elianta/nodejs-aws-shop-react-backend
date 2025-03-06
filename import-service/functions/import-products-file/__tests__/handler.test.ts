import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const TEST_SIGNED_URL = "https://mock-signed-url.com";
const TEST_BUCKET_NAME = "XXXXXXXXXXX";
const TEST_REGION = "us-east-1";
const TEST_FILE_NAME = "test-file.csv";

jest.mock("@aws-sdk/client-s3", () => {
  const originalModule = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...originalModule,
    S3Client: jest.fn(() => ({
      send: jest.fn(),
    })),
  };
});
jest.mock("@aws-sdk/s3-request-presigner");

import { handler } from "../handler";

const invokeHandler = async (
  fileName?: string
): Promise<APIGatewayProxyResult> => {
  const event = {
    queryStringParameters: fileName ? { name: fileName } : {},
  } as unknown as APIGatewayProxyEvent;

  return (await handler(event, {} as any, () => {})) as APIGatewayProxyResult;
};

describe("import-products-file Lambda", () => {
  const originalEnv = process.env;
  let shouldThrowError = false;

  beforeEach(() => {
    // Set environment variables for tests
    process.env.BUCKET_NAME = TEST_BUCKET_NAME;
    process.env.REGION = TEST_REGION;

    // Mock getSignedUrl implementation
    (getSignedUrl as jest.Mock).mockImplementation(() => {
      if (shouldThrowError) {
        return Promise.reject(new Error("Test error"));
      }
      return Promise.resolve(TEST_SIGNED_URL);
    });
    // Clear console mocks between tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = { ...originalEnv };
    // Clear all mocks
    jest.clearAllMocks();
    // Reset the error flag
    shouldThrowError = false;
  });

  it("should return a signed URL when fileName is provided", async () => {
    const response = await invokeHandler(TEST_FILE_NAME);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(TEST_SIGNED_URL);
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    const [s3ClientArg, commandArg, optionsArg] = (getSignedUrl as jest.Mock)
      .mock.calls[0];

    expect(s3ClientArg).toBeTruthy();
    expect(commandArg.input).toEqual({
      Bucket: TEST_BUCKET_NAME,
      Key: `uploaded/${TEST_FILE_NAME}`,
      ContentType: "text/csv",
    });
    expect(optionsArg).toEqual({ expiresIn: 60 });
  });

  it("should return 400 when fileName is not provided", async () => {
    const response = await invokeHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: "File name is required",
    });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("should return 500 when getSignedUrl throws an error", async () => {
    shouldThrowError = true;

    const response = await invokeHandler("test-file.csv");

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: "Error generating signed URL",
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error generating signed URL:",
      expect.any(Error)
    );
  });
});
