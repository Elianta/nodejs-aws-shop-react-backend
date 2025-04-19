# BFF Service CDK Infrastructure

This project contains the AWS CDK infrastructure code for the BFF (Backend-For-Frontend) service.

## Prerequisites

- Node.js (as per package.json)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)

## Environment Variables

Create a `.env` file in the root of the cdk directory with the following variables:

```env
BFF_API_EB_URL=<bff-eb-api-url>
```

## Instalation

```bash
npm install
```

## Useful scripts

`npm run build` - Compiles TypeScript to JS and runs build script

`npm run deploy` - Build and deploy the stack to AWS

## Project structure

```
bff-service/cdk/
├── bin/                # CDK app entry point
├── lib/               # Stack definitions
├── scripts/           # Build and utility scripts
├── test/             # Test files
├── cdk.json          # CDK configuration
└── tsconfig.json     # TypeScript configuration
```
