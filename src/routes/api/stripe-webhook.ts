/**
 * POST /api/stripe/webhook — Stripe webhook endpoint
 *
 * Stripe sends webhook events here for subscription lifecycle changes.
 * Requires STRIPE_WEBHOOK_SECRET env var for signature verification.
 *
 * Headers: stripe-signature (required)
 * Body: raw JSON payload from Stripe
 */
import { createServerFn } from "@tanstack/react-start";
import { getDb } from "~/lib/db";
import { parseWebhookEvent, handleWebhookEvent } from "~/lib/stripe";

export const handler = createServerFn({ method: "POST" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.text();

    try {
      const event = await parseWebhookEvent(body, signature);
      if (!event) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await handleWebhookEvent(event);

      // Log actions for now — in production, execute them as DB writes
      console.log("[Stripe Webhook]", event.type, result.actions);

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Webhook error";
      console.error("[Stripe Webhook Error]", message);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
);