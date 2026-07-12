import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { getDb, db } from "~/lib/db";
import { createCheckoutSession, createBillingPortalSession, SUBSCRIPTION_TIERS } from "~/lib/stripe";

const loadSubscriptionPage = createServerFn({ method: "GET" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();
    const user = getUserFromRequest(request);
    if (!user) throw redirect({ to: "/login" });
    if (user.userType !== "company") throw redirect({ to: "/dashboard" });

    const database = db();

    const profile = database
      .query("SELECT * FROM company_profiles WHERE user_id = ?")
      .get(user.id) as Record<string, string> | undefined;

    const subscription = database
      .query(
        "SELECT * FROM subscriptions WHERE company_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(user.id) as Record<string, string> | undefined;

    const currentTier = SUBSCRIPTION_TIERS.find(
      (t) => t.id === (subscription?.tier ?? "logo"),
    );

    const allTiers = SUBSCRIPTION_TIERS.map((tier) => ({
      ...tier,
      isCurrent: tier.id === (subscription?.tier ?? "logo"),
      amountDisplay: `$${(tier.amount / 100).toFixed(0)}`,
    }));

    return { user, profile, subscription, currentTier, tiers: allTiers };
  },
);

const createSubscriptionCheckout = createServerFn({ method: "POST" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();
    const user = getUserFromRequest(request);
    if (!user) return { ok: false, error: "Not authenticated" };

    const form = await request.formData();
    const tierId = form.get("tierId") as string;
    if (!tierId) return { ok: false, error: "Tier ID required" };

    try {
      const baseUrl = new URL(request.url).origin;
      const result = await createCheckoutSession({
        userId: user.id,
        customerId: user.id,
        priceLookupKey: tierId,
        mode: "subscription",
        baseUrl,
        email: user.email,
      });
      return { ok: true, url: result.url };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Stripe error" };
    }
  },
);

const createPortalSession = createServerFn({ method: "POST" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();
    const user = getUserFromRequest(request);
    if (!user) return { ok: false, error: "Not authenticated" };

    try {
      const baseUrl = new URL(request.url).origin;
      const portalUrl = await createBillingPortalSession({
        stripeCustomerId: user.id, // In production: use stored stripeCustomerId
        baseUrl,
      });
      return { ok: true, url: portalUrl };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Portal error" };
    }
  },
);

export const Route = createFileRoute("/subscription")({
  loader: () => loadSubscriptionPage(),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user, profile, subscription, currentTier, tiers } =
    Route.useLoaderData();
  const navigate = useNavigate();

  const handleUpgrade = async (tierId: string) => {
    const formData = new FormData();
    formData.set("tierId", tierId);
    const result = await createSubscriptionCheckout({ data: formData });
    if (result.ok && result.url) {
      window.location.href = result.url;
    } else {
      alert(result.error ?? "Failed to create checkout session");
    }
  };

  const handleManageBilling = async () => {
    const result = await createPortalSession({ data: new FormData() });
    if (result.ok && result.url) {
      window.location.href = result.url;
    } else {
      alert(result.error ?? "Failed to open billing portal");
    }
  };

  return (
    <div className="min-h-dvh bg-bg-dark">
      <nav className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src="/pulseconnect-logo.png"
              alt="PulseConnect"
              className="h-7 w-auto"
            />
          </Link>
          <Link
            to="/dashboard"
            className="text-sm text-text-secondary hover:text-text-bright"
          >
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Subscription & Billing</h1>
          <p className="mt-1 text-text-secondary">
            Manage your {profile?.company_name ?? "company"} plan
          </p>
        </div>

        {/* Current Plan */}
        <div className="mb-8 rounded-2xl border border-border-subtle bg-surface p-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary-light">
                Current Plan
              </span>
              <h2 className="mt-3 text-xl font-bold">
                {currentTier?.name ?? "Logo Tier"}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {currentTier?.description ?? "Brand exposure on sponsor wall"}
              </p>
              <div className="mt-2">
                <span className="text-3xl font-extrabold">
                  ${((currentTier?.amount ?? 9900) / 100).toFixed(0)}
                </span>
                <span className="text-text-muted">/month</span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Status:{" "}
                <span
                  className={
                    subscription?.status === "active"
                      ? "text-success"
                      : "text-warning"
                  }
                >
                  {subscription?.status ?? "active"}
                </span>
              </p>
            </div>
            <button
              onClick={handleManageBilling}
              className="rounded-lg border border-border-strong bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-bright transition hover:bg-surface-hover"
            >
              Manage Billing
            </button>
          </div>

          {currentTier && (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Current Plan Features
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {currentTier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-accent">✓</span>
                    <span className="text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* All Plans */}
        <h2 className="mb-4 text-lg font-bold">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-2xl border-2 p-6 ${
                tier.isCurrent
                  ? "border-primary bg-primary/5"
                  : tier.popular
                    ? "border-accent/30 bg-surface"
                    : "border-border-subtle bg-surface"
              }`}
            >
              {tier.popular && !tier.isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}
              {tier.isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-white">
                  Current
                </span>
              )}
              <h3 className="text-lg font-bold">{tier.name}</h3>
              <p className="mt-1 text-sm text-text-secondary">
                {tier.description}
              </p>
              <div className="mt-3">
                <span className="text-3xl font-extrabold">
                  {tier.amountDisplay}
                </span>
                <span className="text-text-muted">/month</span>
              </div>
              <ul className="mt-4 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-accent">✓</span>
                    <span className="text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(tier.id)}
                disabled={tier.isCurrent}
                className={`mt-6 w-full rounded-lg py-2.5 text-sm font-semibold transition ${
                  tier.isCurrent
                    ? "cursor-not-allowed border border-border-strong bg-surface-elevated text-text-muted"
                    : tier.popular
                      ? "bg-accent text-white hover:bg-accent-hover"
                      : "border border-border-strong bg-surface-elevated text-text-bright hover:bg-surface-hover"
                }`}
              >
                {tier.isCurrent ? "Current Plan" : "Upgrade"}
              </button>
            </div>
          ))}
        </div>

        {/* Payment History placeholder */}
        <div className="mt-8 rounded-2xl border border-border-subtle bg-surface p-6">
          <h2 className="text-lg font-bold">Payment History</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Your payment history will appear here after your first invoice.
          </p>
          <div className="mt-4 rounded-lg border border-dashed border-border-strong p-8 text-center">
            <div className="text-3xl">💳</div>
            <p className="mt-2 text-sm text-text-muted">
              No payments yet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}