import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { getDb, db } from "~/lib/db";

const loadConversations = createServerFn({ method: "GET" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) throw redirect({ to: "/login" });

 const database = db();

 const conversations = database
 .query(
 `SELECT c.id, c.last_message_at,
 u.id as other_user_id, u.name as other_name, u.user_type as other_type,
 cp.display_name as creator_display_name,
 (SELECT body FROM messages WHERE
 (sender_id = c.user1_id AND receiver_id = c.user2_id) OR
 (sender_id = c.user2_id AND receiver_id = c.user1_id)
 ORDER BY created_at DESC LIMIT 1) as last_message,
 (SELECT COUNT(*) FROM messages WHERE
 ((sender_id = c.user1_id AND receiver_id = c.user2_id) OR
 (sender_id = c.user2_id AND receiver_id = c.user1_id))
 AND receiver_id = ? AND read = 0) as unread
 FROM conversations c
 LEFT JOIN users u ON (u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END)
 LEFT JOIN creator_profiles cp ON cp.user_id = u.id
 WHERE c.user1_id = ? OR c.user2_id = ?
 ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
 )
 .all(user.id, user.id, user.id, user.id) as Record<string, unknown>[];

 return { user, conversations };
 },
);

export const Route = createFileRoute("/messages/")({
 loader: () => loadConversations(),
 component: MessagesInbox,
});

function MessagesInbox() {
 const { user, conversations } = Route.useLoaderData();

 return (
 <div className="min-h-dvh bg-bg-dark ">
 <nav className="border-b border-border-subtle bg-surface ">
 <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
 <Link to="/dashboard" className="text-sm text-text-secondary hover:text-text-bright ">
 ← Dashboard
 </Link>
 <span className="text-sm font-semibold">Messages</span>
 <div />
 </div>
 </nav>

 <div className="mx-auto max-w-4xl px-6 py-8">
 <h1 className="mb-6 text-2xl font-bold">Inbox</h1>

 {conversations.length === 0 ? (
 <div className="rounded-2xl border-2 border-dashed border-border-strong p-12 text-center ">
 <div className="text-4xl">💬</div>
 <h3 className="mt-4 text-lg font-semibold">No messages yet</h3>
 <p className="mt-1 text-sm text-text-secondary ">
 {user.userType === "company"
 ? "Browse creators and send them a message to get started."
 : "When a company reaches out, you'll see their messages here."}
 </p>
 {user.userType === "company" && (
 <Link
 to="/creators"
 className="mt-4 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 Browse Creators
 </Link>
 )}
 </div>
 ) : (
 <div className="space-y-3">
 {conversations.map((convo) => {
 const otherName =
 (convo.creator_display_name as string) ||
 (convo.other_name as string) ||
 "Unknown User";
 const unread = Number(convo.unread ?? 0);

 return (
 <Link
 key={convo.id as string}
 to={`/messages/${convo.id as string}`}
 className={`block rounded-xl border p-4 transition hover:shadow-sm ${
 unread > 0
 ? "border-accent/30 bg-primary/10 "
 : "border-border-subtle bg-surface "
 }`}
 >
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-accent text-sm font-bold text-white">
 {otherName.charAt(0).toUpperCase()}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="font-semibold">{otherName}</span>
 {convo.other_type === "company" && (
 <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent-light ">
 Company
 </span>
 )}
 {unread > 0 && (
 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-error/100 text-[10px] font-bold text-white">
 {unread}
 </span>
 )}
 </div>
 <p className="mt-0.5 line-clamp-1 text-sm text-text-muted">
 {(convo.last_message as string) || "No messages yet"}
 </p>
 </div>
 </div>
 {convo.last_message_at && (
 <span className="shrink-0 text-xs text-text-muted">
 {new Date(convo.last_message_at as string).toLocaleDateString()}
 </span>
 )}
 </div>
 </Link>
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
}
