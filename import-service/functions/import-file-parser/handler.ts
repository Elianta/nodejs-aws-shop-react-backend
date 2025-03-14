import { S3Event, S3Handler } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Readable, Transform } from "stream";
import * as csv from "csv-parser";
import { pipeline } from "stream/promises";

const s3Client = new S3Client({ region: process.env.REGION });
const sqsClient = new SQSClient({ region: process.env.REGION });

export const handler: S3Handler = async (event: S3Event) => {
  console.log(
    "importFileParser Lambda triggered with event:",
    JSON.stringify(event)
  );

  try {
    // Process each record (there might be multiple files)
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      // Only process files in the 'uploaded' folder
      if (!key.startsWith("uploaded/")) {
        continue;
      }

      console.log(`Processing file: ${key} from bucket: ${bucket}`);

      // Get the file from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const { Body } = await s3Client.send(getObjectCommand);

      if (!Body) {
        throw new Error(`Failed to get object body for ${key}`);
      }

      const stream = Body as Readable;

      const sqsTransform = new Transform({
        objectMode: true,
        transform: async (chunk, _, callback) => {
          try {
            await sqsClient.send(
              new SendMessageCommand({
                QueueUrl: process.env.SQS_URL,
                MessageBody: JSON.stringify(chunk),
                MessageAttributes: {
                  fileName: {
                    DataType: "String",
                    StringValue: key,
                  },
                },
              })
            );
            callback(null, chunk);
          } catch (error) {
            console.error("Error sending message to SQS:", error);
            callback(error as Error);
          }
        },
      });

      // Process the CSV file using pipeline
      await pipeline(stream, csv(), sqsTransform);

      console.log(`Finished processing ${key}`);

      // Copy to parsed folder
      const newKey = key.replace("uploaded/", "parsed/");
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${key}`,
          Key: newKey,
        })
      );

      console.log(`Copied ${key} to ${newKey}`);

      // Delete from uploaded folder
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      console.log(`Deleted ${key} from uploaded folder`);
    }

    console.log("All files processed successfully");
  } catch (error) {
    console.error("Error processing files:", error);
    throw error;
  }
};
