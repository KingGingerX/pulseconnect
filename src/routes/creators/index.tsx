import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { getDb, db } from "~/lib/db";

const loadCreators = createServerFn({ method: "GET" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) throw redirect({ to: "/login" });

 const database = db();

 const creators = database
 .query(
 `SELECT u.id, u.name, u.email, cp.display_name, cp.bio, cp.avatar_url,
 cp.niche, cp.theme, cp.font, cp.is_tgb_affiliate,
 (SELECT COUNT(*) FROM messages WHERE receiver_id = u.id AND read = 0) as unread_messages
 FROM users u
 JOIN creator_profiles cp ON cp.user_id = u.id
 WHERE u.user_type = 'creator'
 ORDER BY u.created_at DESC`,
 )
 .all() as Record<string, unknown>[];

 const niches = database
 .query(
 `SELECT DISTINCT cp.niche FROM creator_profiles cp WHERE cp.niche != '' AND cp.niche IS NOT NULL`,
 )
 .all() as { niche: string }[];

 return { user, creators, niches: niches.map((n) => n.niche) };
 },
);

export const Route = createFileRoute("/creators/")({
 loader: () => loadCreators(),
 component: CreatorsPage,
});

function CreatorsPage() {
 const { user, creators, niches } = Route.useLoaderData();

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
 </div>
 <div className="flex items-center gap-4">
 <Link
 to="/dashboard"
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 Dashboard
 </Link>
 <Link
 to="/messages"
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 Messages
 </Link>
 </div>
 </div>
 </nav>

 <div className="mx-auto max-w-6xl px-6 py-8">
 <div className="mb-8">
 <h1 className="text-2xl font-bold">Browse Creators</h1>
 <p className="mt-1 text-text-secondary ">
 Discover niche micro-influencers with genuine community pull
 </p>
 </div>

 <div className="mb-8 flex flex-wrap gap-3">
 <span className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-light ">
 All Niches
 </span>
 {niches.slice(0, 10).map((niche) => (
 <span
 key={niche}
 className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-text-secondary hover:bg-gray-200 "
 >
 {niche}
 </span>
 ))}
 </div>

 {creators.length === 0 ? (
 <div className="rounded-2xl border-2 border-dashed border-border-strong p-12 text-center ">
 <div className="text-4xl">👀</div>
 <h3 className="mt-4 text-lg font-semibold">No creators yet</h3>
 <p className="mt-1 text-sm text-text-secondary ">
 Creators who sign up will appear here.
 </p>
 </div>
 ) : (
 <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
 {creators.map((creator) => (
 <Link
 key={creator.id as string}
 to={`/creators/${creator.id as string}`}
 className="group rounded-2xl border border-border-subtle bg-surface p-6 transition hover:shadow-md "
 >
 <div className="flex items-start gap-4">
 <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-accent text-xl font-bold text-white">
 {((creator.display_name as string) || creator.name as string).charAt(0).toUpperCase()}
 </div>
 <div className="min-w-0">
 <h3 className="font-semibold group-hover:text-primary">
 {creator.display_name as string || creator.name as string}
 </h3>
 {creator.niche && (
 <span className="mt-0.5 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary ">
 {creator.niche as string}
 </span>
 )}
 <p className="mt-1.5 line-clamp-2 text-xs text-text-muted">
 {(creator.bio as string) || "No bio yet."}
 </p>
 {creator.is_tgb_affiliate === 1 && (
 <span className="mt-2 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary-light ">
 TGB Affiliate
 </span>
 )}
 </div>
 </div>
 </Link>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}
