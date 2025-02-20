import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler } from "../handler";
import { products } from "/opt/nodejs/products";

describe("getProductById Lambda", () => {
  it("should return product when valid ID is provided", async () => {
    const event = {
      pathParameters: {
        productId: products[0].id,
      },
    } as unknown as APIGatewayProxyEvent;

    const response = (await handler(
      event,
      {} as any,
      () => {}
    )) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(products[0]);
  });

  it("should return 404 when product is not found", async () => {
    const event = {
      pathParameters: {
        productId: "non-existent-id",
      },
    } as unknown as APIGatewayProxyEvent;

    const response = (await handler(
      event,
      {} as any,
      () => {}
    )) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      message: "Product not found",
    });
  });

  it("should return 500 when an error occurs", async () => {
    const event = null as unknown as APIGatewayProxyEvent;

    const response = (await handler(
      event,
      {} as any,
      () => {}
    )) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });
  });

  it("should include CORS headers in response", async () => {
    const event = {
      pathParameters: {
        productId: products[0].id,
      },
    } as unknown as APIGatewayProxyEvent;

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
