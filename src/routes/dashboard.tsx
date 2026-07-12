import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest, parseCookies } from "~/lib/auth";
import { getDb, db } from "~/lib/db";

const loadDashboard = createServerFn({ method: "GET" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) {
 throw redirect({ to: "/login" });
 }

 const database = db();

 if (user.userType === "creator") {
 const profile = database
 .query("SELECT * FROM creator_profiles WHERE user_id = ?")
 .get(user.id) as Record<string, unknown> | undefined;

 const messages = database
 .query(
 "SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read = 0",
 )
 .get(user.id) as { count: number };

 const affiliateLinks = database
 .query("SELECT * FROM tgb_affiliate_links WHERE creator_id = ?")
 .all(user.id) as Record<string, unknown>[];

 return {
 user,
 type: "creator" as const,
 profile,
 unreadMessages: messages.count,
 affiliateLinks,
 };
 } else {
 const profile = database
 .query("SELECT * FROM company_profiles WHERE user_id = ?")
 .get(user.id) as Record<string, unknown> | undefined;

 const subscription = database
 .query(
 "SELECT * FROM subscriptions WHERE company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
 )
 .get(user.id) as Record<string, unknown> | undefined;

 const unreadMessages = (
 database
 .query(
 "SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read = 0",
 )
 .get(user.id) as { count: number }
 ).count;

 const creatorCount = (
 database
 .query("SELECT COUNT(*) as count FROM users WHERE user_type = 'creator'")
 .get() as { count: number }
 ).count;

 return {
 user,
 type: "company" as const,
 profile,
 subscription,
 unreadMessages,
 creatorCount,
 };
 }
 },
);

const logoutAction = createServerFn({ method: "POST" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const cookies = parseCookies(request);
 const sessionId = cookies["pulse_session"];
 if (sessionId) {
 db().run("DELETE FROM sessions WHERE id = ?", [sessionId]);
 }
 return { ok: true };
 },
);

export const Route = createFileRoute("/dashboard")({
 loader: () => loadDashboard(),
 component: Dashboard,
});

function Dashboard() {
 const data = Route.useLoaderData();
 const navigate = useNavigate();

 const handleLogout = async () => {
 await logoutAction({ data: new FormData() });
 document.cookie = "pulse_session=; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
 navigate({ to: "/" });
 };

 if (data.type === "creator") {
 return <CreatorDashboard data={data} onLogout={handleLogout} />;
 }
 return <CompanyDashboard data={data} onLogout={handleLogout} />;
}

