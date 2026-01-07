import { Hono, type Context } from "hono";
import { Scalar } from "@scalar/hono-api-reference";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", service: "api-docs" }));

// Service URLs - use Kubernetes internal service names when in cluster
const getServiceUrl = (serviceName: string, port: number) => {
  const isK8s = process.env.KUBERNETES_SERVICE_HOST;
  let path = "/doc";

  // Auth service uses better-auth openAPI plugin
  if (serviceName === "auth") {
    path = "/api/auth/open-api/generate-schema";
  }

  if (isK8s) {
    // In Kubernetes, prefer Helm-provided service prefix (release fullname) + namespace.
    // This avoids hard-coding "cascade-*" which breaks if the Helm release name differs.
    const prefix = process.env.CASCADE_SERVICE_PREFIX || "cascade";
    const namespace = process.env.POD_NAMESPACE;
    const host = namespace
      ? `${prefix}-${serviceName}.${namespace}.svc.cluster.local`
      : `${prefix}-${serviceName}`;
    return `http://${host}:${port}${path}`;
  }
  // In local development, use localhost
  return `http://localhost:${port}${path}`;
};

const services = [
  { name: "auth", port: 3001, label: "Auth Service" },
  { name: "board-command", port: 3002, label: "Board Command" },
  { name: "board-query", port: 3003, label: "Board Query" },
  { name: "activity", port: 3004, label: "Activity Service" },
  { name: "audit", port: 3005, label: "Audit Service" },
];

// Proxy endpoint to fetch specs server-side
app.get("/spec", async (c) => {
  const serviceName = c.req.query("service");
  const service = services.find((s) => s.name === serviceName);

  if (!service) {
    return c.json({ error: "Unknown service" }, 400);
  }

  const specUrl = getServiceUrl(service.name, service.port);

  try {
    const response = await fetch(specUrl);
    if (!response.ok) {
      return c.json(
        { error: `Failed to fetch spec: ${response.statusText}` },
        500
      );
    }
    const spec = (await response.json()) as Record<string, any>;

    // Force servers to be root relative to allow Ingress routing to work
    // For auth service, better-auth might need /api/auth if paths are relative
    // But usually setting root / works if paths are full.
    // Let's try / first for all.
    spec.servers = [{ url: "/" }];

    return c.json(spec);
  } catch (error) {
    return c.json(
      {
        error: `Error fetching spec: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      500
    );
  }
});

// Main documentation page
app.get("/", (c) => {
  const scalarMiddleware = Scalar({
    pageTitle: "Cascade API Documentation",
    theme: "kepler",
    layout: "classic",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
    // Use the proxy endpoint as sources
    sources: services.map((s) => ({
      name: s.label,
      url: `/spec?service=${s.name}`,
    })),
  });

  return scalarMiddleware(c, async () => {});
});

// Handle /reference path (for Ingress forwarding)
app.get("/reference", (c) => {
  const scalarMiddleware = Scalar({
    pageTitle: "Cascade API Documentation",
    theme: "kepler",
    layout: "classic",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
    // Use the proxy endpoint as sources (relative path works)
    sources: services.map((s) => ({
      name: s.label,
      url: `/reference/spec?service=${s.name}`,
    })),
  });

  return scalarMiddleware(c, async () => {});
});

// Handle /reference/spec for the ingress path
app.get("/reference/spec", async (c) => {
  const serviceName = c.req.query("service");
  const service = services.find((s) => s.name === serviceName);

  if (!service) {
    return c.json({ error: "Unknown service" }, 400);
  }

  const specUrl = getServiceUrl(service.name, service.port);

  try {
    const response = await fetch(specUrl);
    if (!response.ok) {
      return c.json(
        { error: `Failed to fetch spec: ${response.statusText}` },
        500
      );
    }
    const spec = (await response.json()) as Record<string, any>;
    spec.servers = [{ url: "/" }];
    return c.json(spec);
  } catch (error) {
    return c.json(
      {
        error: `Error fetching spec: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      500
    );
  }
});

export default {
  port: process.env.PORT || 3006,
  fetch: app.fetch,
};
