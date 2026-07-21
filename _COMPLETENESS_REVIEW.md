# Completeness Review: AIClinicalTrialMatching

- **Review date:** 2026-07-18
- **Assessment basis:** Static source and configuration inspection only. Dependencies were not installed, and no build, database migration, external integration, or runtime workflow was executed.

## Classification

**Prototype-demo**

## Verdict

The repository presents a broad clinical evidence support surface (96 source files and 38 route modules), but static evidence is characteristic of a generated prototype. Pages and endpoints demonstrate concepts; they do not establish a verified execution path to ground patient/compound criteria in curated evidence, produce explainable matches or interaction checks, and route them to professional review.

## Why it is not complete

- 10 files are explicitly named as gap/gap-feature implementations; route/page count therefore overstates completed product capability.
- The route/page inventory includes `adverse events`, `ai`, `ai advanced`, `ai new`; these surfaces show breadth but not durable execution against authoritative systems.
- 31 files reference model-provider or chat-completion behavior; generic LLM calls are not a substitute for deterministic domain execution, grounding, or evaluation.
- 36 files contain mock, sample, placeholder, or random-data signals, leaving important outcomes disconnected from authoritative systems.
- Only 1 recognizable test file was found, insufficient to prove the full workflow and failure modes.
- No CI workflow was found to continuously verify builds, tests, migrations, or security checks.
- No environment example/template was found, so required configuration and secret boundaries are undocumented.

## Needed features

- 1. Implement a workflow to ground patient/compound criteria in curated evidence, produce explainable matches or interaction checks, and route them to professional review.
- 2. Connect FHIR/EHR or research systems, trial registries, terminology/drug knowledge services, and consented identity; replace seed/demo records with durable synchronized data and explicit failure handling.
- 3. Evaluate retrieval, eligibility/rule accuracy, uncertainty, contraindications, and subgroup performance on expert-reviewed cases.
- 4. Enforce consent, minimum-necessary access, provenance, clinical-use boundaries, and mandatory professional review.
- 5. Add contract, integration, authorization, migration, and end-to-end tests in CI, plus a documented non-destructive deployment/run path.

## Risks or launch blockers

- Credential/secret fallback or demo-password patterns occur in 3 files and must be removed or made development-only.
- The root launcher can terminate unrelated processes occupying configured ports.
- The root launcher seeds, creates, migrates, or otherwise mutates database state during startup.
- The root launcher installs dependencies at run time, reducing reproducibility and expanding supply-chain risk.
- Ungrounded or malformed model output can become a domain action unless schemas, evidence, evaluations, and approval gates are added.

## Evidence inspected

- `backend/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `frontend/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `backend/src/index.js` — service composition, middleware, and registered routes.
- `backend/src/models/index.js` — service composition, middleware, and registered routes.
- `frontend/src/index.js` — service composition, middleware, and registered routes.
- `backend/src/routes/adverseEvents.js` — implemented API surface and domain/AI request handling.

## Recommended next action

Treat this as a prototype: use adverse events and ai to select one narrow clinical evidence support outcome, quarantine generated gap routes, and implement that outcome end to end with real data, deterministic rules, and tests before adding features.

## Implementation progress (2026-07-18)

- **Needed feature 1 — locally implemented:** `backend/src/routes/governedMatching.js`, `backend/src/services/clinicalPolicy.js`, and `backend/migrations/001_governed_matching.sql` require active consent, store minimum-necessary pseudonymous case facts, pin reviewed evidence/terminology versions, produce criterion-level explanations and contraindications, and require licensed-professional review. The workflow never enrolls a patient.
- **Needed feature 2 — bounded correctly:** consents, curated evidence versions, cases, explainable matches, idempotency and governance audit are durable. Synthetic sandbox EHR/EDC/CTMS adapters and generated gap routes are not mounted as completed capabilities; real FHIR/EHR, registry, terminology and drug-knowledge adapters require institutional credentials and agreements.
- **Needed features 3–4 — locally implemented:** tests cover rule scoring, unknown/failed criteria, consent expiry and reviewer authorization. Tenant roles separate coordinators, curators and clinical reviewers; evidence provenance, review rationale and contraindications are mandatory. Self-selected privileged registration was removed, passwords/JWT/database configuration were hardened, and startup schema alteration was eliminated.
- **Needed feature 5 and launch blockers — locally implemented:** explicit migration, `.env.example`, separate bootstrap/migrate/guarded-seed scripts, nondestructive start, documentation and CI were added. Startup no longer installs, seeds, creates or alters databases, starts services, or kills unrelated processes.
- **Validation / still external:** 4 policy tests passed, changed JavaScript/shell checks passed, and the existing frontend completed a production build. No service, database, EHR, registry or clinical workflow was run. Expert-reviewed eligibility/contraindication cohorts, subgroup validation, consented identity, institutional privacy/security review, regulatory assessment and clinical validation remain incomplete; the code is not a clinical decision system.
