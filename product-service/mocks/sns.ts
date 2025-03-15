export const TEST_CREATE_PRODUCT_TOPIC_ARN = "test-create-product-topic-arn";

export const setupSnsMock = () => {
  jest.mock("@aws-sdk/client-sns", () => {
    const originalModule = jest.requireActual("@aws-sdk/client-sns");

    const mockSend = jest.fn().mockImplementation((command) => {
      return Promise.resolve({ MessageId: "test-message-id" });
    });

    return {
      ...originalModule,
      SNSClient: jest.fn(() => ({
        send: mockSend,
      })),
      PublishCommand: jest.fn().mockImplementation((params) => ({
        input: params,
        constructor: { name: "PublishCommand" },
      })),
    };
  });
};
