# Architecture Notes — Self-Assessment & Platform Integration

**Audience:** External engineer wiring auth, API, dashboard, and profile.  
**Workshop HTML:** static pages + `progress.js` (offline-first adapter) + `assessment-items.js` (96-item bank).

---

## 1. User journey & assessment schedule

| Trigger | Assessment / data | Items / fields | Storage key | Unlocks |
|--------|-------------------|----------------|-------------|---------|
| Module 0 · 0.3.1 | **Profile** | 6 optional fields (country, institution, …) | `store.profile` | — (not gated; feeds dashboard) |
| Module 0 complete | **Pre-test** | **20 or 32** (TBD — same set for pre & post) | `pre` | Module 1 |
| Module 2 complete + gate submitted | **Gate D1** | **10** (Dimension 1 only) | `gate_d1` | Module 3 |
| Module 3 complete + gate submitted | **Gate D2** | **10** | `gate_d2` | Module 4 |
| Module 4 complete + gate submitted | **Gate D3** | **10** | `gate_d3` | Module 5 |
| Module 5 complete + gate submitted | **Gate D4** | **10** | `gate_d4` | Module 6 |
| Module 6 complete | **Post-test** | **20 or 32** (identical item IDs to pre-test) | `post` | Workshop complete / certificate |

**Total item bank:** 96 items (24 per dimension × 4 dimensions).  
**Teacher-facing scale:** 5-point Likert (Strongly Disagree → Strongly Agree).  
**Expert validity form (separate):** 4-point scale in the Word doc — not used in the teacher UI.

Assessments live on **`assessment.html`** (not inside module pages).  
Modules redirect there after “Finish Module” when section gating is satisfied.

Example URLs:
```
assessment.html?kind=pre&after=module_0
assessment.html?kind=gate&dimension=1&after=module_2
assessment.html?kind=gate&dimension=2&after=module_3
assessment.html?kind=post&after=module_6
```

---

## 2. Item bank notation (canonical)

From measurement tool v1.2 (`1.2_260520_Developing a Measurement tool…docx`):

```
D{n}L{m}{T|S}{k}

n = dimension 1–4
m = level: L1 Basic | L2 Intermediate | L3 Advanced
T   = Teacher's own usage/literacy (4 items per level)
S   = Empowering students' usage (4 items per level)

→ 4 × 3 × 2 × 4 = 96 items
```

Example: `D1L2T1` = Dimension 1, Intermediate, Teacher facet, item 1.

**Source file in repo:** `assessment-items.js` → `window.ASSESSMENT_ITEM_BANK`

---

## 3. Subset selection (prototype logic)

Configured in `assessment-items.js`:

| Kind | Rule (prototype) | Engineer action |
|------|------------------|-----------------|
| `pre` / `post` | `PRE_POST_ITEM_COUNT` (default **20**; set to **32** when decided) — evenly sampled across full bank | **Replace with fixed item-ID list** agreed with psychometrics team; pre and post must use **identical** `item_ids` |
| `gate` | **10 items** from one dimension: 2 Basic T, 2 Basic S, 2 Intermediate T, 2 Intermediate S, 1 Advanced T, 1 Advanced S | **Replace with fixed 10-ID list per dimension** from validated short form |

---

## 4. Module page gating (Module 2 pattern)

Within a module page (e.g. `module_2_pic.html`):

1. User self-ticks **all section complete buttons** (2.1–2.4). Activities inside sections are **not** hard-gated.
2. When **all 4 sections** are ticked → **Finish Module** button unlocks.
3. **Finish Module** → marks module complete via `ProgressTracker.markCompleted('module_2')` → redirects to gate assessment.
4. Dashboard (server) should **not** unlock Module 3 until `gate_d1.submitted_at` exists.

Repeat for Modules 3–5 with `gate_d2` … `gate_d4`.

---

## 5. `progress.js` — PlatformAdapter

### Local storage shape (`genai_workshop` key)

