// Signed session cookie for managers (no database access here, so Proxy can use it too).
import { SignJWT, jwtVerify } from "jose";

// Login is required so only club managers can edit the schedule.
export const AUTH_DISABLED = false;

export const SESSION_COOKIE = "hapoel_admin_session";
const SESSION_DAYS = 30;

export type SessionPayload = { uid: number; ver: number; role: string };

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set. Add it in Netlify → Environment variables.");
    }
    return new TextEncoder().encode("local-development-only-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number" || typeof payload.ver !== "number") return null;
    return { uid: payload.uid, ver: payload.ver, role: String(payload.role ?? "admin") };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
