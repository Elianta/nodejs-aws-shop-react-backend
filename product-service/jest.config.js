module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleNameMapper: {
    "/opt/nodejs/(.*)": "<rootDir>/layers/nodejs/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