```json
{
  "__user": { "id": "...", "anonymous": true },
  "progress": {
    "module_2": { "started_at": "...", "completed_at": "..." }
  },
  "assessments": {
    "pre": { "kind": "pre", "submitted_at": "...", "responses": { "D1L1T1": 4 } },
    "gate_d1": { "kind": "gate", "dimension_id": 1, "responses": { ... } },
    "post": { "kind": "post", "submitted_at": "...", "responses": { ... } }
  },
  "profile": {
    "country": "United Kingdom",
    "institution": "University of …",
    "gender": "Female",
    "discipline": "Public Health",
    "years_teaching": "8–15 years",
    "years_with_genai": "1–2 years",
    "updated_at": "2026-06-16T12:00:00.000Z",
    "version": 1
  },
  "reflections": { "module_2": [ ... ] }
}
```

### API methods (client)

```javascript
PlatformAdapter.saveProfile(profileFields)   // Module 0 — section 0.3.1
PlatformAdapter.readProfile()
PlatformAdapter.isProfileSaved()
PlatformAdapter.saveAssessment(assessKey, payload)   // assessKey: pre | post | gate_d1…gate_d4
PlatformAdapter.readAssessment(assessKey)
PlatformAdapter.isAssessmentSubmitted(assessKey)
PlatformAdapter.saveProgress(moduleId, partial)
PlatformAdapter.saveReflection(moduleId, reflection)
PlatformAdapter.getUser()
PlatformAdapter.configure({ apiBase, authHeader })
```

### Suggested REST endpoints

```
GET  /api/me/dashboard              → modules status + assessment flags + profile
GET  /api/me/profile                → { country, institution, gender, discipline, … }
POST /api/me/profile                → body: { profile: { …fields, updated_at, version } }
GET  /api/me/assessments            → all submitted assessments
GET  /api/me/assessments/:key       → single (pre | gate_d1 | …)
POST /api/me/assessments            → body: { assessment_key, assessment: { kind, responses, item_ids, … } }
POST /api/me/progress               → body: { module_id, progress }
POST /api/me/reflections            → body: { module_id, reflection }
```

**Auth:** JWT or session cookie; 401 → login with return URL.

### POST profile payload (Module 0 — 0.3.1)

Collected from `#profile-form` in `module_0_pic.html`. All fields optional.

```json
{
  "user_id": "user-uuid",
  "profile": {
    "country": "United Kingdom",
    "institution": "University of Edinburgh",
    "gender": "Female",
    "discipline": "Public Health",
    "years_teaching": "8–15 years",
    "years_with_genai": "1–2 years",
    "updated_at": "2026-06-16T12:00:00.000Z",
    "version": 1
  }
}
```

**Engineer notes:**
- Client writes via `PlatformAdapter.saveProfile()` — same offline-first + queue pattern as assessments.
- Key display fields (`institution`, `discipline`, `country`) are mirrored onto `store.__user` for dashboard binding.
- Legacy demo key `genai_workshop_profile_v1` is migrated once on Module 0 load if `store.profile` is empty.
- Profile is **not** required to unlock Module 1; pre-test submission is the gate. Server may enforce profile separately if needed.

### POST assessment payload (example)

```json
{
  "assessment_key": "gate_d1",
  "assessment": {
    "kind": "gate",
    "dimension_id": 1,
    "after_module": "module_2",
    "scale": "5-point-likert",
    "item_count": 10,
    "item_ids": ["D1L1T1", "D1L1T2", "..."],
    "responses": { "D1L1T1": 4, "D1L1T2": 5 },
    "submitted_at": "2026-06-16T12:00:00.000Z",
    "version": 1
  }
}
```

---

## 6. Dashboard locking rules (server + client)

Module completion (client): a module counts as **complete** only when every section checkbox is ticked (`mN.complete.section-*` in localStorage). Partial progress = **in progress**; unlocked with zero ticks = **not started yet**.

```
Module 1 unlocked  iff  Module 0 all sections complete AND pre submitted
Module 3 unlocked  iff  module_2 all sections complete AND gate_d1 submitted
...
Post-assessment    iff  module_6 all sections complete AND pre + gate_d1…gate_d4 all submitted
```

Suggested dashboard fields:

```json
{
  "modulesCompleted": 3,
  "modulesTotal": 7,
  "selfChecksDone": 2,
  "selfChecksTotal": 5,
  "timeInvestedMin": 102,
  "estTimeRemainingMin": 218,
  "postComplete": false,
  "assessments": {
    "pre": { "submitted": true, "takenAt": "..." },
    "gate_d1": { "submitted": true },
    "post": { "submitted": false }
  },
  "pendingAssessment": { "kind": "gate", "dimension": 2, "label": "After Module 3" }
}
```

