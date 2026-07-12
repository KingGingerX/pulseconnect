import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { readFile } from "node:fs/promises";

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
 try {
 const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
 businessName?: string;
 };
 return cfg.businessName?.trim() ?? "";
 } catch {
 return "";
 }
});

const getCurrentUser = createServerFn({ method: "GET" }).handler(
 async ({ request }: { request: Request }) => {
 return getUserFromRequest(request);
 },
);

export const Route = createFileRoute("/")({
 loader: async () => {
 const [name] = await Promise.all([getBusinessName()]);
 return { businessName: name };
 },
 component: Home,
});

function Home() {
 const { businessName } = Route.useLoaderData();

 return (
 <div className="min-h-dvh bg-gradient-to-b from-primary/5 via-surface to-surface ">
 {/* Navigation */}
 <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
 <div className="flex h-8 items-center gap-2">
           <img
             src="/pulseconnect-logo.png"
             alt="PulseConnect"
             className="h-8 w-auto"
           />
           <span className="text-lg font-bold tracking-tight text-gradient">
             {businessName || "PulseConnect"}
           </span>
         </div>
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

 {/* Hero */}
 <section className="mx-auto max-w-7xl px-6 pt-20 pb-16 text-center sm:pt-32">
 <span className="inline-block rounded-full bg-primary/15 px-4 py-1.5 text-sm font-medium text-primary-light ">
 Two-sided marketplace for authentic partnerships
 </span>
 <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl">
 Connect with{" "}
 <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
 real creators
 </span>{" "}
 who move communities
 </h1>
 <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary ">
 PulseConnect helps brands discover niche micro-influencers with genuine
 community pull — no expensive agencies, no unqualified applicants. And
 creators get their first brand deal the moment they join.
 </p>
 <div className="mt-10 flex items-center justify-center gap-4">
 <Link
 to="/signup"
 className="rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover hover:shadow-xl "
 >
 Join as a company
 </Link>
 <Link
 to="/signup"
 className="rounded-xl border-2 border-border-strong bg-surface px-8 py-3.5 text-base font-semibold text-text-bright transition hover:border-border-strong "
 >
 Join as a creator
 </Link>
 </div>
 </section>

 {/* Value Props */}
 <section className="mx-auto max-w-7xl px-6 py-20">
 <div className="grid gap-8 md:grid-cols-2">
 {/* For Companies */}
 <div className="rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm ">
 <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-2xl ">
 🏢
 </div>
 <h2 className="text-2xl font-bold">For Brands & Companies</h2>
 <p className="mt-3 text-text-secondary ">
 Discover authentic, niche micro-influencers who actually resonate
 with their audience. Skip the expensive agencies and find your
 perfect match.
 </p>
 <ul className="mt-6 space-y-3">
 {[
 "Browse vetted creators with real community pull",
 "Three subscription tiers — Logo, Access, Full Access",
 "Platform-facilitated contracts & escrow payments",
 "No contact info shared until you close a deal",
 "Clean legal docs & delivery tracking included",
 ].map((item) => (
 <li key={item} className="flex items-start gap-2">
 <span className="mt-0.5 text-accent">✓</span>
 <span className="text-sm text-text-secondary ">
 {item}
 </span>
 </li>
 ))}
 </ul>
 <Link
 to="/signup"
 className="mt-6 inline-block rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
 >
 Start browsing creators
 </Link>
 </div>

 {/* For Creators */}
 <div className="rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm ">
 <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-2xl ">
 ⭐
 </div>
 <h2 className="text-2xl font-bold">For Creators</h2>
 <p className="mt-3 text-text-secondary ">
 Get your first real brand deal the moment you join. Plus a full
 toolkit of content and marketing resources to level up your game.
 </p>
 <ul className="mt-6 space-y-3">
 {[
 "Instant brand deal — become an official TGB Global rep",
 "Profile customization with themes, fonts & emojis",
 "Built-in affiliate engine for passive income",
 "Community features & growth tools",
 "Your portfolio and credibility hub in one place",
 ].map((item) => (
 <li key={item} className="flex items-start gap-2">
 <span className="mt-0.5 text-purple-500">✓</span>
 <span className="text-sm text-text-secondary ">
 {item}
 </span>
 </li>
 ))}
 </ul>
 <Link
 to="/signup"
 className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 Join as a creator
 </Link>
 </div>
 </div>
 </section>

 {/* How It Works */}
 <section className="bg-bg-dark py-20 /50">
 <div className="mx-auto max-w-7xl px-6 text-center">
 <h2 className="text-3xl font-bold">How It Works</h2>
 <p className="mx-auto mt-4 max-w-2xl text-text-secondary ">
 A simple process for both sides of the marketplace
 </p>
 <div className="mt-12 grid gap-8 md:grid-cols-3">
 {[
 {
 step: "1",
 title: "Sign up",
 desc: "Create your profile as a company or creator. It takes 2 minutes.",
 },
 {
 step: "2",
 title: "Connect",
 desc: "Browse profiles, start conversations, and find your match — all on-platform.",
 },
 {
 step: "3",
 title: "Collaborate",
 desc: "Formalize deals, track delivery, and get paid — all through PulseConnect.",
 },
 ].map(({ step, title, desc }) => (
 <div key={step}>
 <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
 {step}
 </div>
 <h3 className="mt-6 text-xl font-bold">{title}</h3>
 <p className="mt-2 text-text-secondary ">{desc}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Subscription Tiers */}
 <section className="mx-auto max-w-7xl px-6 py-20" id="pricing">
 <h2 className="text-center text-3xl font-bold">Company Plans</h2>
 <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary ">
 Choose the tier that matches your hiring needs
 </p>
 <div className="mt-12 grid gap-8 md:grid-cols-3">
 {[
 {
 tier: "Logo",
 price: "$99",
 desc: "Brand exposure on our sponsor wall",
 features: [
 "Logo placement on sponsor wall",
 "Brand visibility to all creators",
 "Monthly impressions report",
 ],
 cta: "Get started",
 popular: false,
 },
 {
 tier: "Access",
 price: "$299",
 desc: "Browse creators and connect via DMs",
 features: [
 "Everything in Logo tier",
 "Browse full creator directory",
 "Send and receive platform DMs",
 "Filter by niche, audience, location",
 ],
 cta: "Get started",
 popular: true,
 },
 {
 tier: "Full Access",
 price: "$999",
 desc: "Unrestricted access with facilitated deals",
 features: [
 "Everything in Access tier",
 "Unrestricted creator discovery",
 "Facilitated contracts & payments",
 "Escrow payment protection",
 "Dedicated account manager",
 "Priority support",
 ],
 cta: "Get started",
 popular: false,
 },
 ].map(({ tier, price, desc, features, cta, popular }) => (
 <div
 key={tier}
 className={`relative rounded-2xl border-2 p-8 ${
 popular
 ? "border-primary bg-primary/10 shadow-xl "
 : "border-border-subtle bg-surface "
 }`}
 >
 {popular && (
 <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-white">
 Most popular
 </span>
 )}
 <h3 className="text-xl font-bold">{tier} Tier</h3>
 <p className="mt-1 text-text-secondary ">{desc}</p>
 <div className="mt-4">
 <span className="text-4xl font-extrabold">{price}</span>
 <span className="text-text-muted">/month</span>
 </div>
 <ul className="mt-6 space-y-3">
 {features.map((f) => (
 <li key={f} className="flex items-start gap-2 text-sm">
 <span className="mt-0.5 text-accent">✓</span>
 <span className="text-text-secondary ">
 {f}
 </span>
 </li>
 ))}
 </ul>
 <Link
 to="/signup"
 className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition ${
 popular
 ? "bg-primary text-white hover:bg-primary-hover"
 : "border-2 border-border-strong text-text-bright hover:border-border-strong "
 }`}
 >
 {cta}
 </Link>
 </div>
 ))}
 </div>
 </section>

 {/* TGB Global Affiliate Section */}
 <section className="bg-gradient-to-r from-primary to-accent py-20 text-white">
 <div className="mx-auto max-w-4xl px-6 text-center">
 <span className="inline-block rounded-full bg-surface/20 px-4 py-1 text-sm font-medium">
 Coming on board?
 </span>
 <h2 className="mt-6 text-3xl font-bold sm:text-4xl">
 Every creator gets their first brand deal instantly
 </h2>
 <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
 When you join PulseConnect as a creator, you're immediately onboarded
 as an official rep for TGB Global brands. It's real brand experience
 on day one — something to put on your profile and start earning from.
 </p>
 <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
 {[
 {
 title: "Instant Credibility",
 desc: "Official brand rep status on your profile from day one",
 },
 {
 title: "Affiliate Income",
 desc: "Earn commissions on every sale you drive through your unique link",
 },
 {
 title: "Real Experience",
 desc: "Build your portfolio with actual brand collaborations",
 },
 ].map(({ title, desc }) => (
 <div
 key={title}
 className="rounded-xl bg-surface/10 p-5 backdrop-blur-sm"
 >
 <h3 className="font-bold">{title}</h3>
 <p className="mt-1 text-sm text-white/70">{desc}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Testimonial / Stats */}
 <section className="mx-auto max-w-7xl px-6 py-20">
 <div className="grid gap-8 text-center md:grid-cols-3">
 {[
 { number: "500+", label: "Creators onboarded" },
 { number: "100+", label: "Brand partners" },
 { number: "95%", label: "Satisfaction rate" },
 ].map(({ number, label }) => (
 <div key={label}>
 <div className="text-5xl font-extrabold text-primary">
 {number}
 </div>
 <div className="mt-2 text-text-secondary ">
 {label}
 </div>
 </div>
 ))}
 </div>
 </section>

 {/* CTA */}
 <section className="mx-auto max-w-4xl px-6 pb-20 text-center">
 <div className="rounded-3xl bg-gray-900 p-12 ">
 <h2 className="text-3xl font-bold text-white">
 Ready to find your perfect match?
 </h2>
 <p className="mx-auto mt-4 max-w-xl text-text-muted">
 Join PulseConnect today and start building authentic creator
 partnerships that move communities.
 </p>
 <div className="mt-8 flex items-center justify-center gap-4">
 <Link
 to="/signup"
 className="rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white transition hover:bg-primary-hover"
 >
 Get started free
 </Link>
 <Link
 to="/login"
 className="rounded-xl border border-gray-700 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-gray-700"
 >
 Log in
 </Link>
 </div>
 </div>
 </section>

 {/* Footer */}
 <footer className="border-t border-border-subtle py-8 ">
 <div className="mx-auto flex max-w-7xl items-center justify-between px-6 text-sm text-text-muted">
 <span>&copy; 2026 PulseConnect. All rights reserved.</span>
 <div className="flex gap-6">
 <span>About</span>
 <span>Privacy</span>
 <span>Terms</span>
 </div>
 </div>
 </footer>
 </div>
 );
}
