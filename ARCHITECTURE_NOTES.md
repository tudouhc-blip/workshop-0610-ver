# Architecture Notes — Self-Assessment & Platform Integration

**Audience:** External engineer wiring auth, API, dashboard, and profile.  
**Workshop HTML:** static pages + `progress.js` (offline-first adapter) + `assessment-items.js` (96-item bank).

---

## 1. User journey & assessment schedule

| Trigger | Assessment | Items | Storage key | Unlocks |
|--------|------------|-------|-------------|---------|
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
  "reflections": { "module_2": [ ... ] }
}
```

### API methods (client)

```javascript
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
GET  /api/me/assessments            → all submitted assessments
GET  /api/me/assessments/:key       → single (pre | gate_d1 | …)
POST /api/me/assessments            → body: { assessment_key, assessment: { kind, responses, item_ids, … } }
POST /api/me/progress               → body: { module_id, progress }
POST /api/me/reflections            → body: { module_id, reflection }
```

**Auth:** JWT or session cookie; 401 → login with return URL.

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

Enforce on **server**; mirror in `index.html` render layer:

```
Module 1 unlocked  iff  pre submitted
Module 3 unlocked  iff  module_2 complete AND gate_d1 submitted
Module 4 unlocked  iff  module_3 complete AND gate_d2 submitted
Module 5 unlocked  iff  module_4 complete AND gate_d3 submitted
Module 6 unlocked  iff  module_5 complete AND gate_d4 submitted
Workshop complete  iff  module_6 complete AND post submitted
```

Suggested dashboard fields:

```json
{
  "selfChecksDone": 2,
  "selfChecksTotal": 6,
  "assessments": {
    "pre": { "submitted": true, "takenAt": "..." },
    "gate_d1": { "submitted": true },
    "post": { "submitted": false }
  },
  "pendingAssessment": { "kind": "gate", "dimension": 2, "label": "After Module 3" }
}
```

`selfChecksTotal = 6` → pre + 4 gates + post.

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
| `progress.js` | PlatformAdapter, offline queue, API hooks |
| `module_*_pic.html` | Content only; finish → assessment redirect |
| `index.html` | Dashboard; assessment hub (UI polish pending) |

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
