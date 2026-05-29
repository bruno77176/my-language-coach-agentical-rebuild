import type { Resend } from "resend";

const FROM = "My Language Coach <noreply@mylanguagecoach.app>";

export type SendDeletionEmailInput = {
  resend: Resend;
  to: string;
  displayName: string;
  confirmUrl: string;
};

export async function sendDeletionConfirmationEmail(
  input: SendDeletionEmailInput,
): Promise<void> {
  const { resend, to, displayName, confirmUrl } = input;
  const subject = "Confirm account deletion — My Language Coach";
  const safeName = displayName || "there";

  const text =
    `Hi ${safeName},\n\n` +
    `Someone (hopefully you) asked to delete your My Language Coach account ` +
    `and all associated data.\n\n` +
    `Confirm by opening this link within 24 hours:\n${confirmUrl}\n\n` +
    `If you didn't request this, ignore this email — your account will not be deleted.\n\n` +
    `— My Language Coach`;

  const html =
    `<p>Hi ${escapeHtml(safeName)},</p>` +
    `<p>Someone (hopefully you) asked to delete your My Language Coach account and all associated data.</p>` +
    `<p>Confirm by opening this link within 24 hours:</p>` +
    `<p><a href="${escapeHtml(confirmUrl)}">${escapeHtml(confirmUrl)}</a></p>` +
    `<p>If you didn't request this, ignore this email — your account will not be deleted.</p>` +
    `<p>— My Language Coach</p>`;

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject,
    text,
    html,
  });
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message ?? "unknown"}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
