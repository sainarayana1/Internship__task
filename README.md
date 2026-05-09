# NL → App Compiler
### AI Platform Engineer — Demo Task Submission
**Works 100% offline. Zero API keys. Zero dependencies.**

---

## How to run

```bash
# Just open index.html in any browser — no server, no install needed
open index.html         # macOS
start index.html        # Windows
xdg-open index.html     # Linux
```

Or for a local server:
```bash
python3 -m http.server 8080
# open http://localhost:8080
```

---

## Architecture — 5-stage pipeline (pure rule-based)

```
Natural language
      │
      ▼
┌─────────────────────┐
│ Stage 1             │  Keyword extraction + NLP rules
│ Intent Extraction   │  → app_type, features, roles, quality, assumptions
└────────┬────────────┘
         ▼
┌─────────────────────┐
│ Stage 2             │  Template-driven architecture generation
│ System Design       │  → entities, flows, relations, tech stack, pages
└────────┬────────────┘
         ▼
┌─────────────────────┐
│ Stage 3             │  Feature-conditional schema builder
│ Schema Generation   │  → UI pages, API endpoints, DB tables, Auth, Business logic
└────────┬────────────┘
         ▼
┌─────────────────────┐
│ Stage 4             │  Cross-layer consistency checker + surgical repair
│ Validation + Repair │  → fixes orphaned entities, missing routes, role mismatches
└────────┬────────────┘
         ▼
┌─────────────────────┐
│ Stage 5             │  10-check binary simulation
│ Execution Check     │  → score, executable flag, verdict
└─────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | UI shell — pipeline bar, input, output tabs, eval section |
| `style.css` | All styles — dark log, syntax highlight, responsive grid |
| `engine.js` | Core engine — all 5 stages, validation, repair (pure JS, no API) |
| `app.js` | UI controller + evaluation framework |

---

## What the pipeline detects

**40+ feature keywords** across categories:
auth, dashboard, payments, CRM, users, roles, notifications, search, files, calendar, kanban, chat, API, mobile, AI, e-commerce, social, HR, healthcare, education, realtime, settings

**10 app types**: CRM, e-commerce, task manager, LMS, social, HR, healthcare, SaaS, real estate, food delivery

**10 role types**: admin, user, manager, editor, viewer, driver, doctor, student, teacher, seller

**Prompt quality detection**: clear / vague / conflicting / incomplete

---

## Evaluation

Click **Run Full Evaluation** to automatically run all 20 test cases:
- 10 real product prompts
- 10 edge cases (vague × 3, conflicting × 5, incomplete × 2)

Metrics: success rate, total repairs, avg latency, failure breakdown.
Expected: ~85–100% pass rate, <10ms avg latency (pure JS).

---

## Schema contract

```json
{
  "ui":   { "pages": [{ "name", "route", "components", "requires_auth", "allowed_roles", "api_calls" }] },
  "api":  { "base_url", "endpoints": [{ "method", "path", "entity", "auth_required", "allowed_roles", "request_body", "response_fields" }] },
  "db":   { "dialect", "tables": [{ "name", "fields": [{ "name", "type", "nullable", "unique" }], "primary_key", "relations" }] },
  "auth": { "strategy", "roles", "permissions", "token_expiry", "refresh_token", "premium_gating" },
  "business_logic": [{ "rule", "trigger", "condition", "action" }]
}
```

Cross-validated: every API `entity` → DB table. Every UI `allowed_roles` → auth `roles`.
