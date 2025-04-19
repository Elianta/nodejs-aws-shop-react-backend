import { APIGatewayProxyHandler } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const swaggerFile = fs.readFileSync(
  path.join(__dirname, 'swagger.yaml'),
  'utf8',
);
const swaggerDoc = yaml.load(swaggerFile);

const htmlTemplate = fs.readFileSync(
  path.join(__dirname, 'swagger-ui.html'),
  'utf8',
);

const html = htmlTemplate.replace(
  'SWAGGER_SPEC_PLACEHOLDER',
  JSON.stringify(swaggerDoc),
);

export const handler: APIGatewayProxyHandler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body: html,
  };
};
