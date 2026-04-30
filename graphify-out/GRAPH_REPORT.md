# Graph Report - .  (2026-04-29)

## Corpus Check
- Corpus is ~12,408 words - fits in a single context window. You may not need a graph.

## Summary
- 79 nodes · 68 edges · 8 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `fetch()` - 7 edges
2. `getQuestionProgression()` - 5 edges
3. `generateExperienceTitle()` - 4 edges
4. `loadSession()` - 4 edges
5. `handleContinue()` - 4 edges
6. `normalizeInterviewText()` - 4 edges
7. `isMeaningfulFollowUp()` - 4 edges
8. `createExperienceForRetiree()` - 3 edges
9. `normalizeSessionFocus()` - 3 edges
10. `getSessionFallbackQuestion()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `apiFetch()` --calls--> `fetch()`  [INFERRED]
  src\services\api.ts → server.ts
- `loadSession()` --calls--> `getQuestionProgression()`  [INFERRED]
  src\features\interview\InterviewPage.tsx → src\utils\helpers.ts
- `handleContinue()` --calls--> `getQuestionProgression()`  [INFERRED]
  src\features\interview\InterviewPage.tsx → src\utils\helpers.ts
- `loadSession()` --calls--> `isMeaningfulFollowUp()`  [INFERRED]
  src\features\interview\InterviewPage.tsx → src\utils\helpers.ts
- `loadSession()` --calls--> `normalizeInterviewText()`  [INFERRED]
  src\features\interview\InterviewPage.tsx → src\utils\helpers.ts

## Hyperedges (group relationships)
- **Interview & AI Subsystem** — tech_gemini, logic_stream_proxy, store_interview, logic_create_sessions [EXTRACTED 0.90]
- **Authentication & Security** — tech_bun, schema_auth, store_auth [INFERRED 0.80]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.29
Nodes (10): buildFallbackExperienceTitle(), checkRateLimit(), createExperienceForRetiree(), createExperienceSessions(), fetch(), generateExperienceTitle(), getOrganizationAdminContext(), normalizeContextText() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.33
Nodes (4): getQuestionProgression(), getSessionFallbackQuestion(), getSessionFollowUpQuestions(), normalizeSessionFocus()

### Community 3 - "Community 3"
Cohesion: 0.29
Nodes (6): Bluesky Icon, Discord Icon, Documentation Icon, GitHub Icon, Social Icon, X Icon

### Community 4 - "Community 4"
Cohesion: 0.53
Nodes (4): handleContinue(), loadSession(), isMeaningfulFollowUp(), normalizeInterviewText()

### Community 6 - "Community 6"
Cohesion: 0.67
Nodes (3): Legacy Trust™ Control, Retiree Role, Successor Role

### Community 7 - "Community 7"
Cohesion: 0.67
Nodes (3): generateExperienceTitle, Bun Server, Google Gemini AI

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): ExitWise Application, Tacit Knowledge

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (2): createExperienceSessions, useInterviewStore

## Knowledge Gaps
- **14 isolated node(s):** `ExitWise Application`, `Tacit Knowledge`, `Bun Server`, `createExperienceSessions`, `generateExperienceTitle` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (2 nodes): `ExitWise Application`, `Tacit Knowledge`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `createExperienceSessions`, `useInterviewStore`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getQuestionProgression()` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `loadSession()` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getQuestionProgression()` (e.g. with `loadSession()` and `handleContinue()`) actually correct?**
  _`getQuestionProgression()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `loadSession()` (e.g. with `isMeaningfulFollowUp()` and `getQuestionProgression()`) actually correct?**
  _`loadSession()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `handleContinue()` (e.g. with `normalizeInterviewText()` and `getQuestionProgression()`) actually correct?**
  _`handleContinue()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ExitWise Application`, `Tacit Knowledge`, `Bun Server` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._