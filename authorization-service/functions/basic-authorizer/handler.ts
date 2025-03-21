import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log(
    "BASIC AUTHORIZER LAMBDA: Incoming request with event:",
    JSON.stringify(event, null, 2)
  );

  if (
    !event.authorizationToken ||
    !event.authorizationToken.startsWith("Basic ")
  ) {
    throw new Error("Unauthorized"); // 401
  }

  try {
    const encodedCreds = event.authorizationToken.split(" ")[1];
    const plainCreds = Buffer.from(encodedCreds, "base64")
      .toString()
      .split(":");

    const [username, password] = plainCreds;

    if (!username || !password) {
      throw new Error("Unauthorized"); // 401
    }

    const storedUserPassword = process.env[username];

    if (!storedUserPassword || storedUserPassword !== password) {
      throw new Error("Unauthorized"); // 401
    }

    // Check if the user is banned
    if (username === "banneduser") {
      return generatePolicy(username, "Deny", event.methodArn); // 403
    }

    return generatePolicy(username, "Allow", event.methodArn);
  } catch (error) {
    throw new Error("Unauthorized"); // 401
  }
};

function generatePolicy(
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}
