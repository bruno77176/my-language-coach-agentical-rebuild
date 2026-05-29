import { describe, expect, it, vi } from "vitest";
import { deleteUserAccount } from "./account-deletion";
import { profiles } from "../db/schema/profiles";
import { topics } from "../db/schema/topics";

const userId = "00000000-0000-0000-0000-000000000001";

function makeDeps() {
  const where = vi.fn().mockResolvedValue(undefined);
  const dbDelete = vi.fn((_table: unknown) => ({ where }));
  const db = { delete: dbDelete };
  const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });

  // Storage mock: list returns no folders so deleteAllUserAudio is a no-op
  // unless the test overrides it. Tests that want to assert storage
  // deletion override `storageList` / `storageRemove`.
  const storageList = vi.fn().mockResolvedValue({ data: [], error: null });
  const storageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
  const storageFrom = vi.fn(() => ({
    list: storageList,
    remove: storageRemove,
  }));
  const supabaseAdmin = {
    auth: { admin: { deleteUser } },
    storage: { from: storageFrom },
  };
  return {
    db,
    supabaseAdmin,
    dbDelete,
    where,
    deleteUser,
    storageList,
    storageRemove,
    storageFrom,
  };
}

describe("deleteUserAccount", () => {
  it("deletes topics, then storage audio, then profiles, then the auth user, in order", async () => {
    const { db, supabaseAdmin, dbDelete, deleteUser, storageList } = makeDeps();
    const order: string[] = [];
    dbDelete.mockImplementation((table) => {
      if (table === topics) order.push("topics");
      else if (table === profiles) order.push("profiles");
      else order.push("unknown");
      return { where: vi.fn().mockResolvedValue(undefined) };
    });
    storageList.mockImplementation(async () => {
      order.push("storage");
      return { data: [], error: null };
    });
    deleteUser.mockImplementation(async () => {
      order.push("auth.users");
      return { data: {}, error: null };
    });

    await deleteUserAccount({
      db: db as never,
      supabaseAdmin: supabaseAdmin as never,
      userId,
    });

    expect(order).toEqual(["topics", "storage", "profiles", "auth.users"]);
  });

  it("removes all audio files under the user's prefix", async () => {
    const { db, supabaseAdmin, storageList, storageRemove } = makeDeps();
    storageList
      .mockResolvedValueOnce({
        data: [{ name: "conv-1" }, { name: "conv-2" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ name: "msg-1-0.mp3" }, { name: "msg-2-0.mp3" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ name: "msg-3-0.mp3" }],
        error: null,
      });

    await deleteUserAccount({
      db: db as never,
      supabaseAdmin: supabaseAdmin as never,
      userId,
    });

    expect(storageRemove).toHaveBeenCalledTimes(1);
    expect(storageRemove).toHaveBeenCalledWith([
      `${userId}/conv-1/msg-1-0.mp3`,
      `${userId}/conv-1/msg-2-0.mp3`,
      `${userId}/conv-2/msg-3-0.mp3`,
    ]);
  });

  it("throws if the auth user delete fails", async () => {
    const { db, supabaseAdmin, deleteUser } = makeDeps();
    deleteUser.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    await expect(
      deleteUserAccount({
        db: db as never,
        supabaseAdmin: supabaseAdmin as never,
        userId,
      }),
    ).rejects.toThrow(/boom/);
  });
});
