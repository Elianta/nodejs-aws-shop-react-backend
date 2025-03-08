import { S3Event, S3Handler } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable, Transform } from "stream";
import * as csv from "csv-parser";
import { pipeline } from "stream/promises";

const s3Client = new S3Client({ region: process.env.REGION });

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
      const getObjectParams = {
        Bucket: bucket,
        Key: key,
      };

      const { Body } = await s3Client.send(
        new GetObjectCommand(getObjectParams)
      );

      if (!Body) {
        throw new Error(`Failed to get object body for ${key}`);
      }

      const stream = Body as Readable;

      // Create a transform stream to log records
      const logTransform = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          console.log("Parsed CSV record:", JSON.stringify(chunk));
          // Pass the chunk through unchanged
          callback(null, chunk);
        },
      });

      // Process the CSV file using pipeline
      await pipeline(stream, csv(), logTransform);

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
