import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { getDb, db, uuid } from "~/lib/db";
import { useState } from "react";

const loadCreatorProfile = createServerFn({ method: "GET" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) throw redirect({ to: "/login" });

 const url = new URL(request.url);
 const creatorId = url.searchParams.get("creatorId");
 if (!creatorId) throw redirect({ to: "/creators" });

 const database = db();

 const creator = database
 .query(
 `SELECT u.id, u.name, u.email, cp.display_name, cp.bio, cp.avatar_url,
 cp.niche, cp.social_links, cp.theme, cp.font, cp.emojis,
 cp.customization_level, cp.is_tgb_affiliate, cp.tgb_affiliate_code
 FROM users u
 JOIN creator_profiles cp ON cp.user_id = u.id
 WHERE u.id = ? AND u.user_type = 'creator'`,
 )
 .get(creatorId) as Record<string, unknown> | undefined;

 if (!creator) {
 throw redirect({ to: "/creators" });
 }

 const customizations = database
 .query(
 `SELECT ci.* FROM user_customizations uc
 JOIN customization_items ci ON ci.id = uc.item_id
 WHERE uc.user_id = ?`,
 )
 .all(creatorId) as Record<string, unknown>[];

 const existingConvo = database
 .query(
 `SELECT c.id
 FROM conversations c
 WHERE (c.user1_id = ? AND c.user2_id = ?)
 OR (c.user1_id = ? AND c.user2_id = ?)
 LIMIT 1`,
 )
 .get(user.id, creatorId, creatorId, user.id) as { id: string } | undefined;

 return { user, creator, customizations, existingConvoId: existingConvo?.id ?? null };
 },
);

const sendMessageAction = createServerFn({ method: "POST" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) return { ok: false, error: "Not authenticated" };

 const form = await request.formData();
 const receiverId = form.get("receiverId") as string;
 const body = form.get("body") as string;

 if (!receiverId || !body) {
 return { ok: false, error: "Missing required fields" };
 }

 const database = db();

 const existingConvo = database
 .query(
 `SELECT id FROM conversations
 WHERE (user1_id = ? AND user2_id = ?)
 OR (user1_id = ? AND user2_id = ?)
 LIMIT 1`,
 )
 .get(user.id, receiverId, receiverId, user.id) as { id: string } | undefined;

 let convoId: string;
 if (existingConvo) {
 convoId = existingConvo.id;
 } else {
 convoId = uuid();
 database.run(
 "INSERT INTO conversations (id, user1_id, user2_id) VALUES (?, ?, ?)",
 [convoId, user.id, receiverId],
 );
 }

 const msgId = uuid();
 database.run(
 "INSERT INTO messages (id, sender_id, receiver_id, subject, body) VALUES (?, ?, ?, ?, ?)",
 [msgId, user.id, receiverId, "", body],
 );

 database.run(
 "UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?",
 [convoId],
 );

 return { ok: true, messageId: msgId, convoId };
 },
);

export const Route = createFileRoute("/creators/$id")({
 loader: async ({ params }) => {
 const data = await loadCreatorProfile();
 return { ...data, params };
 },
 component: CreatorProfile,
});

