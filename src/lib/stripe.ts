/**
 * Stripe integration for PulseConnect.
 *
 * Manages subscription billing (Logo, Access, Full Access tiers) and
 * micro-transactions (theme, font, emoji purchases).
 *
 * IMPORTANT: This module requires the owner to connect their own Stripe account.
 * All functions will throw if STRIPE_SECRET_KEY is not set — no fallback/mock mode.
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY       — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET   — Webhook signing secret (whsec_...)
 *
 * Optional (auto-generated if not set, but setting them skips the Stripe API call):
 *   STRIPE_PRICE_ID_LOGO    — Price ID for the Logo tier ($99/mo)
 *   STRIPE_PRICE_ID_ACCESS  — Price ID for the Access tier ($299/mo)
 *   STRIPE_PRICE_ID_FULL    — Price ID for the Full Access tier ($999/mo)
 */

// Dynamic import so vite doesn't choke on the stripe dependency at build time
async function loadStripe(): Promise<typeof import("stripe")["default"]> {
  const mod = await import("stripe");
  return mod.default;
}

let _stripeInstance: Awaited<ReturnType<typeof createStripeInstance>> | null = null;

async function createStripeInstance() {
  const Stripe = await loadStripe();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. The owner must connect a Stripe account " +
        "for subscription billing. Contact the team lead.",
    );
  }
  return new Stripe(key, { apiVersion: "2025-02-24" });
}

async function getStripe() {
  if (!_stripeInstance) {
    _stripeInstance = await createStripeInstance();
  }
  return _stripeInstance;
}

// ─── Product & Price Definitions ───────────────────────────────────────────

export const SUBSCRIPTION_TIERS = [
  {
    id: "logo",
    name: "Logo Tier",
    description: "Brand exposure on our sponsor wall",
    amount: 9900, // $99.00 in cents
    monthlyAmount: 9900,
    features: [
      "Logo placement on sponsor wall",
      "Brand visibility to all creators",
      "Monthly impressions report",
    ],
  },
  {
    id: "access",
    name: "Access Tier",
    description: "Browse creators and connect via DMs",
    amount: 29900, // $299.00 in cents
    monthlyAmount: 29900,
    features: [
      "Everything in Logo tier",
      "Browse full creator directory",
      "Send and receive platform DMs",
      "Filter by niche, audience, location",
    ],
    popular: true,
  },
  {
    id: "full",
    name: "Full Access Tier",
    description: "Unrestricted access with facilitated deals",
    amount: 99900, // $999.00 in cents
    monthlyAmount: 99900,
    features: [
      "Everything in Access tier",
      "Unrestricted creator discovery",
      "Facilitated contracts & payments",
      "Escrow payment protection",
      "Dedicated account manager",
      "Priority support",
    ],
  },
] as const;

export const MICRO_TRANSACTION_PRODUCTS = [
  // Theme packs
  { id: "theme-midnight", type: "theme", name: "Midnight", amount: 499, description: "Dark gray to black gradient" },
  { id: "theme-neon", type: "theme", name: "Neon", amount: 799, description: "Electric cyan to magenta" },
  { id: "theme-rosegold", type: "theme", name: "Rose Gold", amount: 999, description: "Soft pink to gold" },
  // Font packs
  { id: "font-display", type: "font", name: "Display", amount: 299, description: "Bold impact-style headline font" },
  { id: "font-handwriting", type: "font", name: "Handwriting", amount: 599, description: "Casual handwritten style" },
  // Emoji packs
  { id: "emoji-nature", type: "emoji", name: "Nature Pack", amount: 199, description: "🌸 🌺 🌻 🌹 🌷" },
  { id: "emoji-gaming", type: "emoji", name: "Gaming Pack", amount: 299, description: "🎮 🕹️ 👾 🎯 🏆" },
  { id: "emoji-premium", type: "emoji", name: "Premium Sparkle", amount: 499, description: "✨ 🌟 💎 👑 🔥" },
  // Profile boosts
  { id: "boost-standard", type: "boost", name: "Standard Boost - 7 days", amount: 499, description: "Profile featured at top for 7 days" },
  { id: "boost-premium", type: "boost", name: "Premium Boost - 14 days", amount: 899, description: "Premium featured placement for 14 days" },
] as const;

// ─── Price ID Resolution ──────────────────────────────────────────────────

const PRICE_IDS: Record<string, string> = {};

/**
 * Get or create a Stripe price for a given tier/product.
 * Uses env var overrides first, then falls back to creating prices in Stripe.
 */
async function resolvePriceId(tierId: string): Promise<string> {
  if (PRICE_IDS[tierId]) return PRICE_IDS[tierId];

  const envKey = `STRIPE_PRICE_ID_${tierId.toUpperCase().replace(/-/g, "_")}`;
  const envPriceId = process.env[envKey];
  if (envPriceId) {
    PRICE_IDS[tierId] = envPriceId;
    return envPriceId;
  }

  const stripe = await getStripe();

  const tier = SUBSCRIPTION_TIERS.find((t) => t.id === tierId);
  if (tier) {
    const product = await stripe.products.create({
      name: tier.name,
      description: tier.description,
      metadata: { tier_id: tier.id, type: "subscription" },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.amount,
      currency: "usd",
      recurring: { interval: "month" },
    });
    PRICE_IDS[tierId] = price.id;
    return price.id;
  }

  const micro = MICRO_TRANSACTION_PRODUCTS.find((p) => p.id === tierId);
  if (micro) {
    const product = await stripe.products.create({
      name: micro.name,
      description: micro.description,
      metadata: { item_id: micro.id, type: "micro", item_type: micro.type },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: micro.amount,
      currency: "usd",
    });
    PRICE_IDS[tierId] = price.id;
    return price.id;
  }

  throw new Error(`Unknown product/tier: ${tierId}`);
}

