/**
 * Server-side route guard for authenticated pages.
 */
import { createServerFn } from "@tanstack/react-start";
import { getDb } from "~/lib/db";
import { parseCookies, getSessionUser } from "~/lib/auth";

export const requireAuth = createServerFn({ method: "GET" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();
    const cookies = parseCookies(request);
    const sessionId = cookies["pulse_session"];
    if (!sessionId) return null;
    return getSessionUser(sessionId);
  },
);

export const requireCompany = createServerFn({ method: "GET" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();
    const cookies = parseCookies(request);
    const sessionId = cookies["pulse_session"];
    if (!sessionId) return null;
    const user = getSessionUser(sessionId);
    if (!user || user.userType !== "company") return null;
    return user;
  },
);

export const requireCreator = createServerFn({ method: "GET" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();
    const cookies = parseCookies(request);
    const sessionId = cookies["pulse_session"];
    if (!sessionId) return null;
    const user = getSessionUser(sessionId);
    if (!user || user.userType !== "creator") return null;
    return user;
  },
);
