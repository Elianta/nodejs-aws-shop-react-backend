#!/usr/bin/env node
import * as dotenv from 'dotenv';
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BffApiStack } from '../lib/bff-api-stack';

dotenv.config();

const app = new cdk.App();
new BffApiStack(app, 'BffApiStack', {
  env: {
    // These will use your AWS CLI configuration
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
