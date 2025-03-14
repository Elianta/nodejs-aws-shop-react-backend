import { Readable } from "stream";

export const setupClientS3Mock = () => {
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
};
