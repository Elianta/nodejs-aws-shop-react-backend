import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler } from "../handler";
import { products } from "/opt/nodejs/products";

describe("getProductsList Lambda", () => {
  it("should return all products", async () => {
    const event = {} as unknown as APIGatewayProxyEvent;

    const response = (await handler(
      event,
      {} as any,
      () => {}
    )) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(products);
  });

  it("should include CORS headers in response", async () => {
    const event = {} as unknown as APIGatewayProxyEvent;

    const response = (await handler(
      event,
      {} as any,
      () => {}
    )) as APIGatewayProxyResult;

    expect(response.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    });
  });
});
