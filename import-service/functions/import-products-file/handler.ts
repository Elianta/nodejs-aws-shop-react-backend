import { APIGatewayProxyHandler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: process.env.REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log("Import Products File Lambda: ", JSON.stringify(event));

    const fileName = event.queryStringParameters?.name;

    if (!fileName) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "File name is required" }),
      };
    }

    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `uploaded/${fileName}`,
      ContentType: "text/csv",
    });
    console.log(`Generated command: ${JSON.stringify(command)}`);

    // Generate a signed URL (valid for 60 seconds)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    console.log(`Generated signed URL: ${signedUrl}`);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
        "Content-Type": "text/plain",
      },
      body: signedUrl,
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Error generating signed URL" }),
    };
  }
};
