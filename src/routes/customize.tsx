import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromRequest } from "~/lib/auth";
import { getDb, db, uuid } from "~/lib/db";
import { createCheckoutSession } from "~/lib/stripe";

const loadCustomizationStore = createServerFn({ method: "GET" }).handler(
 async ({ request }: { request: Request }) => {
 await getDb();
 const user = getUserFromRequest(request);
 if (!user) throw redirect({ to: "/login" });

 const database = db();

 let profile = null;
 if (user.userType === "creator") {
 profile = database
 .query("SELECT * FROM creator_profiles WHERE user_id = ?")
 .get(user.id) as Record<string, unknown> | undefined;
 }

 // Seed customization items if empty
 const existingItems = database
 .query("SELECT COUNT(*) as count FROM customization_items")
 .get() as { count: number };

 if (existingItems.count === 0) {
 const items = [
 { id: uuid(), type: "theme", name: "Sunset", desc: "Warm orange to pink gradient", price: 0 },
 { id: uuid(), type: "theme", name: "Ocean", desc: "Cool cyan to blue gradient", price: 0 },
 { id: uuid(), type: "theme", name: "Forest", desc: "Green to emerald gradient", price: 0 },
 { id: uuid(), type: "theme", name: "Midnight", desc: "Dark gray to black gradient", price: 499 },
 { id: uuid(), type: "theme", name: "Neon", desc: "Electric cyan to magenta", price: 799 },
 { id: uuid(), type: "theme", name: "Rose Gold", desc: "Soft pink to gold", price: 999 },
 { id: uuid(), type: "font", name: "Serif", desc: "Elegant Georgia serif font", price: 0 },
 { id: uuid(), type: "font", name: "Monospace", desc: "Clean monospace typewriter look", price: 0 },
 { id: uuid(), type: "font", name: "Display", desc: "Bold impact-style headline font", price: 299 },
 { id: uuid(), type: "font", name: "Handwriting", desc: "Casual handwritten style", price: 599 },
 { id: uuid(), type: "emoji", name: "Stars Pack", desc: "✨ ⭐ 🌟 💫 🌠", price: 0 },
 { id: uuid(), type: "emoji", name: "Music Pack", desc: "🎵 🎶 🎸 🎹 🥁", price: 0 },
 { id: uuid(), type: "emoji", name: "Nature Pack", desc: "🌸 🌺 🌻 🌹 🌷", price: 199 },
 { id: uuid(), type: "emoji", name: "Gaming Pack", desc: "🎮 🕹️ 👾 🎯 🏆", price: 299 },
 { id: uuid(), type: "emoji", name: "Premium Sparkle", desc: "✨ 🌟 💎 👑 🔥", price: 499 },
 ];

 for (const item of items) {
 database.run(
 "INSERT INTO customization_items (id, item_type, name, description, price) VALUES (?, ?, ?, ?, ?)",
 [item.id, item.type, item.name, item.desc, item.price],
 );
 }
 }

 const items = database
 .query(
 "SELECT * FROM customization_items WHERE available = 1 ORDER BY item_type, price ASC",
 )
 .all() as Record<string, unknown>[];

 const purchasedItems = database
 .query("SELECT item_id FROM user_customizations WHERE user_id = ?")
 .all(user.id) as { item_id: string }[];

 const purchasedIds = new Set(purchasedItems.map((p) => p.item_id));

 return { user, profile, items, purchasedIds: [...purchasedIds] };
 },
);

const purchaseItemAction = createServerFn({ method: "POST" }).handler(
  async ({ request }: { request: Request }) => {
    await getDb();
    const user = getUserFromRequest(request);
    if (!user) return { ok: false, error: "Not authenticated" };

    const form = await request.formData();
    const itemId = form.get("itemId") as string;

    if (!itemId) return { ok: false, error: "Missing item ID" };

    const database = db();

    const item = database
      .query("SELECT * FROM customization_items WHERE id = ?")
      .get(itemId) as Record<string, unknown> | undefined;

    if (!item) return { ok: false, error: "Item not found" };

    const alreadyOwned = database
      .query(
        "SELECT id FROM user_customizations WHERE user_id = ? AND item_id = ?",
      )
      .get(user.id, itemId);

    if (alreadyOwned) return { ok: false, error: "Already owned" };

    // For paid items, redirect to Stripe Checkout
    if (Number(item.price) > 0) {
      try {
        const baseUrl = new URL(request.url).origin;
        const result = await createCheckoutSession({
          userId: user.id,
          customerId: user.id,
          priceLookupKey: String(item.id),
          mode: "payment",
          baseUrl,
          email: user.email,
        });
        return { ok: true, url: result.url, redirectUrl: result.url };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Payment error",
        };
      }
    }

 database.run(
 "INSERT INTO user_customizations (id, user_id, item_id) VALUES (?, ?, ?)",
 [uuid(), user.id, itemId],
 );

 if (user.userType === "creator") {
 if (item.item_type === "theme") {
 const themeName = String(item.name).toLowerCase().replace(/\s+/g, "");
 database.run("UPDATE creator_profiles SET theme = ? WHERE user_id = ?", [
 themeName,
 user.id,
 ]);
 } else if (item.item_type === "font") {
 const fontName = String(item.name).toLowerCase().replace(/\s+/g, "");
 database.run("UPDATE creator_profiles SET font = ? WHERE user_id = ?", [
 fontName,
 user.id,
 ]);
 } else if (item.item_type === "emoji") {
 const profile = database
 .query("SELECT emojis FROM creator_profiles WHERE user_id = ?")
 .get(user.id) as { emojis: string } | undefined;

 const existing = profile?.emojis ? JSON.parse(String(profile.emojis)) : [];
 const newEmojis = (item.description as string)
 .split(" ")
 .filter((e) => e.trim());

 const merged = [...new Set([...existing, ...newEmojis])].slice(0, 10);
 database.run("UPDATE creator_profiles SET emojis = ? WHERE user_id = ?", [
 JSON.stringify(merged),
 user.id,
 ]);
 }

 const paidCount = (
 database
 .query(
 `SELECT COUNT(*) as count FROM user_customizations uc
 JOIN customization_items ci ON ci.id = uc.item_id
 WHERE uc.user_id = ? AND ci.price > 0`,
 )
 .get(user.id) as { count: number }
 ).count;

 if (paidCount >= 3) {
 database.run(
 "UPDATE creator_profiles SET customization_level = 'premium' WHERE user_id = ?",
 [user.id],
 );
 }
 }

 return { ok: true, itemType: item.item_type };
 },
);

