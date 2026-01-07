import { describe, it, expect, vi } from "vitest";

// Mock Mongoose and Kafka before importing index
vi.mock("mongoose", () => {
  class Schema {
    constructor() {}
    virtual() {
      return { get: vi.fn() };
    }
  }
  (Schema as any).Types = { ObjectId: vi.fn() };

  return {
    default: {
      connect: vi.fn().mockResolvedValue(true),
      model: vi.fn(),
      Schema: Schema,
    },
  };
});

vi.mock("./kafka", () => ({
  initKafka: vi.fn().mockResolvedValue(true),
  publishBoardCreated: vi.fn(),
  publishTaskCreated: vi.fn(),
  publishTaskMoved: vi.fn(),
}));

import { app } from "./index";

describe("Board Command Service", () => {
  it("should return 200 OK on health check", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "board-command-service" });
  });
});
