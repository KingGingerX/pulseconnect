# PulseConnect Design System — Artifact Index

## Overview
All design artifacts for the PulseConnect creator-brand marketplace.

## Directory Structure

```
designs/
├── BRAND_GUIDE.html          # Full interactive brand design system (open in browser)
├── README.md                 # This file
├── design-tokens.css          # CSS custom properties for the engineer
├── assets/
│   ├── pulseconnect-logo.png          # Primary logo (dark background)
│   └── pulseconnect-logo-light.png    # Logo variant (light background)
├── mockups/
│   ├── landing-page.png        # Landing page hero + features
│   ├── creator-signup.png      # Creator onboarding flow
│   ├── company-signup.png      # Company tier/pricing selection
│   ├── creator-profile.png     # Creator profile page
│   ├── dm-interface.png        # In-app messaging with deal proposals
│   ├── sponsor-wall.png        # Logo tier sponsor directory
│   └── customization-store.png # Themes, fonts & emoji store
└── marketing/
    ├── social-hero-creator.png  # Social ad targeting creators
    ├── social-hero-brand.png    # Social ad targeting brands
    └── og-image.png             # Open Graph share preview
```

## Brand Summary

| Element | Value |
|---------|-------|
| Primary Color | `#7C3AED` (Electric Violet) |
| Accent Color | `#06B6D4` (Cyan Pulse) |
| Gradient | `135deg, #7C3AED → #06B6D4` |
| Background | `#0a0a0f` (Deep Space) |
| Surface | `#13131f` |
| Font (UI) | Inter (300–900) |
| Font (Code) | JetBrains Mono (400, 500) |
| Border Radius | 6px (sm), 8px (md), 12px (lg), 16px (xl) |
| Logo Colors | Purple-violet gradient, pulsing node mark |

## How to Use
1. Open `BRAND_GUIDE.html` in a browser for the full interactive guide
2. Import `design-tokens.css` into the site codebase for all CSS variables
3. Use `assets/` for logo variants on different backgrounds
4. Reference `mockups/` for screen layout inspiration
5. Use `marketing/` for social media and OG previews

## Notes
- The Gumroad link (https://tgbglobal.gumroad.com/l/pulseconnect) returned 404 — the PulseConnect logo was designed and generated to fit the TGB Global aesthetic. If the official logo becomes available later, replace the assets/ files.
- The design is dark-first; light mode is secondary.
- All screens follow the dark-glass aesthetic with subtle borders and gradient accents.