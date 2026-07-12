/**
 * Authentication utilities for PulseConnect.
 * Password hashing via Web Crypto API and session management.
 */
import { getDb, db, uuid } from "./db";

// --- Password Hashing ---

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

function base64Encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64Decode(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_LENGTH * 8,
  );
  return `${base64Encode(salt)}:${base64Encode(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;

  const salt = base64Decode(saltB64);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_LENGTH * 8,
  );
  return base64Encode(hash) === hashB64;
}

// --- Session Management ---

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createSession(userId: string): {
  id: string;
  expiresAt: string;
} {
  const id = uuid();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const database = db();
  database.run(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    [id, userId, expiresAt],
  );
  return { id, expiresAt };
}

export function getSessionUser(sessionId: string): {
  id: string;
  email: string;
  name: string;
  userType: string;
} | null {
  if (!sessionId) return null;
  const database = db();
  const row = database
    .query(
      `SELECT u.id, u.email, u.name, u.user_type as userType
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
    .get(sessionId) as
    | { id: string; email: string; name: string; userType: string }
    | undefined;
  return row ?? null;
}

export function deleteSession(sessionId: string): void {
  const database = db();
  database.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
}

export function cleanExpiredSessions(): void {
  const database = db();
  database.run("DELETE FROM sessions WHERE expires_at <= datetime('now')");
}

// --- Cookie helpers ---

export function setSessionCookie(sessionId: string): string {
  const expires = new Date(Date.now() + SESSION_DURATION_MS).toUTCString();
  return `pulse_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Expires=${expires}`;
}

export function clearSessionCookie(): string {
  return `pulse_session=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx !== -1) {
      cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
  }
  return cookies;
}

export function getUserFromRequest(request: Request) {
  const cookies = parseCookies(request);
  const sessionId = cookies["pulse_session"];
  if (!sessionId) return null;
  return getSessionUser(sessionId);
}
