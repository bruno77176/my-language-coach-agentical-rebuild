import { describe, expect, it, vi } from "vitest";
import { deleteUserAccount } from "./account-deletion";

const userId = "00000000-0000-0000-0000-000000000001";

function makeDeps() {
  const where = vi.fn().mockResolvedValue(undefined);
  const dbDelete = vi.fn((_table: unknown) => ({ where }));
  const db = { delete: dbDelete };
  const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
  const supabaseAdmin = { auth: { admin: { deleteUser } } };
  return { db, supabaseAdmin, dbDelete, where, deleteUser };
}

describe("deleteUserAccount", () => {
  it("deletes topics rows, then profiles, then the auth user, in order", async () => {
    const { db, supabaseAdmin, dbDelete, deleteUser } = makeDeps();
    const order: string[] = [];
    dbDelete.mockImplementation((table) => {
      const t = table as { _: { name: string } };
      order.push(t._.name);
      return { where: vi.fn().mockResolvedValue(undefined) };
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

    expect(order).toEqual(["topics", "profiles", "auth.users"]);
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
