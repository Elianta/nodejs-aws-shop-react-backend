# Product Service

A serverless product service built with AWS CDK.

## Prerequisites

- Node.js (v18 or later recommended)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)

## Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Development

`npm run build` - Cleans the dist directory and builds the TypeScript code

## Testing

`npm run test` - Runs Jest tests with coverage report

## Deployment

Before deploying, ensure you have:

1. AWS CLI configured with appropriate credentials
2. CDK bootstrapped in your AWS account/region

`npm run deploy` - Runs tests, builds the project, and deploys to AWS using CDK

`npm run destroy` - Removes all resources from AWS created by this stack
