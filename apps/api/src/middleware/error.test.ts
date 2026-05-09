import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "./error";

describe("errorHandler", () => {
  it("returns 500 + INTERNAL for unhandled errors", async () => {
    const onError = vi.fn();
    const app = new Hono();
    app.onError(errorHandler(onError));
    app.get("/", () => {
      throw new Error("boom");
    });

    const res = await app.request("/");
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).toBeTruthy();
    // Must NOT leak stack trace
    expect(JSON.stringify(body)).not.toContain("at Object");
    expect(onError).toHaveBeenCalledOnce();
  });
});
