import { describe, it, expect, vi } from "vitest";

// Mock MongoDB, Auth, and Kafka before importing index
vi.mock("mongodb", () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(true),
    db: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock("./auth", () => ({
  auth: {
    handler: vi.fn(),
  },
}));

vi.mock("./kafka", () => ({
  initKafka: vi.fn().mockResolvedValue(true),
  publishUserRegistered: vi.fn(),
  publishUserLoggedIn: vi.fn(),
}));

import { app } from "./index";

describe("Auth Service", () => {
  it("should return 200 OK on health check", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "auth-service" });
  });
});
