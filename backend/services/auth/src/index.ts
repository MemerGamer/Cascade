import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { cors } from "hono/cors";
import { pinoLogger, GlobalLogger } from "@cascade/logger";
import { auth } from "./auth";
import { initKafka, publishUserRegistered, publishUserLoggedIn } from "./kafka";
import "dotenv/config";

export const app = new OpenAPIHono();

const BetterAuthOpenAPISpecSchema = z.object({}).passthrough();

// Middleware
app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
  })
);
app.use(pinoLogger());

// Health check
app.openapi(
  createRoute({
    method: "get",
    path: "/health",
    responses: {
      200: {
        description: "Health check",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string(),
              service: z.string(),
            }),
          },
        },
      },
    },
  }),
  (c) => c.json({ status: "ok", service: "auth-service" })
);

// OpenAPI Docs (service-level; Better Auth exposes its own schema under /api/auth/open-api/*)
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Auth Service API",
  },
});

// Better Auth OpenAPI (documented + validated as "returns an object")
app.openapi(
  createRoute({
    method: "get",
    path: "/api/auth/open-api/generate-schema",
    responses: {
      200: {
        description: "Better Auth OpenAPI schema",
        content: {
          "application/json": {
            schema: BetterAuthOpenAPISpecSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const response = await auth.handler(c.req.raw);
    return response as any;
  }
);

// Better-Auth routes
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const response = await auth.handler(c.req.raw);

  // Extract user info from registration/login for Kafka events
  try {
    const url = new URL(c.req.url);
    const path = url.pathname;

    if (path.includes("/sign-up") && c.req.method === "POST") {
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      if (data.user) {
        await publishUserRegistered(
          data.user.id,
          data.user.email,
          data.user.name
        );
      }
    } else if (path.includes("/sign-in") && c.req.method === "POST") {
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      if (data.user) {
        await publishUserLoggedIn(data.user.id, data.user.email);
      }
    }
  } catch (error) {
    GlobalLogger.logger.error(error, "Error publishing Kafka event");
  }

  return response;
});

// Initialize Kafka
await initKafka();

GlobalLogger.logger.info(
  `Auth Service starting on port ${process.env.PORT || 3001}`
);

export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
};
