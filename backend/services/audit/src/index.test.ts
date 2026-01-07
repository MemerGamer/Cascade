import { describe, it, expect, vi } from "vitest";

// Mock Mongoose and Kafka before importing index
vi.mock("mongoose", () => ({
  default: {
    connect: vi.fn().mockResolvedValue(true),
    model: vi.fn(),
    Schema: vi.fn(),
  },
}));

vi.mock("./kafka", () => ({
  initKafka: vi.fn().mockResolvedValue(true),
}));

import { app } from "./index";

describe("Audit Service", () => {
  it("should return 200 OK on health check", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "audit-service" });
  });
});
