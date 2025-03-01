export const TEST_UUID = "test-uuid-123";

export const setupUuidMock = (mockUuid = TEST_UUID) => {
  jest.mock("uuid", () => ({
    v4: jest.fn().mockReturnValue(mockUuid),
  }));
};
