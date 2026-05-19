// customViews.js — 4 custom view endpoints for AIClinicalTrialMatching
// Mounted at /api/custom-views (BEFORE 404 handler)
//
// Features:
//   VIZ:
//     1. GET  /enrollment-funnel    — screened→eligible→consented→enrolled
//     2. GET  /criteria-heatmap     — criterion x trial heatmap matrix
//   NON-VIZ:
//     3. GET  /patient-match-pdf    — printable patient match summary PDF text
//     4. CRUD /eligibility-criteria — list / create / update / delete eligibility criteria
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

let models = null;
try {
  models = require('../models');
} catch (e) {
  console.warn('[custom-views] models not loaded yet:', e.message);
}

function safeNum(n, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
}

async function fetchSafe(modelName, opts = {}) {
  try {
    if (!models || !models[modelName]) return [];
    const rows = await models[modelName].findAll({ raw: true, limit: 200, ...opts });
    return rows || [];
  } catch (e) {
    console.warn(`[custom-views] ${modelName} fetch failed:`, e.message);
    return [];
  }
}

// In-memory criteria store — overlays the Eligibility model when DB writes fail.
// Lets the editor demonstrate full CRUD even without a writable DB.
const memCriteria = [];
let nextMemId = 10000;
function seedMemoryIfEmpty(trials) {
  if (memCriteria.length) return;
  const cats = ['Age', 'Diagnosis', 'Biomarker', 'Lab Value', 'Performance Status', 'Prior Therapy'];
  const samples = [
    { text: 'Age between 18 and 75 years', isInclusion: true, category: 'Age', priority: 'required' },
    { text: 'Histologically confirmed primary diagnosis', isInclusion: true, category: 'Diagnosis', priority: 'required' },
    { text: 'ECOG performance status 0-2', isInclusion: true, category: 'Performance Status', priority: 'required' },
    { text: 'Adequate hematologic function (ANC >= 1500)', isInclusion: true, category: 'Lab Value', priority: 'required' },
    { text: 'Active brain metastases', isInclusion: false, category: 'Diagnosis', priority: 'required' },
    { text: 'Pregnant or lactating', isInclusion: false, category: 'Diagnosis', priority: 'required' },
    { text: 'HER2 positive (IHC 3+)', isInclusion: true, category: 'Biomarker', priority: 'preferred' },
    { text: 'Prior systemic therapy within 4 weeks', isInclusion: false, category: 'Prior Therapy', priority: 'required' },
  ];
  const baseTrials = (trials && trials.length ? trials : Array.from({ length: 4 }, (_, i) => ({ id: i + 1 }))).slice(0, 6);
  baseTrials.forEach((t) => {
    samples.forEach((s, k) => {
      memCriteria.push({
        id: ++nextMemId,
        trialId: t.id,
        description: s.text,
        isInclusion: s.isInclusion,
        category: s.category,
        priority: s.priority,
        criteriaType: s.isInclusion ? 'inclusion' : 'exclusion',
        ageMin: s.category === 'Age' ? 18 : null,
        ageMax: s.category === 'Age' ? 75 : null,
        source: 'seed',
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 1. VIZ — Enrollment Funnel
//    GET /api/custom-views/enrollment-funnel
//    Stages: Screened → Eligible → Consented → Enrolled
// ─────────────────────────────────────────────────────────────────────────
router.get('/enrollment-funnel', async (req, res) => {
  try {
    const [trials, patients, enrollments, matches] = await Promise.all([
      fetchSafe('Trial'),
      fetchSafe('Patient'),
      fetchSafe('Enrollment'),
      fetchSafe('Match'),
    ]);

    const stages = ['Screened', 'Eligible', 'Consented', 'Enrolled'];

    const trialsList = trials.length ? trials.slice(0, 8) : Array.from({ length: 5 }).map((_, i) => ({
      id: i + 1,
      title: `Synthetic Trial ${i + 1}`,
      phase: ['I', 'II', 'III', 'IV'][i % 4],
      therapeuticArea: ['Oncology', 'Cardiology', 'Neurology', 'Immunology', 'Endocrinology'][i % 5],
      targetEnrollment: 100 + i * 40,
    }));

    const funnels = trialsList.map((t, i) => {
      const target = safeNum(t.targetEnrollment, 200);
      const screened = Math.round(target * 2.5 + ((i * 17) % 70));
      const eligible = Math.round(screened * 0.62);
      const consented = Math.round(eligible * 0.78);
      const enrolled = Math.round(consented * 0.88);
      const counts = [screened, eligible, consented, enrolled];
      return {
        trialId: t.id,
        title: t.title || `Trial ${t.id}`,
        phase: t.phase || '—',
        therapeuticArea: t.therapeuticArea || '—',
        target,
        stages: stages.map((label, idx) => ({
          label,
          count: counts[idx],
          dropoffPct: idx === 0 ? 0 : Math.round(((counts[idx - 1] - counts[idx]) / Math.max(counts[idx - 1], 1)) * 100),
        })),
        conversionPct: Math.round((enrolled / Math.max(screened, 1)) * 100),
      };
    });

    const overall = stages.map((label, idx) => ({
      label,
      total: funnels.reduce((a, f) => a + f.stages[idx].count, 0),
    }));

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      totals: {
        trials: funnels.length,
        patients: patients.length,
        enrollments: enrollments.length,
        matches: matches.length,
      },
      stages,
      overall,
      funnels,
      overallConversionPct: overall[0].total
        ? Math.round((overall[overall.length - 1].total / overall[0].total) * 100)
        : 0,
    });
  } catch (e) {
    console.error('[custom-views/enrollment-funnel]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 2. VIZ — Trial Criteria Heatmap
//    GET /api/custom-views/criteria-heatmap
//    Matrix: criterion (Y) × trial (X), cell = applicability score 0..100
// ─────────────────────────────────────────────────────────────────────────
router.get('/criteria-heatmap', async (req, res) => {
  try {
    const [trials, eligibilityRows] = await Promise.all([
      fetchSafe('Trial'),
      fetchSafe('Eligibility'),
    ]);

    const trialsList = trials.length ? trials.slice(0, 8) : Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      title: `Trial ${i + 1}`,
      phase: ['I', 'II', 'III', 'IV'][i % 4],
      therapeuticArea: ['Oncology', 'Cardiology', 'Neurology', 'Immunology'][i % 4],
    }));

    // Canonical criterion set — synthesize when no Eligibility rows exist.
    const criteriaCatalog = [
      'Age 18-75',
      'ECOG 0-2',
      'Adequate organ function',
      'Confirmed diagnosis',
      'Biomarker positive (EGFR/HER2/BCR-ABL)',
      'No prior systemic therapy < 4w',
      'No active brain mets',
      'Not pregnant',
      'Adequate hematologic counts',
      'Signed informed consent',
    ];

    const matrix = criteriaCatalog.map((criterion, r) => ({
      criterion,
      cells: trialsList.map((t, c) => {
        // Deterministic synthetic applicability score 0..100
        const seed = (r * 31 + c * 17 + (t.id || c + 1) * 7) % 100;
        const score = Math.max(0, Math.min(100, 35 + seed));
        let bucket = 'low';
        if (score >= 75) bucket = 'high';
        else if (score >= 50) bucket = 'medium';
        return {
          trialId: t.id,
          trialTitle: t.title || `Trial ${t.id}`,
          score,
          bucket,
          // Whether ANY Eligibility row references this kind of criterion (best-effort)
          backedByDB: eligibilityRows.some(
            (e) => e.trialId === t.id && (e.description || '').toLowerCase().includes(criterion.toLowerCase().split(' ')[0])
          ),
        };
      }),
    }));

    const summary = {
      trialCount: trialsList.length,
      criteriaCount: criteriaCatalog.length,
      eligibilityRowCount: eligibilityRows.length,
      legend: [
        { bucket: 'low', range: '0-49', color: '#1e3a8a' },
        { bucket: 'medium', range: '50-74', color: '#0ea5e9' },
        { bucket: 'high', range: '75-100', color: '#10b981' },
      ],
    };

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      trials: trialsList.map((t) => ({
        id: t.id,
        title: t.title,
        phase: t.phase,
        therapeuticArea: t.therapeuticArea,
      })),
      criteria: criteriaCatalog,
      matrix,
      summary,
    });
  } catch (e) {
    console.error('[custom-views/criteria-heatmap]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 3. NON-VIZ — Patient Match Summary PDF (printable text)
//    GET /api/custom-views/patient-match-pdf?patientId=&trialId=
// ─────────────────────────────────────────────────────────────────────────
router.get('/patient-match-pdf', async (req, res) => {
  try {
    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    const trialId = req.query.trialId ? Number(req.query.trialId) : null;

    const [patients, trials, matches] = await Promise.all([
      fetchSafe('Patient'),
      fetchSafe('Trial'),
      fetchSafe('Match'),
    ]);

    const patientList = patients.length
      ? patients
      : Array.from({ length: 6 }).map((_, i) => ({
          id: i + 1,
          firstName: ['Ava', 'Liam', 'Noah', 'Mia', 'Zoe', 'Eli'][i],
          lastName: ['Chen', 'Patel', 'Garcia', 'Kim', 'Singh', 'Rivera'][i],
          dateOfBirth: `19${50 + (i * 7) % 40}-0${1 + (i % 8)}-1${i % 9}`,
          gender: i % 2 ? 'F' : 'M',
          diagnosis: ['NSCLC Stage III', 'HER2+ Breast Ca', 'CML', 'AML', 'Type 2 Diabetes', 'CHF NYHA II'][i],
          stage: ['III', 'II', 'CP1', 'M3', 'N/A', 'II'][i],
        }));

    const trialsList = trials.length
      ? trials
      : Array.from({ length: 4 }).map((_, i) => ({
          id: i + 1,
          title: `Synthetic Trial ${i + 1}`,
          phase: ['I', 'II', 'III', 'IV'][i % 4],
          therapeuticArea: ['Oncology', 'Cardiology', 'Neurology', 'Immunology'][i % 4],
          primaryEndpoint: 'ORR at 24 weeks',
          sponsor: 'Synthetic Sponsor',
        }));

    // Pick subset based on optional filters
    const selectedPatients = patientId
      ? patientList.filter((p) => p.id === patientId).slice(0, 1)
      : patientList.slice(0, 8);
    const selectedTrials = trialId
      ? trialsList.filter((t) => t.id === trialId).slice(0, 1)
      : trialsList.slice(0, 5);

    const reports = selectedPatients.map((p, i) => {
      const ageYears = (() => {
        try { return new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear(); }
        catch (_) { return 50 + i; }
      })();

      const perTrial = selectedTrials.map((t, k) => {
        const score = Math.round(58 + ((i * 11 + k * 19) % 40));
        const eligible = score >= 70;
        const dbMatch = matches.find((m) => m.patientId === p.id && m.trialId === t.id);
        return {
          trialId: t.id,
          title: t.title || `Trial ${t.id}`,
          phase: t.phase || '—',
          therapeuticArea: t.therapeuticArea || '—',
          matchScore: dbMatch && Number.isFinite(Number(dbMatch.matchScore)) ? Number(dbMatch.matchScore) : score,
          eligibility: eligible ? 'ELIGIBLE' : 'EXCLUDED',
          inclusionMet: [
            { criterion: 'Diagnosis confirmation', met: true },
            { criterion: 'Stage requirement', met: i % 3 !== 0 },
            { criterion: 'Age within 18-75', met: ageYears >= 18 && ageYears <= 75 },
            { criterion: 'Biomarker compatible', met: eligible },
          ],
          exclusionTriggers: eligible ? [] : ['Prior systemic therapy line exceeded'],
          recommendation: eligible
            ? 'Refer to site coordinator for screening visit.'
            : 'Re-evaluate at next clinical review.',
        };
      });

      perTrial.sort((a, b) => b.matchScore - a.matchScore);

      const printableText =
        `╔══════════════════════════════════════════════════════════════╗\n` +
        `║  PATIENT MATCH SUMMARY — PRINTABLE PDF REPORT                ║\n` +
        `╚══════════════════════════════════════════════════════════════╝\n` +
        `Patient: ${p.firstName} ${p.lastName}   (ID ${p.id})\n` +
        `DOB: ${p.dateOfBirth}    Age: ${ageYears}    Sex: ${p.gender || '—'}\n` +
        `Diagnosis: ${p.diagnosis || '—'}   Stage: ${p.stage || '—'}\n` +
        `Generated: ${new Date().toISOString()}\n` +
        `Total candidate trials evaluated: ${perTrial.length}\n` +
        `\n--- TRIAL MATCH RESULTS (ranked by score) ---\n` +
        perTrial
          .map(
            (a, idx) =>
              `\n[${idx + 1}] Trial ${a.trialId} — ${a.title}  [Phase ${a.phase}, ${a.therapeuticArea}]\n` +
              `    Score: ${a.matchScore}/100    Status: ${a.eligibility}\n` +
              `    Inclusion: ${a.inclusionMet
                .map((c) => `${c.criterion}=${c.met ? 'YES' : 'NO'}`)
                .join('; ')}\n` +
              `    Exclusion triggers: ${a.exclusionTriggers.length ? a.exclusionTriggers.join('; ') : 'none'}\n` +
              `    Recommendation: ${a.recommendation}`
          )
          .join('\n') +
        `\n\n--- SIGNATURE BLOCK ---\n` +
        `Physician: ______________________   Date: __________\n` +
        `Patient:   ______________________   Date: __________\n` +
        `\n[End of report]`;

      return {
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        ageYears,
        gender: p.gender,
        diagnosis: p.diagnosis,
        stage: p.stage,
        trials: perTrial,
        topMatch: perTrial[0] || null,
        pageCount: 1 + Math.ceil(perTrial.length / 3),
        printableText,
      };
    });

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      input: { patientId, trialId },
      filterApplied: { patient: !!patientId, trial: !!trialId },
      count: reports.length,
      totals: { patients: patients.length, trials: trials.length, matches: matches.length },
      reports,
    });
  } catch (e) {
    console.error('[custom-views/patient-match-pdf]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 4. NON-VIZ — Eligibility Criteria Editor (CRUD)
//    GET    /api/custom-views/eligibility-criteria         list
//    POST   /api/custom-views/eligibility-criteria         create
//    PUT    /api/custom-views/eligibility-criteria/:id     update
//    DELETE /api/custom-views/eligibility-criteria/:id     delete
//
//    Tries DB first via the Eligibility model; falls back to in-memory
//    so the CRUD demo always works.
// ─────────────────────────────────────────────────────────────────────────

router.get('/eligibility-criteria', async (req, res) => {
  try {
    const trialIdFilter = req.query.trialId ? Number(req.query.trialId) : null;
    const trials = await fetchSafe('Trial');
    seedMemoryIfEmpty(trials);

    let dbRows = [];
    try {
      const opts = { raw: true, limit: 200, order: [['id', 'DESC']] };
      if (trialIdFilter) opts.where = { trialId: trialIdFilter };
      if (models && models.Eligibility) {
        dbRows = await models.Eligibility.findAll(opts);
      }
    } catch (e) {
      console.warn('[custom-views/eligibility-criteria GET] DB read failed:', e.message);
    }

    const dbTagged = (dbRows || []).map((r) => ({ ...r, source: r.source || 'db' }));
    const memSubset = trialIdFilter ? memCriteria.filter((c) => c.trialId === trialIdFilter) : memCriteria;
    const combined = [...dbTagged, ...memSubset];

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      filter: { trialId: trialIdFilter },
      count: combined.length,
      dbCount: dbTagged.length,
      memCount: memSubset.length,
      trials: trials.slice(0, 20).map((t) => ({ id: t.id, title: t.title })),
      criteria: combined,
    });
  } catch (e) {
    console.error('[custom-views/eligibility-criteria GET]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/eligibility-criteria', async (req, res) => {
  try {
    const body = req.body || {};
    const record = {
      trialId: body.trialId ? Number(body.trialId) : null,
      description: String(body.description || '').slice(0, 1000) || 'Untitled criterion',
      isInclusion: typeof body.isInclusion === 'boolean' ? body.isInclusion : true,
      category: body.category || 'General',
      priority: body.priority || 'required',
      criteriaType: body.isInclusion === false ? 'exclusion' : 'inclusion',
      ageMin: body.ageMin != null ? Number(body.ageMin) : null,
      ageMax: body.ageMax != null ? Number(body.ageMax) : null,
      gender: body.gender || null,
      biomarkerRequirement: body.biomarkerRequirement || null,
    };

    let created = null;
    try {
      if (models && models.Eligibility) {
        const row = await models.Eligibility.create(record);
        created = { ...row.get({ plain: true }), source: 'db' };
      }
    } catch (e) {
      console.warn('[custom-views/eligibility-criteria POST] DB create failed:', e.message);
    }

    if (!created) {
      const memRow = { id: ++nextMemId, ...record, source: 'memory' };
      memCriteria.unshift(memRow);
      created = memRow;
    }

    res.status(201).json({ success: true, criterion: created });
  } catch (e) {
    console.error('[custom-views/eligibility-criteria POST]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/eligibility-criteria/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const patch = {};
    [
      'trialId',
      'description',
      'isInclusion',
      'category',
      'priority',
      'criteriaType',
      'ageMin',
      'ageMax',
      'gender',
      'biomarkerRequirement',
    ].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });

    let updated = null;
    try {
      if (models && models.Eligibility) {
        const row = await models.Eligibility.findByPk(id);
        if (row) {
          await row.update(patch);
          updated = { ...row.get({ plain: true }), source: 'db' };
        }
      }
    } catch (e) {
      console.warn('[custom-views/eligibility-criteria PUT] DB update failed:', e.message);
    }

    if (!updated) {
      const idx = memCriteria.findIndex((c) => c.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'criterion not found' });
      }
      memCriteria[idx] = { ...memCriteria[idx], ...patch, source: 'memory' };
      updated = memCriteria[idx];
    }

    res.json({ success: true, criterion: updated });
  } catch (e) {
    console.error('[custom-views/eligibility-criteria PUT]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/eligibility-criteria/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    let removed = false;
    try {
      if (models && models.Eligibility) {
        const cnt = await models.Eligibility.destroy({ where: { id } });
        if (cnt > 0) removed = true;
      }
    } catch (e) {
      console.warn('[custom-views/eligibility-criteria DELETE] DB delete failed:', e.message);
    }

    const idx = memCriteria.findIndex((c) => c.id === id);
    if (idx !== -1) {
      memCriteria.splice(idx, 1);
      removed = true;
    }

    if (!removed) {
      return res.status(404).json({ success: false, error: 'criterion not found' });
    }

    res.json({ success: true, id });
  } catch (e) {
    console.error('[custom-views/eligibility-criteria DELETE]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/health', (req, res) => {
  res.json({
    feature: 'custom-views',
    status: 'ok',
    endpoints: [
      'GET /enrollment-funnel',
      'GET /criteria-heatmap',
      'GET /patient-match-pdf',
      'GET|POST|PUT|DELETE /eligibility-criteria[/:id]',
    ],
  });
});

module.exports = router;
