import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { getDb, db, uuid } from "~/lib/db";
import { useState, useEffect, useRef } from "react";

const loadConversation = createServerFn({ method: "GET" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) throw redirect({ to: "/login" });

 const url = new URL(request.url);
 const convoId = url.searchParams.get("convoId");
 if (!convoId) throw redirect({ to: "/messages" });

 const database = db();

 const convo = database
 .query("SELECT * FROM conversations WHERE id = ?")
 .get(convoId) as Record<string, string> | undefined;

 if (!convo) throw redirect({ to: "/messages" });

 if (convo.user1_id !== user.id && convo.user2_id !== user.id) {
 throw redirect({ to: "/messages" });
 }

 const otherUserId = convo.user1_id === user.id ? convo.user2_id : convo.user1_id;

 const otherUser = database
 .query("SELECT id, name, user_type FROM users WHERE id = ?")
 .get(otherUserId) as { id: string; name: string; user_type: string } | undefined;

 const otherProfile = database
 .query("SELECT display_name FROM creator_profiles WHERE user_id = ?")
 .get(otherUserId) as { display_name: string } | undefined;

 const messages = database
 .query(
 `SELECT m.* FROM messages m
 WHERE (m.sender_id = ? AND m.receiver_id = ?)
 OR (m.sender_id = ? AND m.receiver_id = ?)
 ORDER BY m.created_at ASC`,
 )
 .all(convo.user1_id, convo.user2_id, convo.user2_id, convo.user1_id) as Record<string, unknown>[];

 // Mark messages as read
 database.run(
 "UPDATE messages SET read = 1 WHERE receiver_id = ? AND sender_id = ? AND read = 0",
 [user.id, otherUserId],
 );

 return {
 user,
 convo,
 otherUser,
 otherDisplayName: otherProfile?.display_name,
 messages,
 };
 },
);

const sendMessageAction = createServerFn({ method: "POST" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) return { ok: false, error: "Not authenticated" };

 const form = await request.formData();
 const convoId = form.get("convoId") as string;
 const body = form.get("body") as string;
 const receiverId = form.get("receiverId") as string;

 if (!convoId || !body || !receiverId) {
 return { ok: false, error: "Missing required fields" };
 }

 const database = db();

 const msgId = uuid();
 database.run(
 "INSERT INTO messages (id, sender_id, receiver_id, subject, body) VALUES (?, ?, ?, ?, ?)",
 [msgId, user.id, receiverId, "", body],
 );

 database.run(
 "UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?",
 [convoId],
 );

 return { ok: true, messageId: msgId };
 },
);

export const Route = createFileRoute("/messages/$id")({
 loader: async ({ params }) => {
 const data = await loadConversation();
 return { ...data, params };
 },
 component: ConversationView,
});

function ConversationView() {
 const { user, otherUser, otherDisplayName, messages: initialMessages, convo } =
 Route.useLoaderData();
 const [messages, setMessages] = useState(initialMessages);
 const [newMessage, setNewMessage] = useState("");
 const [sending, setSending] = useState(false);
 const bottomRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 bottomRef.current?.scrollIntoView({ behavior: "smooth" });
 }, [messages]);

 const otherName = otherDisplayName || otherUser?.name || "Unknown";
 const isCompany = otherUser?.user_type === "company";

 const handleSend = async () => {
 if (!newMessage.trim() || !otherUser) return;
 setSending(true);

 const formData = new FormData();
 formData.set("convoId", convo.id as string);
 formData.set("body", newMessage);
 formData.set("receiverId", otherUser.id);

 const result = await sendMessageAction({ data: formData });
 if (result.ok) {
 setMessages((prev) => [
 ...prev,
 {
 id: result.messageId,
 sender_id: user.id,
 receiver_id: otherUser.id,
 body: newMessage,
 subject: "",
 read: 0,
 created_at: new Date().toISOString(),
 },
 ]);
 setNewMessage("");
 }
 setSending(false);
 };

 return (
 <div className="flex min-h-dvh flex-col bg-bg-dark ">
 <nav className="border-b border-border-subtle bg-surface ">
 <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
 <Link
 to="/messages"
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 ← Inbox
 </Link>
 <div className="flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-accent text-xs font-bold text-white">
 {otherName.charAt(0).toUpperCase()}
 </div>
 <span className="text-sm font-semibold">{otherName}</span>
 {isCompany && (
 <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent-light ">
 Company
 </span>
 )}
 </div>
 <div />
 </div>
 </nav>

 <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-6 py-6">
 <div className="space-y-4">
 {messages.length === 0 && (
 <div className="py-12 text-center">
 <p className="text-text-muted ">
 No messages yet. Send the first message!
 </p>
 </div>
 )}
 {(messages as Record<string, unknown>[]).map((msg) => {
 const isMe = msg.sender_id === user.id;
 return (
 <div
 key={msg.id as string}
 className={`flex ${isMe ? "justify-end" : "justify-start"}`}
 >
 <div
 className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
 isMe
 ? "rounded-br-sm bg-primary text-white"
 : "rounded-bl-sm border border-border-subtle bg-surface "
 }`}
 >
 <p className="text-sm">{msg.body as string}</p>
 <p
 className={`mt-1 text-right text-[10px] ${
 isMe ? "text-accent-light" : "text-text-muted"
 }`}
 >
 {new Date(msg.created_at as string).toLocaleTimeString([], {
 hour: "2-digit",
 minute: "2-digit",
 })}
 </p>
 </div>
 </div>
 );
 })}
 <div ref={bottomRef} />
 </div>
 </div>

 <div className="border-t border-border-subtle bg-surface p-4 ">
 <div className="mx-auto flex max-w-4xl gap-3">
 <input
 type="text"
 value={newMessage}
 onChange={(e) => setNewMessage(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter" && !e.shiftKey) {
 e.preventDefault();
 handleSend();
 }
 }}
 placeholder="Type a message..."
 className="flex-1 rounded-xl border border-border-strong px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 />
 <button
 onClick={handleSend}
 disabled={sending || !newMessage.trim()}
 className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
 >
 {sending ? "..." : "Send"}
 </button>
 </div>
 </div>
 </div>
 );
}
