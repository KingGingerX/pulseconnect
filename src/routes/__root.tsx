import {
 HeadContent,
 Outlet,
 Scripts,
 createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
 head: () => ({
 meta: [
 { charSet: "utf-8" },
       { name: "viewport", content: "width=device-width, initial-scale=1" },
       { title: "PulseConnect — Authentic Creator Partnerships" },
       {
         name: "description",
         content:
           "Discover and connect with niche micro-influencers and rising creators who have genuine community pull.",
       },
       // Open Graph
       { property: "og:title", content: "PulseConnect — Authentic Creator Partnerships" },
       { property: "og:description", content: "Discover and connect with niche micro-influencers and rising creators who have genuine community pull." },
       { property: "og:image", content: "https://2fd922cf6eb29505add660e4b9af3586.ctonew.app/og-image.png" },
       { property: "og:image:width", content: "1200" },
       { property: "og:image:height", content: "630" },
       { property: "og:type", content: "website" },
       // Twitter Card
       { name: "twitter:card", content: "summary_large_image" },
       { name: "twitter:title", content: "PulseConnect — Authentic Creator Partnerships" },
       { name: "twitter:description", content: "Discover and connect with niche micro-influencers and rising creators who have genuine community pull." },
       { name: "twitter:image", content: "https://2fd922cf6eb29505add660e4b9af3586.ctonew.app/og-image.png" },
     ],
     links: [
       { rel: "stylesheet", href: appCss },
       {
         rel: "preconnect",
         href: "https://fonts.googleapis.com",
       },
       {
         rel: "preconnect",
         href: "https://fonts.gstatic.com",
         crossOrigin: "anonymous",
       },
       {
         rel: "stylesheet",
         href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
       },
     ],
 }),
 notFoundComponent: () => <div>Page not found</div>,
 component: RootComponent,
});

function RootComponent() {
 return (
 <RootDocument>
 <Outlet />
 </RootDocument>
 );
}

function RootDocument({ children }: { children: ReactNode }) {
 return (
 <html lang="en" className="scroll-smooth">
 <head>
 <HeadContent />
 </head>
 <body className="font-['Inter',system-ui,sans-serif]">
 {children}
 <Scripts />
 </body>
 </html>
 );
}
