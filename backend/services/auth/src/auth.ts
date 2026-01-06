import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import "dotenv/config";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/auth-db";

const client = new MongoClient(MONGODB_URI);
await client.connect();

const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.AUTH_SECRET || "default-secret-change-in-production",
  baseURL: process.env.BASE_URL || "http://localhost:3001",
  trustedOrigins: [
    "http://localhost:5173", // Frontend dev server
    "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
