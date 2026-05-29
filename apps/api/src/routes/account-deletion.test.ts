import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createAccountDeletionRoutes } from "./account-deletion";
import { signDeletionToken } from "../lib/account-deletion-token";

const SECRET = "a".repeat(64);
const USER_ID = "00000000-0000-0000-0000-000000000001";

function mountAnon(routes: ReturnType<typeof createAccountDeletionRoutes>) {
  const app = new Hono();
  app.route("/account-deletion", routes);
  return app;
}

function mountAuthed(routes: ReturnType<typeof createAccountDeletionRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("/v1/*", async (c, next) => {
    c.set("userId", USER_ID);
    await next();
  });
  app.route("/v1/account-deletion", routes);
  return app;
}

describe("POST /account-deletion/request", () => {
  it("returns 200 even when the email is unknown (no enumeration)", async () => {
    const findUserByEmail = vi.fn().mockResolvedValue(null);
    const sendEmail = vi.fn();
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail,
      sendEmail,
      deleteUser: vi.fn(),
    });
    const app = mountAnon(routes);
    const res = await app.request("/account-deletion/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com" }),
    });
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a confirmation email when the user exists", async () => {
    const findUserByEmail = vi
      .fn()
      .mockResolvedValue({ id: USER_ID, displayName: "Alice" });
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail,
      sendEmail,
      deleteUser: vi.fn(),
    });
    const app = mountAnon(routes);
    const res = await app.request("/account-deletion/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = sendEmail.mock.calls[0]![0];
    expect(args.to).toBe("user@example.com");
    expect(args.displayName).toBe("Alice");
    expect(args.confirmUrl).toMatch(
      /^https:\/\/www\.mylanguagecoach\.app\/delete-account\/confirm\?token=/,
    );
  });

  it("rejects malformed email payloads with 400", async () => {
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail: vi.fn(),
      sendEmail: vi.fn(),
      deleteUser: vi.fn(),
    });
    const app = mountAnon(routes);
    const res = await app.request("/account-deletion/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /account-deletion/confirm", () => {
  it("deletes the user when token is valid", async () => {
    const deleteUser = vi.fn().mockResolvedValue(undefined);
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail: vi.fn(),
      sendEmail: vi.fn(),
      deleteUser,
    });
    const app = mountAnon(routes);
    const token = await signDeletionToken(SECRET, USER_ID);

    const res = await app.request("/account-deletion/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("returns 400 on a tampered token", async () => {
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail: vi.fn(),
      sendEmail: vi.fn(),
      deleteUser: vi.fn(),
    });
    const app = mountAnon(routes);
    const res = await app.request("/account-deletion/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "not.a.real.token" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /account-deletion/self (authenticated)", () => {
  it("deletes the caller's account", async () => {
    const deleteUser = vi.fn().mockResolvedValue(undefined);
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail: vi.fn(),
      sendEmail: vi.fn(),
      deleteUser,
    });
    const app = mountAuthed(routes);
    const res = await app.request("/v1/account-deletion/self", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });
});
