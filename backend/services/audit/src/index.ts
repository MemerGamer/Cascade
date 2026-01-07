import { OpenAPIHono } from "@hono/zod-openapi";
import { pinoLogger, GlobalLogger } from "@cascade/logger";
import { initKafka } from "./kafka";
import "dotenv/config";

export const app = new OpenAPIHono();

app.use(pinoLogger());

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "audit-service" }));

// OpenAPI Docs
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Audit Service API",
  },
});

// Initialize Kafka consumer
initKafka().catch((err) => GlobalLogger.logger.error(err));

GlobalLogger.logger.info(
  `Audit Service starting on port ${process.env.PORT || 3005}`
);

export default {
  port: process.env.PORT || 3005,
  fetch: app.fetch,
};
