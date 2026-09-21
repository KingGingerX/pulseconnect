/**
 * POST /api/stripe-webhook — Stripe webhook endpoint.
 *
 * Stripe sends POST events here. Signature is verified via
 * STRIPE_WEBHOOK_SECRET before any state is mutated.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getDb, db, uuid } from "~/lib/db";
import { parseWebhookEvent, handleWebhookEvent } from "~/lib/stripe";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Map Stripe subscription statuses onto the constrained DB status enum. */
function mapSubscriptionStatus(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "canceled" || s === "unpaid" || s === "paused") return "cancelled";
  if (s === "incomplete_expired" || s === "incomplete") return "expired";
  if (s === "active" || s === "trialing" || s === "past_due") return "active";
  return "inactive";
}

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await getDb();

        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return json({ error: "Missing stripe-signature header" }, 400);
        }

        const body = await request.text();

        let event: Record<string, unknown> | null;
        try {
          event = await parseWebhookEvent(body, signature);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Webhook error";
          console.error("[Stripe Webhook Error]", message);
          return json({ error: message }, 500);
        }

        if (!event) {
          return json({ error: "Invalid signature" }, 400);
        }

        const result = await handleWebhookEvent(event);
        const database = db();

        for (const action of result.actions) {
          switch (action.type) {
            case "grant_micro_transaction": {
              const item = database
                .query("SELECT * FROM customization_items WHERE id = ?")
                .get(action.itemId!) as Record<string, unknown> | undefined;

              if (!item) continue;

              const itemType = String(item.item_type);

              if (itemType === "boost") {
                const name = String(item.name);
                const days = name.includes("Premium") ? 14 : 7;
                const expiresAt = new Date(
                  Date.now() + days * 24 * 60 * 60 * 1000,
                ).toISOString();
                database.run(
                  "INSERT INTO boosts (id, user_id, boost_level, stripe_payment_id, expires_at) VALUES (?, ?, ?, ?, ?)",
                  [
                    uuid(),
                    action.userId,
                    name.includes("Premium") ? "premium" : "standard",
                    action.stripePaymentIntent || null,
                    expiresAt,
                  ],
                );
              } else {
                database.run(
                  "INSERT OR IGNORE INTO user_customizations (id, user_id, item_id) VALUES (?, ?, ?)",
                  [uuid(), action.userId, action.itemId!],
                );

                if (itemType === "theme") {
                  const themeName = String(item.name).toLowerCase().replace(/\s+/g, "");
                  database.run(
                    "UPDATE creator_profiles SET theme = ? WHERE user_id = ?",
                    [themeName, action.userId],
                  );
                } else if (itemType === "font") {
                  const fontName = String(item.name).toLowerCase().replace(/\s+/g, "");
                  database.run(
                    "UPDATE creator_profiles SET font = ? WHERE user_id = ?",
                    [fontName, action.userId],
                  );
                } else if (itemType === "emoji") {
                  const profile = database
                    .query("SELECT emojis FROM creator_profiles WHERE user_id = ?")
                    .get(action.userId) as { emojis: string } | undefined;
                  const existing = profile?.emojis
                    ? JSON.parse(String(profile.emojis))
                    : [];
                  const newEmojis = String(item.description)
                    .split(" ")
                    .filter((e: string) => e.trim());
                  const merged = [...new Set([...existing, ...newEmojis])].slice(0, 10);
                  database.run(
                    "UPDATE creator_profiles SET emojis = ? WHERE user_id = ?",
                    [JSON.stringify(merged), action.userId],
                  );
                }
              }
              break;
            }

            case "activate_subscription": {
              const tier = action.tier ?? "logo";
              database.run(
                "INSERT INTO subscriptions (id, company_id, tier, status) VALUES (?, ?, ?, 'active')",
                [uuid(), action.userId, tier],
              );
              database.run(
                "UPDATE company_profiles SET tier = ? WHERE user_id = ?",
                [tier, action.userId],
              );
              break;
            }

            case "update_subscription": {
              if (!action.userId) continue;
              const status = mapSubscriptionStatus(action.status);
              database.run(
                "UPDATE subscriptions SET status = ? WHERE company_id = ?",
                [status, action.userId],
              );
              if (action.tier) {
                database.run(
                  "UPDATE company_profiles SET tier = ? WHERE user_id = ?",
                  [action.tier, action.userId],
                );
              }
              break;
            }

            case "cancel_subscription": {
              if (!action.userId) continue;
              database.run(
                "UPDATE subscriptions SET status = 'cancelled' WHERE company_id = ?",
                [action.userId],
              );
              break;
            }

            case "log": {
              console.log(`[Stripe Webhook] ${action.message}`);
              break;
            }
          }
        }

        return json({ received: true });
      },
    },
  },
});