export const Route = createFileRoute("/customize")({
 loader: () => loadCustomizationStore(),
 component: CustomizePage,
});

function CustomizePage() {
 const { user, profile, items, purchasedIds } = Route.useLoaderData();

 const themes = items.filter((i) => i.item_type === "theme");
 const fonts = items.filter((i) => i.item_type === "font");
 const emojiPacks = items.filter((i) => i.item_type === "emoji");

 const handlePurchase = async (itemId: string) => {
     const formData = new FormData();
     formData.set("itemId", itemId);
     const result = await purchaseItemAction({ data: formData });
     if (result.redirectUrl) {
       window.location.href = result.redirectUrl;
     } else if (result.ok && !result.redirectUrl) {
       window.location.reload();
     }
   };

 const isCreator = user.userType === "creator";
 const currentTheme = String(profile?.theme ?? "default");
 const currentFont = String(profile?.font ?? "sans");
 const currentEmojis = (() => {
 try {
 return JSON.parse(String(profile?.emojis ?? "[]"));
 } catch {
 return [];
 }
 })();

 if (!isCreator) {
 return (
 <div className="flex min-h-dvh items-center justify-center bg-bg-dark ">
 <div className="text-center">
 <div className="text-4xl">🎨</div>
 <h2 className="mt-4 text-xl font-bold">Creator profiles only</h2>
 <p className="mt-2 text-text-secondary ">
 Profile customization is available for creator accounts.
 </p>
 <Link
 to="/dashboard"
 className="mt-4 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
 >
 Back to Dashboard
 </Link>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-dvh bg-bg-dark ">
 <nav className="border-b border-border-subtle bg-surface ">
 <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
 <Link
 to="/dashboard"
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 ← Dashboard
 </Link>
 <Link
 to={`/creators/${user.id}`}
 className="text-sm text-text-secondary hover:text-text-bright "
 >
 Preview Profile
 </Link>
 </div>
 </nav>

 <div className="mx-auto max-w-5xl px-6 py-8">
 <div className="mb-8">
 <h1 className="text-2xl font-bold">Customize Your Profile</h1>
 <p className="mt-1 text-text-secondary ">
 Make your creator profile stand out with themes, fonts, and emojis
 </p>
 </div>

 <div className="mb-8 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm ">
 <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
 Live Preview
 </h2>
 <div className="mt-4 flex items-center gap-4">
 <div
 className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-xl font-bold text-white ${
 {
 default: "from-primary-light to-accent",
 sunset: "from-orange-400 to-pink-500",
 ocean: "from-cyan-400 to-accent",
 forest: "from-green-400 to-emerald-500",
 midnight: "from-gray-700 to-gray-900",
 neon: "from-cyan-400 to-magenta-500",
 rosegold: "from-pink-300 to-yellow-300",
 }[currentTheme] ?? "from-primary-light to-accent"
 }`}
 >
 {user.name.charAt(0).toUpperCase()}
 </div>
 <div
 className={
 {
 serif: "font-serif",
 mono: "font-mono",
 display: "font-black tracking-tight",
 handwriting: "font-serif italic",
 }[currentFont] ?? ""
 }
 >
 <div className="flex items-center gap-1">
 <span className="font-semibold">{user.name}</span>
 {currentEmojis.length > 0 && (
 <span className="text-sm">{currentEmojis.slice(0, 3).join(" ")}</span>
 )}
 </div>
 <p className="text-sm text-text-secondary ">
 {profile?.bio || "Creator bio will appear here"}
 </p>
 <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary ">
 {profile?.niche || "Creator"}
 </span>
 </div>
 </div>
 </div>

 <section className="mb-8">
 <h2 className="text-lg font-bold">Themes</h2>
 <p className="mb-4 text-sm text-text-secondary ">
 Choose a gradient for your profile avatar
 </p>
 <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
 {themes.map((item) => {
 const isOwned = purchasedIds.includes(item.id as string);
 const isActive = currentTheme === String(item.name).toLowerCase().replace(/\s+/g, "");
 const price = Number(item.price);

 return (
 <div
 key={item.id as string}
 className={`rounded-xl border p-4 ${
 isActive
 ? "border-primary bg-primary/10 "
 : "border-border-subtle bg-surface "
 }`}
 >
 <div
 className={`h-12 w-full rounded-lg bg-gradient-to-r ${
 {
 default: "from-primary-light to-accent",
 sunset: "from-orange-400 to-pink-500",
 ocean: "from-cyan-400 to-accent",
 forest: "from-green-400 to-emerald-500",
 midnight: "from-gray-700 to-gray-900",
 neon: "from-cyan-400 to-purple-500",
 rosegold: "from-pink-300 to-yellow-300",
 }[String(item.name).toLowerCase().replace(/\s+/g, "")] ?? "from-primary-light to-accent"
 }`}
 />
 <h3 className="mt-2 font-semibold">{item.name as string}</h3>
 <p className="text-xs text-text-muted">{item.description as string}</p>
 <div className="mt-2 flex items-center justify-between">
 <span className="text-sm font-medium">
 {price === 0 ? "Free" : `${(price / 100).toFixed(2)} credits`}
 </span>
 {isOwned ? (
 <span className="text-xs text-success ">
 {isActive ? "✓ Active" : "Owned"}
 </span>
 ) : (
 <button
 onClick={() => handlePurchase(item.id as string)}
 className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-hover"
 >
 {price === 0 ? "Apply" : "Buy"}
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </section>

 <section className="mb-8">
 <h2 className="text-lg font-bold">Fonts</h2>
 <p className="mb-4 text-sm text-text-secondary ">
 Change the font style on your profile
 </p>
 <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
 {fonts.map((item) => {
 const isOwned = purchasedIds.includes(item.id as string);
 const isActive = currentFont === String(item.name).toLowerCase().replace(/\s+/g, "");
 const price = Number(item.price);
 const fontClass = {
 serif: "font-serif",
 mono: "font-mono",
 display: "font-black tracking-tight",
 handwriting: "font-serif italic",
 }[String(item.name).toLowerCase().replace(/\s+/g, "")];

 return (
 <div
 key={item.id as string}
 className={`rounded-xl border p-4 ${
 isActive
 ? "border-primary bg-primary/10 "
 : "border-border-subtle bg-surface "
 } ${fontClass ?? ""}`}
 >
 <h3 className="font-semibold">{item.name as string}</h3>
 <p className="text-xs text-text-muted">{item.description as string}</p>
 <div className="mt-2 flex items-center justify-between">
 <span className="text-sm font-medium">
 {price === 0 ? "Free" : `${(price / 100).toFixed(2)} credits`}
 </span>
 {isOwned ? (
 <span className="text-xs text-success ">
 {isActive ? "✓ Active" : "Owned"}
 </span>
 ) : (
 <button
 onClick={() => handlePurchase(item.id as string)}
 className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-hover"
 >
 {price === 0 ? "Apply" : "Buy"}
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </section>

 <section className="mb-8">
 <h2 className="text-lg font-bold">Emoji Packs</h2>
 <p className="mb-4 text-sm text-text-secondary ">
 Add flair to your display name
 </p>
 <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
 {emojiPacks.map((item) => {
 const isOwned = purchasedIds.includes(item.id as string);
 const price = Number(item.price);

 return (
 <div
 key={item.id as string}
 className={`rounded-xl border p-4 ${
 isOwned
 ? "border-accent/30 bg-primary/10 "
 : "border-border-subtle bg-surface "
 }`}
 >
 <div className="text-2xl">
 {(item.description as string).split(" ").slice(0, 3).join(" ")}
 </div>
 <h3 className="mt-2 font-semibold">{item.name as string}</h3>
 <p className="text-xs text-text-muted">{item.description as string}</p>
 <div className="mt-2 flex items-center justify-between">
 <span className="text-sm font-medium">
 {price === 0 ? "Free" : `${(price / 100).toFixed(2)} credits`}
 </span>
 {isOwned ? (
 <span className="text-xs text-success ">
 ✓ Owned
 </span>
 ) : (
 <button
 onClick={() => handlePurchase(item.id as string)}
 className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-hover"
 >
 {price === 0 ? "Get" : "Buy"}
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </section>

 {profile && (profile.customization_level as string) === "premium" && (
 <div className="rounded-2xl bg-gradient-to-r from-warning to-warning p-6 text-white">
 <h3 className="text-lg font-bold">✨ Premium Profile</h3>
 <p className="mt-1 text-sm text-white/80">
 You've unlocked premium status by purchasing 3+ paid items!
 </p>
 </div>
 )}
 </div>
 </div>
 );
}
