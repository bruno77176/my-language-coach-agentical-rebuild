import { describe, expect, it, beforeEach } from "vitest";
import { useAuthStore } from "./auth-store";

describe("auth-store", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, status: "loading" });
  });

  it("starts in loading status", () => {
    expect(useAuthStore.getState().status).toBe("loading");
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("setSession updates session and flips status to authenticated", () => {
    const fakeSession = { user: { id: "user-123" } };
    useAuthStore.getState().setSession(fakeSession as never);
    expect(useAuthStore.getState().session).toBe(fakeSession);
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("setSession(null) flips status to anonymous", () => {
    useAuthStore.getState().setSession({ user: { id: "x" } } as never);
    useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe("anonymous");
  });
});
