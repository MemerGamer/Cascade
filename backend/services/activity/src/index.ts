import { OpenAPIHono } from "@hono/zod-openapi";

import { pinoLogger, GlobalLogger } from "@cascade/logger";
import { initKafka } from "./kafka";
import "dotenv/config";

export const app = new OpenAPIHono();

app.use(pinoLogger());

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", service: "activity-service" })
);

// OpenAPI Docs
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Activity Service API",
  },
});

// Initialize Kafka consumer
initKafka().catch((err) => GlobalLogger.logger.error(err));

GlobalLogger.logger.info(
  `Activity Service starting on port ${process.env.PORT || 3004}`
);

export default {
  port: process.env.PORT || 3004,
  fetch: app.fetch,
};
