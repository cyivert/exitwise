# Graph Report - C:/src/exitwise  (2026-04-29)

## Corpus Check
- Corpus is ~12,376 words - fits in a single context window. You may not need a graph.

## Summary
- 83 nodes · 85 edges · 22 communities detected
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Interview Logic & Session Helpers|Interview Logic & Session Helpers]]
- [[_COMMUNITY_Brand Identity & UI Shell|Brand Identity & UI Shell]]
- [[_COMMUNITY_API & Server Layer|API & Server Layer]]
- [[_COMMUNITY_Build Tooling & Docs|Build Tooling & Docs]]
- [[_COMMUNITY_Dashboard Management|Dashboard Management]]
- [[_COMMUNITY_App Entry Points|App Entry Points]]
- [[_COMMUNITY_Route Protection|Route Protection]]
- [[_COMMUNITY_Login Auth|Login Auth]]
- [[_COMMUNITY_Signup Auth|Signup Auth]]
- [[_COMMUNITY_Landing Page|Landing Page]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_Knowledge Card Component|Knowledge Card Component]]
- [[_COMMUNITY_App Constants|App Constants]]
- [[_COMMUNITY_Env Config|Env Config]]
- [[_COMMUNITY_Database Layer|Database Layer]]
- [[_COMMUNITY_Profile Page|Profile Page]]
- [[_COMMUNITY_Auth Schemas|Auth Schemas]]
- [[_COMMUNITY_Gemini AI Service|Gemini AI Service]]
- [[_COMMUNITY_Auth Store|Auth Store]]
- [[_COMMUNITY_Interview Store|Interview Store]]
- [[_COMMUNITY_Shared Types|Shared Types]]

## God Nodes (most connected - your core abstractions)
1. `Vite + React + TypeScript Template` - 8 edges
2. `fetch()` - 7 edges
3. `SVG Sprite Sheet (icons.svg)` - 6 edges
4. `getQuestionProgression()` - 5 edges
5. `Exitwise App Entry Point (index.html)` - 5 edges
6. `Exitwise Brand Color System (purple #863bff / #7e14ff)` - 5 edges
7. `generateExperienceTitle()` - 4 edges
8. `loadSession()` - 4 edges
9. `handleContinue()` - 4 edges
10. `normalizeInterviewText()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Google Fonts (DM Mono, DM Sans, Playfair Display)` --conceptually_related_to--> `Exitwise Brand Color System (purple #863bff / #7e14ff)`  [INFERRED]
  index.html → public/favicon.svg
- `Vite Logo SVG Asset (purple #9135ff, parentheses design)` --conceptually_related_to--> `Vite + React + TypeScript Template`  [INFERRED]
  src/assets/vite.svg → README.md
- `React Logo SVG Asset` --conceptually_related_to--> `Vite + React + TypeScript Template`  [INFERRED]
  src/assets/react.svg → README.md
- `Hero Image (isometric layered platform, purple gradient accent, abstract product illustration)` --conceptually_related_to--> `Exitwise App Entry Point (index.html)`  [INFERRED]
  src/assets/hero.png → index.html
- `Exitwise Favicon Logo (purple lightning bolt / layered shape, #863bff)` --semantically_similar_to--> `Hero Image (isometric layered platform, purple gradient accent, abstract product illustration)`  [INFERRED] [semantically similar]
  public/favicon.svg → src/assets/hero.png

## Hyperedges (group relationships)
- **Exitwise Frontend Stack: Vite + React + TypeScript bootstrapped via index.html** — indexhtml_exitwise_app, indexhtml_main_tsx, readme_vite_react_ts_template, assets_vite_svg, assets_react_svg [INFERRED 0.88]
- **Exitwise Brand Identity: purple color system expressed across favicon, hero, and icons** — favicon_exitwise_logo, assets_hero_png, exitwise_brand_purple, icons_documentation_icon, icons_social_icon [INFERRED 0.80]
- **SVG Sprite System: all social/UI icons consolidated in icons.svg for reuse** — icons_svg_sprite, icons_bluesky_icon, icons_discord_icon, icons_github_icon, icons_x_icon, icons_documentation_icon, icons_social_icon [EXTRACTED 0.95]

