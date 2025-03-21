#!/usr/bin/env node
import * as dotenv from "dotenv";
dotenv.config();

import * as cdk from "aws-cdk-lib";
import { AuthorizationServiceStack } from "../lib/authorization-service-stack";

const app = new cdk.App();
new AuthorizationServiceStack(app, "AuthorizationServiceStack");
