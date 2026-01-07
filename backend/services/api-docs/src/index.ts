import { Hono } from "hono";
import { Scalar } from "@scalar/hono-api-reference";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", service: "api-docs" }));

app.get(
  "/",
  Scalar({
    pageTitle: "Cascade API Documentation",
    theme: "kepler",
    layout: "classic",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
    content: {
      openapi: "3.0.0",
      info: {
        title: "Cascade API",
        version: "1.0.0",
      },
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Auth Service",
      },
      {
        url: "http://localhost:3002",
        description: "Board Command Service",
      },
      {
        url: "http://localhost:3003",
        description: "Board Query Service",
      },
      {
        url: "http://localhost:3004",
        description: "Activity Service",
      },
      {
        url: "http://localhost:3005",
        description: "Audit Service",
      },
    ],
  })
);

export default {
  port: process.env.PORT || 3006,
  fetch: app.fetch,
};
