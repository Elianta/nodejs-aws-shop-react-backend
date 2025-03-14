export const setupClientSqsMock = () => {
  jest.mock("@aws-sdk/client-sqs", () => {
    const originalModule = jest.requireActual("@aws-sdk/client-sqs");

    const mockSend = jest.fn().mockResolvedValue({});

    return {
      ...originalModule,
      SQSClient: jest.fn(() => ({
        send: mockSend,
      })),
      SendMessageCommand: jest.fn().mockImplementation((params) => ({
        input: params,
        constructor: { name: "SendMessageCommand" },
      })),
    };
  });
};
