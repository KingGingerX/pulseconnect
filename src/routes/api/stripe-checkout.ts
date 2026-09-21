/**
 * POST /api/stripe-checkout — Create a Stripe Checkout session.
 *
 * Body (JSON): { priceLookupKey: string, mode: "subscription" | "payment", email?: string }
 * Auth: `pulse_session` cookie.
 *
 * Returns: { url: string } — redirect the client to this URL.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getUserFromRequest } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { createCheckoutSession } from "~/lib/stripe";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/stripe-checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await getDb();

        const user = getUserFromRequest(request);
        if (!user) {
          return json({ error: "Not authenticated" }, 401);
        }

        let body: {
          priceLookupKey?: string;
          mode?: "subscription" | "payment";
          email?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        if (!body.priceLookupKey || !body.mode) {
          return json(
            { error: "priceLookupKey and mode are required" },
            400,
          );
        }

        try {
          const baseUrl = new URL(request.url).origin;
          const result = await createCheckoutSession({
            userId: user.id,
            customerId: user.id,
            priceLookupKey: body.priceLookupKey,
            mode: body.mode,
            baseUrl,
            email: body.email ?? user.email,
          });
          return json({ url: result.url });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stripe error";
          return json({ error: message }, 500);
        }
      },
    },
  },
});
