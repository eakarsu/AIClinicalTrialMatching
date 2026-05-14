# Audit Note — AIClinicalTrialMatching

Source: `_AUDIT/reports/batch_01.md` (Project 27)

## Maturity: PARTIAL-BUILD (19 routes, 10 AI endpoints)

## Original audit recommendations

### Gaps & Opportunities
- Missing Integration API.

### Strategic Feature Suggestions
1. Patient Outcome Predictor.
2. Site Network Optimizer.
3. Regulatory Compliance Agent.
4. Integrations: EDC (Medidata Rave), CTMS (Veeva Vault), EHR (Epic, Cerner).

## Categorization
- **MECHANICAL:** webhook subscriptions registry. Notifications and reports are already present in the codebase (`routes/notifications.js`, `routes/reports.js`).
- **NEEDS-CREDS:** Medidata, Veeva Vault, Epic, Cerner integrations.
- **NEEDS-PRODUCT-DECISION:** Patient outcome predictor (which model? which endpoints?), site optimizer.

## Implementations applied
1. **`backend/src/routes/webhooks.js`** — webhook registry CRUD + manual test-delivery (in-memory; persistent storage requires a Webhook Sequelize model).
2. **`backend/src/index.js`** — mounted at `/api/webhooks`.

Syntax-checked with `node --check`.

## Backlog (prioritized)

### High priority
- **Persistent Webhook model** — add `Webhook` to `models/index.js` (sequelize) and migrate the in-memory store.
- **Outbound dispatcher** — wire enrollment / adverse-event / regulatory routes to fan out to webhooks.

### Medium priority
- **`POST /api/ai/predict-dropout`** — predict early-dropout risk per enrollment.
- **`POST /api/ai/site-optimizer`** — recommend site network for a protocol.

### Low priority
- EDC (Medidata) / CTMS (Veeva) / EHR (Epic, Cerner) connectors — credentials.
- Regulatory submission generator (form filings).

## Apply pass 3 (frontend)

**Action: LEFT-AS-IS.** Frontend already comprehensive.

- `frontend/src/pages/AIToolsPage.js` is a single page that drives all 22 backend AI endpoints (`/api/ai/*` across `ai.js`, `aiNew.js`, `aiAdvanced.js`) via a `TOOLS` array with patient/trial/protocol resource pickers, per-tool field renderer, react-markdown result rendering, and error/usage/disclaimer footer.
- `frontend/src/services/aiService.js` provides per-endpoint thin wrappers over the JWT-bearing axios client in `services/api.js` (token from `localStorage`).
- All 22 backend AI endpoints (10 in `ai.js` + 5 in `aiNew.js` + 7 in `aiAdvanced.js`) have a matching `TOOLS` entry. No gap detected.
- No code changes this pass. See `_AUDIT/apply3_logs/ab3_62.md`.