function CreatorProfile() {
 const { user, creator, customizations, existingConvoId } = Route.useLoaderData();
 const [message, setMessage] = useState("");
 const [sending, setSending] = useState(false);
 const navigate = useNavigate();

 if (!creator) return null;

 const socialLinks = (() => {
 try {
 return JSON.parse(String(creator.social_links ?? "{}"));
 } catch {
 return {};
 }
 })();

 const emojis = (() => {
 try {
 return JSON.parse(String(creator.emojis ?? "[]"));
 } catch {
 return [];
 }
 })();

 const themeClasses: Record<string, string> = {
 default: "from-primary-light to-accent",
 sunset: "from-orange-400 to-pink-500",
 ocean: "from-cyan-400 to-accent",
 forest: "from-green-400 to-emerald-500",
 midnight: "from-gray-700 to-gray-900",
 };

 const avatarGradient =
 themeClasses[String(creator.theme ?? "default")] ?? themeClasses.default;

 const fontClasses: Record<string, string> = {
 sans: "font-['Inter',system-ui,sans-serif]",
 serif: "font-['Georgia',serif]",
 mono: "font-['Courier_New',monospace]",
 display: "font-['Impact',sans-serif]",
 };

 const profileFont = fontClasses[String(creator.font ?? "sans")] ?? fontClasses.sans;

 const isOwnProfile = user.id === creator.id;
 const canMessage = user.userType === "company" && !isOwnProfile;

 const handleSendMessage = async () => {
 if (!message.trim()) return;
 setSending(true);

 const formData = new FormData();
 formData.set("receiverId", creator.id as string);
 formData.set("body", message);

 const result = await sendMessageAction({ data: formData });
 if (result.ok) {
 setMessage("");
 navigate({ to: `/messages/${result.convoId}` });
 }
 setSending(false);
 };

 return (
 <div className="min-h-dvh bg-bg-dark ">
 <nav className="border-b border-border-subtle bg-surface ">
 <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
 <Link to="/creators" className="text-sm text-text-secondary hover:text-text-bright ">
 ← Back to creators
 </Link>
 <Link
 to="/dashboard"
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 Dashboard
 </Link>
 </div>
 </nav>

 <div className="mx-auto max-w-4xl px-6 py-8">
 <div className="rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm ">
 <div className={`flex items-start gap-6 ${profileFont}`}>
 <div
 className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-4xl font-bold text-white ${avatarGradient}`}
 >
 {((creator.display_name as string) || creator.name as string).charAt(0).toUpperCase()}
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-start justify-between">
 <div>
 <h1 className="text-2xl font-bold">
 {emojis.length > 0 && (
 <span className="mr-2">{emojis.slice(0, 3).join(" ")}</span>
 )}
 {creator.display_name as string || creator.name as string}
 </h1>
 <div className="mt-2 flex flex-wrap gap-2">
 {creator.niche && (
 <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-text-secondary ">
 {creator.niche as string}
 </span>
 )}
 {creator.is_tgb_affiliate === 1 && (
 <span className="rounded-full bg-primary/15 px-3 py-1 text-xs text-primary-light ">
 TGB Global Affiliate
 </span>
 )}
 {creator.customization_level === "premium" && (
 <span className="rounded-full bg-warning/15 px-3 py-1 text-xs text-warning ">
 Premium Profile
 </span>
 )}
 </div>
 </div>
 </div>

 <div className={`mt-4 ${profileFont}`}>
 <p className="text-text-primary ">
 {creator.bio || "This creator hasn't written a bio yet."}
 </p>
 </div>

 {Object.keys(socialLinks).length > 0 && (
 <div className="mt-4 flex flex-wrap gap-3">
 {Object.entries(socialLinks).map(([platform, url]) => (
 <a
 key={platform}
 href={url as string}
 target="_blank"
 rel="noopener noreferrer"
 className="rounded-full bg-gray-100 px-3 py-1 text-xs text-text-secondary hover:bg-gray-200 "
 >
 {platform}
 </a>
 ))}
 </div>
 )}
 </div>
 </div>

 {customizations.length > 0 && (
 <div className="mt-6 border-t border-border-subtle pt-4 ">
 <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
 Customizations
 </p>
 <div className="mt-2 flex flex-wrap gap-2">
 {customizations.map((item) => (
 <span
 key={item.id as string}
 className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary-light "
 >
 {(item.name as string) ?? (item.item_type as string)}
 </span>
 ))}
 </div>
 </div>
 )}

 {creator.is_tgb_affiliate === 1 && (
 <div className="mt-6 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 p-4 ">
 <p className="text-xs font-medium text-primary-light ">
 Official TGB Global Brand Representative
 </p>
 <p className="mt-1 text-xs text-primary-light ">
 This creator is an official partner of TGB Global
 </p>
 </div>
 )}

 {canMessage && (
 <div className="mt-6 border-t border-border-subtle pt-6 ">
 {existingConvoId ? (
 <Link
 to={`/messages/${existingConvoId}`}
 className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 View Conversation
 </Link>
 ) : (
 <div>
 <h3 className="text-sm font-semibold">
 Send a message to {creator.display_name as string || creator.name as string}
 </h3>
 <div className="mt-2 flex gap-2">
 <textarea
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 placeholder="Hi! We'd love to collaborate..."
 className="min-h-[80px] flex-1 resize-none rounded-lg border border-border-strong p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 "
 rows={3}
 />
 </div>
 <div className="mt-2 flex justify-end">
 <button
 onClick={handleSendMessage}
 disabled={sending || !message.trim()}
 className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
 >
 {sending ? "Sending..." : "Send Message"}
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {isOwnProfile && (
 <div className="mt-6 border-t border-border-subtle pt-6 ">
 <Link
 to="/customize"
 className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 Customize Your Profile
 </Link>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
