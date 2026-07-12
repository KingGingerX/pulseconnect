/**
 * POST /api/stripe/checkout — Create a Stripe Checkout session
 *
 * Body: { priceLookupKey: string, mode: "subscription" | "payment", email?: string }
 * Headers: Cookie (for auth)
 *
 * Returns: { url: string } — redirect the client to this URL
 */
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { createCheckoutSession } from "~/lib/stripe";

export const handler = createServerFn({ method: "POST" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();
    const user = getUserFromRequest(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await request.json()) as {
      priceLookupKey: string;
      mode: "subscription" | "payment";
      email?: string;
    };

    if (!body.priceLookupKey || !body.mode) {
      return new Response(
        JSON.stringify({ error: "priceLookupKey and mode are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
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

      return new Response(JSON.stringify({ url: result.url }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
);