## Communities

### Community 0 - "Interview Logic & Session Helpers"
Cohesion: 0.23
Nodes (8): getQuestionProgression(), getSessionFallbackQuestion(), getSessionFollowUpQuestions(), isMeaningfulFollowUp(), normalizeInterviewText(), normalizeSessionFocus(), handleContinue(), loadSession()

### Community 1 - "Brand Identity & UI Shell"
Cohesion: 0.17
Nodes (15): Hero Image (isometric layered platform, purple gradient accent, abstract product illustration), Exitwise Brand Color System (purple #863bff / #7e14ff), Exitwise Favicon Logo (purple lightning bolt / layered shape, #863bff), Bluesky Social Icon Symbol, Discord Icon Symbol, Documentation Icon Symbol (purple stroke, code brackets), GitHub Icon Symbol, Social/User Icon Symbol (purple stroke, person + badge) (+7 more)

### Community 2 - "API & Server Layer"
Cohesion: 0.29
Nodes (10): apiFetch(), buildFallbackExperienceTitle(), checkRateLimit(), createExperienceForRetiree(), createExperienceSessions(), fetch(), generateExperienceTitle(), getOrganizationAdminContext() (+2 more)

### Community 3 - "Build Tooling & Docs"
Cohesion: 0.24
Nodes (10): React Logo SVG Asset, Vite Logo SVG Asset (purple #9135ff, parentheses design), ESLint Type-Aware Configuration, eslint-plugin-react-dom, eslint-plugin-react-x, @vitejs/plugin-react (Oxc-based), @vitejs/plugin-react-swc (SWC-based), Rationale: React Compiler Disabled (dev/build performance impact) (+2 more)

### Community 4 - "Dashboard Management"
Cohesion: 0.25
Nodes (0): 

### Community 5 - "App Entry Points"
Cohesion: 0.67
Nodes (0): 

### Community 6 - "Route Protection"
Cohesion: 1.0
Nodes (0): 

### Community 7 - "Login Auth"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Signup Auth"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Landing Page"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "ESLint Config"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Vite Config"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Knowledge Card Component"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "App Constants"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Env Config"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Database Layer"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Profile Page"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Auth Schemas"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Gemini AI Service"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Auth Store"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Interview Store"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Shared Types"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **10 isolated node(s):** `React Root Mount Point (#root)`, `Main TSX Entry Script`, `ESLint Type-Aware Configuration`, `Rationale: React Compiler Disabled (dev/build performance impact)`, `Bluesky Social Icon Symbol` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Route Protection`** (2 nodes): `ProtectedRoute.tsx`, `ProtectedRoute()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Auth`** (2 nodes): `LoginPage.tsx`, `LoginPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Signup Auth`** (2 nodes): `SignupPage.tsx`, `handleSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Landing Page`** (2 nodes): `LandingPage.tsx`, `LandingPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Config`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Config`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Knowledge Card Component`** (1 nodes): `KnowledgeCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Constants`** (1 nodes): `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Env Config`** (1 nodes): `env.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database Layer`** (1 nodes): `db.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Page`** (1 nodes): `ProfilePage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Schemas`** (1 nodes): `auth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Gemini AI Service`** (1 nodes): `gemini.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Store`** (1 nodes): `authStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Interview Store`** (1 nodes): `interviewStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Types`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `Vite + React + TypeScript Template` (e.g. with `Vite Logo SVG Asset (purple #9135ff, parentheses design)` and `React Logo SVG Asset`) actually correct?**
  _`Vite + React + TypeScript Template` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `getQuestionProgression()` (e.g. with `loadSession()` and `handleContinue()`) actually correct?**
  _`getQuestionProgression()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `React Root Mount Point (#root)`, `Main TSX Entry Script`, `ESLint Type-Aware Configuration` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._