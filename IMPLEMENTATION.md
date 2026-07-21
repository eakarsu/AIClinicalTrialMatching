# Governed clinical matching

The supported `/api/governed-matching` workflow requires active consent, uses only minimum-necessary pseudonymous case facts, pins a curated evidence/terminology version, records criterion-level evidence and contraindications, and routes every result to a licensed professional. A match can never enroll a patient; professional review only marks potential eligibility and records the rationale.

Run `scripts/bootstrap.sh`, configure `.env`, execute `scripts/migrate.sh`, then use `start.sh`. Database synchronization is no longer performed at startup. Demo seeding is separately guarded. Generated gap routes and the synthetic/sandbox EHR/EDC/CTMS adapters are not mounted as product capabilities.

FHIR/EHR, registry, terminology and drug-knowledge credentials, consented identity linkage, expert-reviewed evaluation cohorts, subgroup/contraindication validation, institutional security review, and clinical validation remain external blockers. This software is not a clinical decision or enrollment system.
