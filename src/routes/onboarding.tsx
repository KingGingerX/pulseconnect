import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { getDb, db } from "~/lib/db";

const loadOnboarding = createServerFn({ method: "GET" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) throw redirect({ to: "/login" });

 if (user.userType !== "creator") {
 throw redirect({ to: "/dashboard" });
 }

 const database = db();
 const profile = database
 .query("SELECT * FROM creator_profiles WHERE user_id = ?")
 .get(user.id) as Record<string, unknown> | undefined;

 const affiliateLinks = database
 .query("SELECT * FROM tgb_affiliate_links WHERE creator_id = ?")
 .all(user.id) as Record<string, unknown>[];

 return { user, profile, affiliateLinks };
 },
);

const updateProfileAction = createServerFn({ method: "POST" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) return { ok: false, error: "Not authenticated" };

 const form = await request.formData();
 const displayName = form.get("displayName") as string;
 const bio = form.get("bio") as string;
 const niche = form.get("niche") as string;
 const socialLinks = form.get("socialLinks") as string;

 const database = db();
 database.run(
 `UPDATE creator_profiles
 SET display_name = COALESCE(NULLIF(?, ''), display_name),
 bio = ?,
 niche = ?,
 social_links = ?,
 updated_at = datetime('now')
 WHERE user_id = ?`,
 [displayName, bio, niche, socialLinks || "{}", user.id],
 );

 return { ok: true };
 },
);

export const Route = createFileRoute("/onboarding")({
 loader: () => loadOnboarding(),
 component: OnboardingPage,
});

function OnboardingPage() {
 const { user, profile, affiliateLinks } = Route.useLoaderData();
 const navigate = useNavigate();
 const alreadyOnboarded = profile?.bio && String(profile.bio).length > 0;

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const formData = new FormData(e.currentTarget);
 const result = await updateProfileAction({ data: formData });
 if (result.ok) {
 navigate({ to: "/dashboard" });
 }
 };

 if (alreadyOnboarded) {
 return (
 <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-primary/5 to-surface px-6 ">
 <div className="w-full max-w-lg text-center">
 <div className="text-5xl">🎉</div>
 <h1 className="mt-4 text-3xl font-bold">You're all set!</h1>
 <p className="mt-2 text-text-secondary ">
 Your profile is already set up. Head to your dashboard.
 </p>
 <div className="mt-6 space-x-4">
 <Link
 to="/dashboard"
 className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 Go to Dashboard
 </Link>
 <Link
 to={`/creators/${user.id}`}
 className="inline-block rounded-lg border border-border-strong px-6 py-2.5 text-sm font-semibold text-text-bright transition hover:border-border-strong "
 >
 View My Profile
 </Link>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-dvh bg-gradient-to-b from-primary/5 via-surface to-surface px-6 py-12 ">
 <div className="mx-auto max-w-3xl">
 <div className="mb-8 text-center">
 <Link to="/" className="inline-flex items-center gap-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
 PC
 </div>
 <span className="text-sm font-bold">PulseConnect</span>
 </Link>
 </div>

 <div className="mb-8 rounded-2xl bg-gradient-to-r from-primary to-accent p-8 text-center text-white">
 <div className="text-5xl">🎉</div>
 <h1 className="mt-4 text-3xl font-bold">
 Welcome to the TGB Global Family!
 </h1>
 <p className="mx-auto mt-2 max-w-xl text-purple-100">
 As a PulseConnect creator, you're now an official TGB Global brand
 representative. This means instant credibility and your first brand
 deal from day one.
 </p>
 </div>

 <div className="mb-8 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm ">
 <h2 className="text-lg font-bold">Your Affiliate Link</h2>
 <p className="mt-1 text-sm text-text-secondary ">
 Share this link to earn commissions on every sale you drive.
 </p>
 {affiliateLinks.length > 0 && (
 <div className="mt-4 rounded-lg bg-bg-dark p-4 ">
 <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
 Your unique link
 </p>
 <div className="mt-1 flex items-center gap-2">
 <code className="flex-1 rounded border border-border-strong bg-surface px-3 py-2 text-sm ">
 {(affiliateLinks[0] as Record<string, string>)?.link_url ??
 "Generating..."}
 </code>
 <button
 onClick={() => {
 navigator.clipboard.writeText(
 (affiliateLinks[0] as Record<string, string>)?.link_url ??
 "",
 );
 }}
 className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover"
 >
 Copy
 </button>
 </div>
 <p className="mt-2 text-xs text-text-muted">
 Commission rate:{" "}
 {((affiliateLinks[0] as Record<string, number>)?.commission_rate ??
 0.1) * 100}
 %
 </p>
 </div>
 )}
 </div>

 <div className="rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm ">
 <h2 className="text-xl font-bold">Complete Your Creator Profile</h2>
 <p className="mt-1 text-sm text-text-secondary ">
 Help brands discover you — fill out your profile details
 </p>

 <form onSubmit={handleSubmit} className="mt-6 space-y-5">
 <div>
 <label
 htmlFor="displayName"
 className="block text-sm font-medium text-text-primary "
 >
 Display Name
 </label>
 <input
 id="displayName"
 name="displayName"
 type="text"
 defaultValue={profile?.display_name as string || user.name}
 className="mt-1 block w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 />
 </div>

 <div>
 <label
 htmlFor="bio"
 className="block text-sm font-medium text-text-primary "
 >
 Bio
 </label>
 <textarea
 id="bio"
 name="bio"
 rows={4}
 className="mt-1 block w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 placeholder="Tell brands about yourself, your content style, and your audience..."
 />
 </div>

 <div>
 <label
 htmlFor="niche"
 className="block text-sm font-medium text-text-primary "
 >
 Niche / Category
 </label>
 <select
 id="niche"
 name="niche"
 className="mt-1 block w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 >
 <option value="">Select a niche...</option>
 {[
 "Fashion & Beauty",
 "Tech & Gaming",
 "Health & Fitness",
 "Food & Cooking",
 "Travel & Lifestyle",
 "Music & Entertainment",
 "Education & Career",
 "Art & Design",
 "Sports & Outdoors",
 "Business & Finance",
 "Parenting & Family",
 "Pets & Animals",
 ].map((n) => (
 <option key={n} value={n}>
 {n}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-text-primary ">
 Social Links (optional)
 </label>
 <p className="mt-0.5 text-xs text-text-muted">
 Add your social media profiles as JSON: {"{"}"instagram":
 "url", "tiktok": "url"{"}"}
 </p>
 <textarea
 id="socialLinks"
 name="socialLinks"
 rows={2}
 className="mt-1 block w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm font-mono outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 placeholder='{"instagram": "https://instagram.com/...", "tiktok": "https://tiktok.com/..."}'
 defaultValue="{}"
 />
 </div>

 <button
 type="submit"
 className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 Complete Setup & Go to Dashboard
 </button>
 </form>
 </div>
 </div>
 </div>
 );
}
