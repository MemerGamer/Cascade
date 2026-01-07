import { describe, it, expect } from "vitest";
import { app } from "./index";

describe("Board Command Service", () => {
  it("should return 200 OK on health check", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "board-command-service" });
  });
});
