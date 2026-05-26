import { describe, expect, it } from "vitest";
import { identitiesFromSession, canUnlink } from "./use-identities";

describe("identitiesFromSession", () => {
  it("returns an empty list when session is null", () => {
    expect(identitiesFromSession(null)).toEqual([]);
  });

  it("normalizes Supabase identities array to {id, provider} entries", () => {
    const session = {
      user: {
        identities: [
          { id: "id-1", identity_id: "i1", provider: "email" },
          { id: "id-2", identity_id: "i2", provider: "google" },
        ],
      },
    } as never;
    expect(identitiesFromSession(session)).toEqual([
      { id: "id-1", identityId: "i1", provider: "email" },
      { id: "id-2", identityId: "i2", provider: "google" },
    ]);
  });
});

describe("canUnlink", () => {
  it("returns false when there is only one identity", () => {
    const identities = [
      { id: "id-1", identityId: "i1", provider: "email" as const },
    ];
    expect(canUnlink(identities, identities[0]!)).toBe(false);
  });

  it("returns true when there are multiple identities", () => {
    const identities = [
      { id: "id-1", identityId: "i1", provider: "email" as const },
      { id: "id-2", identityId: "i2", provider: "google" as const },
    ];
    expect(canUnlink(identities, identities[0]!)).toBe(true);
    expect(canUnlink(identities, identities[1]!)).toBe(true);
  });
});
