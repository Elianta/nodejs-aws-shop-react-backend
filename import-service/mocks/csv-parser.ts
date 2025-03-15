import { Transform } from "stream";

export const setupCsvParserMock = () => {
  jest.mock("csv-parser", () => {
    return jest.fn().mockImplementation(() => {
      let hasEmitted = false;
      return new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          if (!hasEmitted) {
            this.push({ id: "1", name: "Test Product", price: "99.99" });
            hasEmitted = true;
          }
          callback();
        },
      });
    });
  });
};