// ─── Checkout Session Creation ────────────────────────────────────────────

export interface CheckoutParams {
  userId: string;
  customerId: string;
  priceLookupKey: string;
  mode: "subscription" | "payment";
  baseUrl: string;
  email?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

/**
 * Create a Stripe Checkout session for a subscription or micro-transaction.
 */
export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<CheckoutResult> {
  const stripe = await getStripe();
  const priceId = await resolvePriceId(params.priceLookupKey);

  const session = await stripe.checkout.sessions.create({
    mode: params.mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${params.baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.baseUrl}/dashboard?checkout=cancelled`,
    customer_email: params.email,
    client_reference_id: params.userId,
    metadata: {
      user_id: params.userId,
      customer_id: params.customerId,
      price_lookup_key: params.priceLookupKey,
      mode: params.mode,
    },
    subscription_data:
      params.mode === "subscription"
        ? {
            metadata: {
              user_id: params.userId,
              company_id: params.customerId,
              tier: params.priceLookupKey,
            },
          }
        : undefined,
    payment_intent_data:
      params.mode === "payment"
        ? {
            metadata: {
              user_id: params.userId,
              creator_id: params.customerId,
              item_id: params.priceLookupKey,
            },
          }
        : undefined,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout session returned no URL");
  }

  return { url: session.url, sessionId: session.id };
}

// ─── Webhook Handling ─────────────────────────────────────────────────────

/**
 * Verify and parse a Stripe webhook event.
 * Returns null if signature verification fails.
 */
export async function parseWebhookEvent(
  body: string,
  signature: string,
): Promise<Record<string, unknown> | null> {
  const stripe = await getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Webhook verification is disabled.",
    );
  }

  try {
    const event = stripe.webhooks.constructEvent(body, signature, secret);
    return {
      type: event.type,
      data: event.data.object as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export interface WebhookAction {
  type: "grant_micro_transaction" | "activate_subscription" | "update_subscription" | "cancel_subscription" | "log";
  userId: string;
  itemId?: string;
  itemType?: string;
  tier?: string;
  stripeSubscriptionId?: string;
  stripePaymentIntent?: string;
  status?: string;
  message?: string;
}

/**
 * Handle a Stripe webhook event and return structured DB actions to perform.
 */
export async function handleWebhookEvent(
  event: Record<string, unknown>,
): Promise<{ actions: WebhookAction[] }> {
  const actions: WebhookAction[] = [];
  const type = event.type as string;
  const data = event.data as Record<string, unknown>;

  switch (type) {
    case "checkout.session.completed": {
      const session = data;
      const metadata = (session.metadata as Record<string, string>) || {};
      const userId = metadata.user_id;
      const priceLookupKey = metadata.price_lookup_key;
      const mode = session.mode as string;

      if (mode === "subscription" && userId && priceLookupKey) {
        actions.push({
          type: "activate_subscription",
          userId,
          tier: priceLookupKey,
          stripeSubscriptionId: session.subscription as string,
        });
      }
      if (mode === "payment" && userId && priceLookupKey) {
        actions.push({
          type: "grant_micro_transaction",
          userId,
          itemId: priceLookupKey,
          stripePaymentIntent: session.payment_intent as string,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = data;
      const meta = (sub.metadata as Record<string, string>) || {};
      actions.push({
        type: "update_subscription",
        userId: meta.user_id,
        tier: meta.tier,
        status: sub.status as string,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const delSub = data;
      const delMeta = (delSub.metadata as Record<string, string>) || {};
      actions.push({
        type: "cancel_subscription",
        userId: delMeta.user_id,
      });
      break;
    }

    case "invoice.paid": {
      const invoice = data;
      actions.push({
        type: "log",
        userId: "",
        message: `Invoice paid: ${invoice.id}, amount=${invoice.amount_paid}`,
      });
      break;
    }

    case "invoice.payment_failed": {
      const failInv = data;
      actions.push({
        type: "log",
        userId: "",
        message: `Invoice payment FAILED: ${failInv.id}, attempt=${failInv.attempt_count}`,
      });
      break;
    }

    default:
      actions.push({
        type: "log",
        userId: "",
        message: `Unhandled event type: ${type}`,
      });
  }

  return { actions };
}

// ─── Billing Portal ───────────────────────────────────────────────────────

/**
 * Create a Stripe Customer Portal session for subscription management.
 */
export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  baseUrl: string;
}): Promise<string> {
  const stripe = await getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: `${params.baseUrl}/dashboard`,
  });

  return session.url;
}

// ─── Customer Management ──────────────────────────────────────────────────

/**
 * Get or create a Stripe Customer object.
 */
export async function getOrCreateCustomer(params: {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}) {
  const stripe = await getStripe();

  const existing = await stripe.customers.list({
    email: params.email,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata,
  });
}