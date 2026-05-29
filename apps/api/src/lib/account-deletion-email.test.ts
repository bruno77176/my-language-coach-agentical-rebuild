import { describe, expect, it, vi } from "vitest";
import { sendDeletionConfirmationEmail } from "./account-deletion-email";

describe("sendDeletionConfirmationEmail", () => {
  it("calls Resend with the confirmation link and the user's email", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const resend = { emails: { send } };

    await sendDeletionConfirmationEmail({
      resend: resend as never,
      to: "user@example.com",
      displayName: "Alice",
      confirmUrl: "https://www.mylanguagecoach.app/delete-account/confirm?token=abc",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const args = send.mock.calls[0]![0];
    expect(args.to).toBe("user@example.com");
    expect(args.subject).toMatch(/account deletion/i);
    expect(args.html).toContain(
      "https://www.mylanguagecoach.app/delete-account/confirm?token=abc",
    );
    expect(args.html).toContain("Alice");
    expect(args.text).toContain(
      "https://www.mylanguagecoach.app/delete-account/confirm?token=abc",
    );
  });

  it("throws when Resend returns an error", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const resend = { emails: { send } };
    await expect(
      sendDeletionConfirmationEmail({
        resend: resend as never,
        to: "u@e.com",
        displayName: "x",
        confirmUrl: "https://e/x",
      }),
    ).rejects.toThrow(/rate limited/);
  });
});
