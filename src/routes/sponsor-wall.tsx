import { Link, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb, db } from "~/lib/db";

const loadSponsors = createServerFn({ method: "GET" }).handler(async () => {
 await getDb();
 const database = db();

 const sponsors = database
 .query(
 `SELECT sl.*, cp.company_name, cp.website
 FROM sponsor_logos sl
 JOIN company_profiles cp ON cp.user_id = sl.company_id
 JOIN subscriptions s ON s.company_id = sl.company_id
 WHERE sl.active = 1 AND s.status = 'active'
 ORDER BY sl.created_at DESC`,
 )
 .all() as Record<string, unknown>[];

 const creatorCount = (
 database
 .query("SELECT COUNT(*) as count FROM users WHERE user_type = 'creator'")
 .get() as { count: number }
 ).count;

 return { sponsors, creatorCount };
});

export const Route = createFileRoute("/sponsor-wall")({
 loader: () => loadSponsors(),
 component: SponsorWall,
});

function SponsorWall() {
 const { sponsors, creatorCount } = Route.useLoaderData();

 return (
 <div className="min-h-dvh bg-gradient-to-b from-primary/5 to-surface ">
 <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
 <Link to="/" className="flex items-center gap-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
 PC
 </div>
 <span className="text-sm font-bold">PulseConnect</span>
 </Link>
 <div className="flex items-center gap-4">
 <Link
 to="/login"
 className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition hover:text-text-bright "
 >
 Log in
 </Link>
 <Link
 to="/signup"
 className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
 >
 Get started
 </Link>
 </div>
 </nav>

 <div className="mx-auto max-w-6xl px-6 py-12 text-center">
 <span className="inline-block rounded-full bg-primary/15 px-4 py-1.5 text-sm font-medium text-primary-light ">
 Sponsor Wall
 </span>
 <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
 Our Trusted Partners
 </h1>
 <p className="mx-auto mt-4 max-w-2xl text-text-secondary ">
 These brands support the PulseConnect creator community. Join them and
 get your brand in front of {creatorCount}+
 {creatorCount === 1 ? " creator." : " creators."}
 </p>

 <div className="mt-8 flex justify-center gap-8">
 <div>
 <div className="text-2xl font-bold text-primary">{sponsors.length}</div>
 <div className="text-sm text-text-muted">Active sponsors</div>
 </div>
 <div>
 <div className="text-2xl font-bold text-primary">{creatorCount}+</div>
 <div className="text-sm text-text-muted">Creators reached</div>
 </div>
 </div>

 <div className="mt-12">
 {sponsors.length === 0 ? (
 <div className="rounded-2xl border-2 border-dashed border-border-strong p-12 ">
 <div className="text-4xl">🏢</div>
 <h3 className="mt-4 text-lg font-semibold">No sponsors yet</h3>
 <p className="mt-1 text-sm text-text-secondary ">
 Be the first company to show your support!
 </p>
 <Link
 to="/signup"
 className="mt-4 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 Become a sponsor
 </Link>
 </div>
 ) : (
 <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
 {sponsors.map((sponsor) => (
 <div
 key={sponsor.id as string}
 className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm transition hover:shadow-md "
 >
 <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-accent/15 text-2xl ">
 {(sponsor.company_name as string)?.charAt(0) || "B"}
 </div>
 <h3 className="mt-4 text-lg font-bold">{sponsor.company_name as string}</h3>
 {sponsor.website && (
 <a
 href={sponsor.website as string}
 target="_blank"
 rel="noopener noreferrer"
 className="mt-1 inline-block text-sm text-primary hover:underline"
 >
 {sponsor.website as string}
 </a>
 )}
 <p className="mt-1 text-xs text-text-muted">
 Logo Tier Sponsor
 </p>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="mt-16 rounded-2xl bg-gray-900 p-8 text-white ">
 <h2 className="text-2xl font-bold">
 Want to see your brand here?
 </h2>
 <p className="mt-2 text-text-muted">
 Join our Logo Tier and get your brand in front of our creator
 community.
 </p>
 <Link
 to="/signup"
 className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 Get started with Logo Tier
 </Link>
 </div>
 </div>
 </div>
 );
}