`selfChecksTotal = 5` → pre + 4 dimension gates. **Post-test is separate** (certificate on completion).

---

## 11. Dashboard UI (`index.html` + `dashboard-app.js`)

### Learning path order (interleaved)

```
M0 → Pre → M1 → M2 → Gate D1 → M3 → Gate D2 → M4 → Gate D3 → M5 → Gate D4 → M6 → Post
```

Rendered in `#pathList` by `renderPathList()`. Hero SVG shows module milestones only (M0–M6).

### Client state builder

`dashboard-app.js` exports `window.DashboardApp` with:

- `buildDashboardState()` — reads `PlatformAdapter` (`progress.js`)
- `renderDashboard(state)` — binds `[data-bind]` fields, path list, hero, continue CTA
- `refresh()` — rebuild + re-render (also on `storage` / `focus`)

Module completion: `progress.module_N.completed_at` is optional metadata only; **all** `mN.complete.section-*` keys must be set for `status: complete` in the dashboard path.

### Time invested (demo)

```javascript
PlatformAdapter.addTimeInvestedMin(minutes);  // on module/checkpoint complete
PlatformAdapter.readTimeInvestedMin();        // persisted in store.dashboard.time_invested_min
PlatformAdapter.pingSessionTime();            // optional session heartbeat (dashboard load)
```

Production: replace with server-side aggregation from session/module events.

### Report & certificate placeholders

| UI element | Current behaviour | Production hook |
|------------|-------------------|-----------------|
| "See my report 🔒" on completed checkpoints | `disabled` button | `GET /api/me/reports/:assessment_key` or external analytics URL |
| Post-test card | Certificate copy when `post` submitted | Cert PDF service after `POST` post submit |
| Ribbon "Language · In progress" | Disabled pill | Locale switcher + translated module HTML or i18n keys |

### Banner assets

Partner logos: `assets/eduhk-logo.png`, `assets/sjtu-logo.png` (white-backed pills in ribbon).

### Demo panel

`#demo-fab` / `#demo-panel` seeds `genai_workshop` store scenarios (`fresh`, `halfway`, `finishing`, `complete`). **Remove before production.**

---

## 7. Pre/post comparison report

For profile / Module 6 synthesis:

- Join `pre.responses` and `post.responses` on `item_id`.
- Compute per-dimension averages (map item ID → dimension via bank).
- Compute per-cell averages (dimension × level × perspective).
- Show delta (post − pre) — already mocked in `index.html` assessment card.

---

## 8. Open decisions for product team

| Decision | Options | Notes |
|----------|---------|-------|
| Pre/post length | 20 vs 32 items | Must be **identical** item set; update `ASSESSMENT_CONFIG.PRE_POST_ITEM_COUNT` and fixed ID list |
| Gate item lists | Prototype auto-pick vs psychometrics-approved 10 per dimension | Replace `getGateItemIds()` with static arrays when finalized |
| Partial save | Allow resume mid-assessment? | Not implemented; add `status: draft` if needed |
| Retakes | Allow re-submit gate assessments? | Currently one submission per key; gate retakes only if you add admin reset |

---

## 9. Files map

| File | Role |
|------|------|
| `assessment-items.js` | 96-item bank + subset helpers |
| `assessment.html` | Single assessment UI (all kinds) |
| `progress.js` | PlatformAdapter — profile, assessments, progress, time tracking, offline queue |
| `dashboard-app.js` | Dashboard state builder + render (reads PlatformAdapter) |
| `module_0_pic.html` | Profile form (0.3.1) → `PlatformAdapter.saveProfile()` |
| `module_*_pic.html` | Content only; finish → assessment redirect |
| `index.html` | Dashboard shell (ribbon, hero, path list, paper card) |
| `assets/eduhk-logo.png`, `assets/sjtu-logo.png` | Ribbon partner logos |

---

## 10. Host shell integration

Parent platform can inject user/session before workshop loads:

```javascript
window.postMessage({
  type: 'platform.handshake',
  user: { id: 'user-uuid', name: '...' },
  apiBase: 'https://your-api.example.com/api',
  authHeader: 'Bearer …'
}, '*');
```

`progress.js` listens and flushes queued POSTs on handshake.

---

*Last updated: June 2026 — aligned with measurement tool v1.2 (260520) and workshop Modules 0–6 flow.*
