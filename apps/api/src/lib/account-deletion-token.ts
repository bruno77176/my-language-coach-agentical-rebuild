import { SignJWT, jwtVerify } from "jose";

const PURPOSE = "account-deletion";
const EXPIRY = "24h";

function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signDeletionToken(
  secret: string,
  userId: string,
): Promise<string> {
  return new SignJWT({ userId, purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(toKey(secret));
}

export type DeletionPayload = { userId: string };

export async function verifyDeletionToken(
  secret: string,
  token: string,
): Promise<DeletionPayload> {
  const { payload } = await jwtVerify(token, toKey(secret), {
    algorithms: ["HS256"],
  });
  if (payload.purpose !== PURPOSE) {
    throw new Error("Invalid token purpose");
  }
  if (typeof payload.userId !== "string") {
    throw new Error("Invalid token payload");
  }
  return { userId: payload.userId };
}
