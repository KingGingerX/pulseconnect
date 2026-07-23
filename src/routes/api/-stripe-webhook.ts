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
import { getDb, db, uuid } from "~/lib/db";
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
      const database = db();

      for (const action of result.actions) {
        switch (action.type) {
          case "grant_micro_transaction": {
            // Look up the item to determine its type
            const item = database
              .query("SELECT * FROM customization_items WHERE id = ?")
              .get(action.itemId!) as Record<string, unknown> | undefined;

            if (!item) {
              console.log("[Stripe Webhook] Unknown item:", action.itemId);
              continue;
            }

            const itemType = String(item.item_type);

            if (itemType === "boost") {
              // Insert into boosts table with auto-expiry
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
              console.log(
                `[Stripe Webhook] Boost granted: user=${action.userId}, level=${name.includes("Premium") ? "premium" : "standard"}`,
              );
            } else {
              // For themes, fonts, emojis — insert into user_customizations
              database.run(
                "INSERT OR IGNORE INTO user_customizations (id, user_id, item_id) VALUES (?, ?, ?)",
                [uuid(), action.userId, action.itemId!],
              );

              // Apply the effect for creator profiles
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
                const newEmojis = (String(item.description))
                  .split(" ")
                  .filter((e: string) => e.trim());
                const merged = [...new Set([...existing, ...newEmojis])].slice(0, 10);
                database.run(
                  "UPDATE creator_profiles SET emojis = ? WHERE user_id = ?",
                  [JSON.stringify(merged), action.userId],
                );
              }

              console.log(
                `[Stripe Webhook] Micro-transaction granted: user=${action.userId}, item=${action.itemId}, type=${itemType}`,
              );
            }
            break;
          }

          case "activate_subscription": {
            console.log(
              `[Stripe Webhook] Subscription activated: user=${action.userId}, tier=${action.tier}`,
            );
            break;
          }

          case "update_subscription": {
            console.log(
              `[Stripe Webhook] Subscription updated: user=${action.userId}, tier=${action.tier}, status=${action.status}`,
            );
            break;
          }

          case "cancel_subscription": {
            console.log(
              `[Stripe Webhook] Subscription cancelled: user=${action.userId}`,
            );
            break;
          }

          case "log": {
            console.log("[Stripe Webhook]", action.message);
            break;
          }
        }
      }

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