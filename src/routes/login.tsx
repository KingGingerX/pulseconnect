import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { verifyPassword } from "~/lib/auth";
import { getDb, db, uuid } from "~/lib/db";
import { useState } from "react";

type LoginResult =
 | { ok: true; sessionId: string; user: { id: string; name: string; userType: string } }
 | { ok: false; error: string };

const loginAction = createServerFn({ method: "POST" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const form = await request.formData();
 const email = form.get("email") as string;
 const password = form.get("password") as string;

 if (!email || !password) {
 return { ok: false, error: "Email and password are required." } as LoginResult;
 }

 const database = db();
 const user = database
 .query("SELECT * FROM users WHERE email = ?")
 .get(email) as
 | { id: string; email: string; password_hash: string; name: string; user_type: string }
 | undefined;

 if (!user) {
 return { ok: false, error: "Invalid email or password." } as LoginResult;
 }

 const valid = await verifyPassword(password, user.password_hash);
 if (!valid) {
 return { ok: false, error: "Invalid email or password." } as LoginResult;
 }

 const sid = uuid();
 const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
 database.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
 sid,
 user.id,
 expiresAt,
 ]);

 return {
 ok: true,
 sessionId: sid,
 user: { id: user.id, name: user.name, userType: user.user_type },
 } as LoginResult;
 },
);

export const Route = createFileRoute("/login")({
 component: LoginPage,
});

function LoginPage() {
 const navigate = useNavigate();
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
 setLoading(true);

 try {
 const formData = new FormData();
 formData.set("email", email);
 formData.set("password", password);

 const result = await loginAction({ data: formData });

 if (!result.ok) {
 setError(result.error ?? "Login failed.");
 setLoading(false);
 return;
 }

 // Set cookie in browser
 const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
 document.cookie = `pulse_session=${result.sessionId}; Path=/; SameSite=Lax; Expires=${expires}`;

 navigate({ to: "/dashboard" });
 } catch {
 setError("Something went wrong. Please try again.");
 setLoading(false);
 }
 };

 return (
 <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-primary/5 to-surface px-6 ">
 <div className="w-full max-w-md">
 <div className="mb-8 text-center">
 <Link to="/" className="inline-flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
 PC
 </div>
 <span className="text-lg font-bold">PulseConnect</span>
 </Link>
 <h1 className="mt-6 text-3xl font-bold">Welcome back</h1>
 <p className="mt-2 text-text-secondary ">
 Log in to your PulseConnect account
 </p>
 </div>

 <form
 onSubmit={handleSubmit}
 className="rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm "
 >
 {error && (
 <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error ">
 {error}
 </div>
 )}

 <div className="space-y-4">
 <div>
 <label
 htmlFor="email"
 className="block text-sm font-medium text-text-primary "
 >
 Email
 </label>
 <input
 id="email"
 name="email"
 type="email"
 required
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="mt-1 block w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 placeholder="you@example.com"
 />
 </div>

 <div>
 <label
 htmlFor="password"
 className="block text-sm font-medium text-text-primary "
 >
 Password
 </label>
 <input
 id="password"
 name="password"
 type="password"
 required
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="mt-1 block w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 placeholder="••••••••"
 />
 </div>
 </div>

 <button
 type="submit"
 disabled={loading}
 className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
 >
 {loading ? "Logging in..." : "Log in"}
 </button>

 <p className="mt-4 text-center text-sm text-text-secondary ">
 Don't have an account?{" "}
 <Link
 to="/signup"
 className="font-medium text-primary hover:text-primary-light"
 >
 Sign up
 </Link>
 </p>
 </form>
 </div>
 </div>
 );
}
