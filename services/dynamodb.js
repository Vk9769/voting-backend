import AWS from "aws-sdk";
AWS.config.update({ region: process.env.AWS_REGION });

export const ddb = new AWS.DynamoDB.DocumentClient();
