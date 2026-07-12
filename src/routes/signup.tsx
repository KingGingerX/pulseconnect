import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "~/lib/auth";
import { getDb, db, uuid } from "~/lib/db";
import { useState } from "react";

type SignupResult =
 | { ok: true; sessionId: string; user: { id: string; name: string; userType: string } }
 | { ok: false; error: string };

const signupAction = createServerFn({ method: "POST" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const form = await request.formData();
 const email = form.get("email") as string;
 const password = form.get("password") as string;
 const name = form.get("name") as string;
 const userType = form.get("userType") as string;

 if (!email || !password || !name || !userType) {
 return { ok: false, error: "All fields are required." } as SignupResult;
 }

 if (userType !== "creator" && userType !== "company") {
 return { ok: false, error: "Invalid account type." } as SignupResult;
 }

 if (password.length < 8) {
 return {
 ok: false,
 error: "Password must be at least 8 characters.",
 } as SignupResult;
 }

 const database = db();

 // Check for existing user
 const existing = database
 .query("SELECT id FROM users WHERE email = ?")
 .get(email);
 if (existing) {
 return {
 ok: false,
 error: "An account with this email already exists.",
 } as SignupResult;
 }

 const userId = uuid();
 const passwordHash = await hashPassword(password);

 database.run(
 "INSERT INTO users (id, email, password_hash, name, user_type) VALUES (?, ?, ?, ?, ?)",
 [userId, email, passwordHash, name, userType],
 );

 // Create profile based on type
 if (userType === "creator") {
 database.run(
 "INSERT INTO creator_profiles (user_id, display_name) VALUES (?, ?)",
 [userId, name],
 );
 // Auto-onboard as TGB Global affiliate
 const affiliateCode = `tgb-${userId.slice(0, 8)}`;
 database.run(
 "UPDATE creator_profiles SET is_tgb_affiliate = 1, tgb_affiliate_code = ? WHERE user_id = ?",
 [affiliateCode, userId],
 );
 database.run(
 "INSERT INTO tgb_affiliate_links (id, creator_id, brand_name, link_url, code) VALUES (?, ?, ?, ?, ?)",
 [uuid(), userId, "TGB Global", `https://tgb.global/${affiliateCode}`, affiliateCode],
 );
 } else {
 database.run(
 "INSERT INTO company_profiles (user_id, company_name, tier) VALUES (?, ?, 'logo')",
 [userId, name],
 );
 // Auto-create subscription for the company
 database.run(
 "INSERT INTO subscriptions (id, company_id, tier, status) VALUES (?, ?, 'logo', 'active')",
 [uuid(), userId],
 );
 // Auto-create sponsor logo
 database.run(
 "INSERT INTO sponsor_logos (id, company_id, logo_url, company_name) VALUES (?, ?, '', ?)",
 [uuid(), userId, name],
 );
 }

 // Create session
 const sid = uuid();
 const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
 database.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
 sid,
 userId,
 expiresAt,
 ]);

 return {
 ok: true,
 sessionId: sid,
 user: { id: userId, name, userType },
 } as SignupResult;
 },
);

export const Route = createFileRoute("/signup")({
 component: SignupPage,
});

function SignupPage() {
 const navigate = useNavigate();
 const [step, setStep] = useState<"choose" | "form">("choose");
 const [userType, setUserType] = useState<"creator" | "company" | "">("");
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);

 const selectType = (type: "creator" | "company") => {
 setUserType(type);
 setStep("form");
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
 setLoading(true);

 try {
 const formData = new FormData();
 formData.set("email", email);
 formData.set("password", password);
 formData.set("name", name);
 formData.set("userType", userType);

 const result = await signupAction({ data: formData });

 if (!result.ok) {
 setError(result.error ?? "Signup failed.");
 setLoading(false);
 return;
 }

 // Set cookie
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
 <h1 className="mt-6 text-3xl font-bold">Create your account</h1>
 <p className="mt-2 text-text-secondary ">
 Join the PulseConnect marketplace
 </p>
 </div>

 {step === "choose" ? (
 <div className="space-y-4">
 <button
 onClick={() => selectType("company")}
 className="w-full rounded-2xl border-2 border-border-subtle bg-surface p-6 text-left transition hover:border-primary hover:shadow-md "
 >
 <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-2xl ">
 🏢
 </div>
 <h3 className="text-lg font-bold">I'm a brand or company</h3>
 <p className="mt-1 text-sm text-text-secondary ">
 Find authentic creators for partnerships and campaigns
 </p>
 </button>
 <button
 onClick={() => selectType("creator")}
 className="w-full rounded-2xl border-2 border-border-subtle bg-surface p-6 text-left transition hover:border-purple-500 hover:shadow-md "
 >
 <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-2xl ">
 ⭐
 </div>
 <h3 className="text-lg font-bold">I'm a creator</h3>
 <p className="mt-1 text-sm text-text-secondary ">
 Get brand deals and grow your influence
 </p>
 </button>
 <p className="text-center text-sm text-text-muted">
 Already have an account?{" "}
 <Link
 to="/login"
 className="font-medium text-primary hover:text-primary-light"
 >
 Log in
 </Link>
 </p>
 </div>
 ) : (
 <form
 onSubmit={handleSubmit}
 className="rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm "
 >
 <button
 type="button"
 onClick={() => setStep("choose")}
 className="mb-4 text-sm text-text-muted hover:text-text-primary "
 >
 ← Back
 </button>

 {error && (
 <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error ">
 {error}
 </div>
 )}

 <div className="space-y-4">
 <div>
 <label
 htmlFor="name"
 className="block text-sm font-medium text-text-primary "
 >
 {userType === "company" ? "Company name" : "Full name"}
 </label>
 <input
 id="name"
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="mt-1 block w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 placeholder={
 userType === "company" ? "Acme Inc." : "Jane Doe"
 }
 />
 </div>

 <div>
 <label
 htmlFor="email"
 className="block text-sm font-medium text-text-primary "
 >
 Email
 </label>
 <input
 id="email"
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
 type="password"
 required
 minLength={8}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="mt-1 block w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 "
 placeholder="At least 8 characters"
 />
 </div>

 <div className="rounded-lg bg-primary/10 p-3 ">
 <p className="text-xs text-primary-light ">
 {userType === "creator"
 ? "By signing up, you'll be onboarded as an official TGB Global brand rep — get your first brand deal instantly!"
 : "Your account starts on the Logo tier. Upgrade anytime to access more features."}
 </p>
 </div>
 </div>

 <button
 type="submit"
 disabled={loading}
 className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
 >
 {loading
 ? "Creating account..."
 : `Create ${userType === "company" ? "company" : "creator"} account`}
 </button>

 <p className="mt-4 text-center text-sm text-text-secondary ">
 Already have an account?{" "}
 <Link
 to="/login"
 className="font-medium text-primary hover:text-primary-light"
 >
 Log in
 </Link>
 </p>
 </form>
 )}
 </div>
 </div>
 );
}