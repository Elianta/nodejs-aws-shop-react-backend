#!/usr/bin/env node
import * as dotenv from "dotenv";
dotenv.config();

import * as cdk from "aws-cdk-lib";
import { ProductServiceStack } from "../lib/product-service-stack";

const app = new cdk.App();
new ProductServiceStack(app, "ProductServiceStack");