function CreatorDashboard({
 data,
 onLogout,
}: {
 data: Awaited<ReturnType<typeof loadDashboard>> & { type: "creator" };
 onLogout: () => void;
}) {
 const profile = data.profile as Record<string, string> | undefined;

 return (
 <div className="min-h-dvh bg-bg-dark ">
 <nav className="border-b border-border-subtle bg-surface ">
 <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
 <div className="flex items-center gap-6">
 <Link to="/" className="flex items-center gap-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
 PC
 </div>
 <span className="text-sm font-bold">PulseConnect</span>
 </Link>
 <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary-light ">
 Creator
 </span>
 </div>
 <div className="flex items-center gap-4">
 <Link
 to="/customize"
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 Customize Profile
 </Link>
 <Link
 to="/messages"
 className="relative text-sm text-text-secondary hover:text-text-bright "
 >
 Messages
 {data.unreadMessages > 0 && (
 <span className="absolute -right-3 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-error/100 text-[10px] font-bold text-white">
 {data.unreadMessages}
 </span>
 )}
 </Link>
 <button
 onClick={onLogout}
 className="text-sm text-text-muted hover:text-text-primary "
 >
 Log out
 </button>
 </div>
 </div>
 </nav>

 <div className="mx-auto max-w-5xl px-6 py-8">
 <div className="mb-8">
 <h1 className="text-2xl font-bold">
 Welcome, {data.user.name} 👋
 </h1>
 <p className="mt-1 text-text-secondary ">
 Your creator dashboard
 </p>
 </div>

 <div className="mb-8 rounded-2xl bg-gradient-to-r from-primary to-accent p-6 text-white">
 <div className="flex items-start justify-between">
 <div>
 <span className="rounded-full bg-surface/20 px-3 py-1 text-xs font-medium">
 Official Brand Rep
 </span>
 <h2 className="mt-3 text-xl font-bold">TGB Global</h2>
 <p className="mt-1 text-sm text-white/80">
 You're an official TGB Global brand ambassador. Share your
 affiliate link and earn commissions on every sale.
 </p>
 {data.affiliateLinks.length > 0 && (
 <div className="mt-4">
 <p className="text-xs font-medium text-white/70">
 Your affiliate link:
 </p>
 <div className="mt-1 flex items-center gap-2">
 <code className="rounded-lg bg-surface/15 px-3 py-1.5 text-sm">
 {(data.affiliateLinks[0] as Record<string, string>)
 ?.link_url ?? ""}
 </code>
 <button
 onClick={() => {
 navigator.clipboard.writeText(
 (data.affiliateLinks[0] as Record<string, string>)
 ?.link_url ?? "",
 );
 }}
 className="rounded-lg bg-surface/20 px-3 py-1.5 text-xs font-medium transition hover:bg-surface/30"
 >
 Copy
 </button>
 </div>
 </div>
 )}
 </div>
 <div className="hidden text-right sm:block">
 <div className="text-3xl">⭐</div>
 <div className="mt-1 text-xs text-white/70">
 {(data.affiliateLinks[0] as Record<string, string>)
 ?.code && `Code: ${(data.affiliateLinks[0] as Record<string, string>).code}`}
 </div>
 </div>
 </div>
 </div>

 <div className="mb-8 grid gap-4 sm:grid-cols-3">
 {[
 { label: "Profile Views", value: "—" },
 { label: "Active Deals", value: "0" },
 { label: "Unread Messages", value: String(data.unreadMessages) },
 ].map(({ label, value }) => (
 <div
 key={label}
 className="rounded-xl border border-border-subtle bg-surface p-5 "
 >
 <div className="text-2xl font-bold">{value}</div>
 <div className="mt-1 text-sm text-text-secondary ">
 {label}
 </div>
 </div>
 ))}
 </div>

 <div className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm ">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold">Your Creator Profile</h2>
 <Link
 to="/customize"
 className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover"
 >
 Customize
 </Link>
 </div>
 <div className="mt-4 flex items-start gap-4">
 <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-accent text-2xl text-white">
 {data.user.name.charAt(0).toUpperCase()}
 </div>
 <div>
 <h3 className="font-semibold">{profile?.display_name ?? data.user.name}</h3>
 <p className="text-sm text-text-secondary ">
 {profile?.bio || "No bio yet — tell brands about yourself!"}
 </p>
 <div className="mt-2 flex gap-2">
 <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-text-secondary ">
 {profile?.niche || "Niche: Not set"}
 </span>
 {profile?.is_tgb_affiliate === "1" && (
 <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs text-primary-light ">
 TGB Affiliate
 </span>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}

function CompanyDashboard({
 data,
 onLogout,
}: {
 data: Awaited<ReturnType<typeof loadDashboard>> & { type: "company" };
 onLogout: () => void;
}) {
 const profile = data.profile as Record<string, string> | undefined;
 const subscription = data.subscription as Record<string, string> | undefined;

 const tierLabels: Record<string, string> = {
 logo: "Logo Tier",
 access: "Access Tier",
 full: "Full Access Tier",
 };

 return (
 <div className="min-h-dvh bg-bg-dark ">
 <nav className="border-b border-border-subtle bg-surface ">
 <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
 <div className="flex items-center gap-6">
 <Link to="/" className="flex items-center gap-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
 PC
 </div>
 <span className="text-sm font-bold">PulseConnect</span>
 </Link>
 <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-light ">
 {tierLabels[subscription?.tier ?? "logo"] ?? "Logo Tier"}
 </span>
 </div>
 <div className="flex items-center gap-4">
 <Link
 to="/creators"
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 Browse Creators
 </Link>
 <Link
 to="/sponsor-wall"
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 Sponsor Wall
           </Link>
           <Link
             to="/subscription"
             className="text-sm text-text-secondary hover:text-text-bright"
           >
             Subscription
           </Link>
           <Link
             to="/messages"
 className="relative text-sm text-text-secondary hover:text-text-bright "
 >
 Messages
 {data.unreadMessages > 0 && (
 <span className="absolute -right-3 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-error/100 text-[10px] font-bold text-white">
 {data.unreadMessages}
 </span>
 )}
 </Link>
 <button
 onClick={onLogout}
 className="text-sm text-text-muted hover:text-text-primary "
 >
 Log out
 </button>
 </div>
 </div>
 </nav>

 <div className="mx-auto max-w-5xl px-6 py-8">
 <div className="mb-8">
 <h1 className="text-2xl font-bold">
 Welcome, {data.user.name} 🏢
 </h1>
 <p className="mt-1 text-text-secondary ">
 Your company dashboard
 </p>
 </div>

 <div className="mb-8 rounded-2xl bg-gradient-to-r from-accent to-accent p-6 text-white">
 <div className="flex items-start justify-between">
 <div>
 <span className="rounded-full bg-surface/20 px-3 py-1 text-xs font-medium">
 Current Plan
 </span>
 <h2 className="mt-3 text-xl font-bold">
 {tierLabels[subscription?.tier ?? "logo"]}
 </h2>
 <p className="mt-1 text-sm text-white/80">
 {subscription?.tier === "logo"
 ? "Your logo appears on our sponsor wall, visible to all creators."
 : subscription?.tier === "access"
 ? "Browse creators and send messages to start partnerships."
 : "Full access with facilitated contracts and escrow payments."}
 </p>
 <div className="mt-4 flex gap-3">
 <Link
 to="/creators"
 className="rounded-lg bg-surface/20 px-4 py-2 text-xs font-semibold transition hover:bg-surface/30"
 >
 Browse Creators
 </Link>
 <Link
 to="/sponsor-wall"
 className="rounded-lg bg-surface/20 px-4 py-2 text-xs font-semibold transition hover:bg-surface/30"
 >
 View Sponsor Wall
 </Link>
 </div>
 </div>
 <div className="text-right">
 <div className="text-sm text-white/70">Available creators</div>
 <div className="text-3xl font-bold">{data.creatorCount}</div>
 </div>
 </div>
 </div>

 <div className="mb-8 grid gap-4 sm:grid-cols-3">
 {[
 { label: "Active Subscription", value: subscription?.status === "active" ? "Active" : "Inactive" },
 { label: "Creator Matches", value: "—" },
 { label: "Unread Messages", value: String(data.unreadMessages) },
 ].map(({ label, value }) => (
 <div
 key={label}
 className="rounded-xl border border-border-subtle bg-surface p-5 "
 >
 <div className="text-2xl font-bold">{value}</div>
 <div className="mt-1 text-sm text-text-secondary ">
 {label}
 </div>
 </div>
 ))}
 </div>

 <div className="grid gap-4 sm:grid-cols-2">
 <Link
 to="/creators"
 className="rounded-2xl border border-border-subtle bg-surface p-6 transition hover:shadow-md "
 >
 <h3 className="font-bold">Browse Creators</h3>
 <p className="mt-1 text-sm text-text-secondary ">
 Discover niche micro-influencers with genuine community pull
 </p>
 </Link>
 <Link
 to="/messages"
 className="rounded-2xl border border-border-subtle bg-surface p-6 transition hover:shadow-md "
 >
 <h3 className="font-bold">
 Messages
 {data.unreadMessages > 0 && (
 <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-error ">
 {data.unreadMessages} unread
 </span>
 )}
 </h3>
 <p className="mt-1 text-sm text-text-secondary ">
 Communicate with creators — all on-platform
 </p>
 </Link>
 </div>
 </div>
 </div>
 );
}
