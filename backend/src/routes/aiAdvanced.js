/**
 * Advanced AI routes — proposed NEW custom non-CRUD features.
 *
 * Endpoints:
 *  POST /api/ai/pre-screen-batch         — eligibility pre-screening over many patients
 *  POST /api/ai/biomarker-trend          — predictive biomarker trajectory + threshold alerts
 *  POST /api/ai/site-feasibility-rank    — rank sites by capacity, history, proximity
 *  POST /api/ai/protocol-version-diff    — diff two protocol versions and patient impact
 *  POST /api/ai/multi-trial-cohort       — cohort builder eligible for many concurrent trials
 *  POST /api/ai/outcome-ensemble         — ensemble outcome prediction with variance flagging
 *  GET  /api/ai/regulatory-readiness     — real-time regulatory dashboard data
 */
const express = require('express');
const https = require('https');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const {
  Patient,
  Trial,
  Site,
  Enrollment,
  Biomarker,
  Protocol,
  Regulatory,
  Match,
  AuditLog,
} = require('../models');

const router = express.Router();
const DISCLAIMER =
  'All AI suggestions require review and approval by qualified clinical research professionals.';
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

function callOpenRouter(messages, maxTokens = 3000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens });
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Clinical Trial Matching',
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) reject(new Error(parsed.error.message || 'OpenRouter API error'));
          else resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 3-strategy JSON parser
function parseAIJson(text) {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch (e) {}
  const stripped = text
    .replace(/```(?:json)?\n?/g, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch (e) {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {}
  }
  return null;
}

async function logAudit(req, action, resource, resourceId, payload = {}) {
  try {
    await AuditLog.create({
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : null,
      ipAddress: req.ip || null,
      userAgent: req.get('User-Agent') || null,
      payload,
    });
  } catch (e) {
    console.error('[audit] failed to log:', e.message);
  }
}

/**
 * POST /api/ai/pre-screen-batch
 * Body: { trial_id, patient_ids?: number[], limit?: number }
 * Bulk pre-screen patients for a single trial. Returns AI per-patient assessments + recommended advance/hold list.
 */
router.post('/pre-screen-batch', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { trial_id, patient_ids, limit } = req.body;
    if (!trial_id) return res.status(400).json({ error: 'trial_id is required' });

    const trial = await Trial.findByPk(trial_id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });

    const where = patient_ids && Array.isArray(patient_ids) && patient_ids.length > 0
      ? { id: { [Op.in]: patient_ids } }
      : { status: 'active' };
    const cap = Math.min(parseInt(limit) || 25, 100);
    const patients = await Patient.findAll({ where, limit: cap });

    if (patients.length === 0) {
      return res.json({ trialId: trial_id, scanned: 0, results: [], disclaimer: DISCLAIMER });
    }

    const summary = patients
      .map(
        (p) =>
          `- id=${p.id} | ${p.firstName} ${p.lastName} | dx=${p.diagnosis} stage=${p.stage} | bm=${(p.biomarkers || '').slice(0, 80)}`
      )
      .join('\n');

    const response = await callOpenRouter(
      [
        {
          role: 'system',
          content:
            'You are a clinical trial pre-screening AI. For each patient, return a JSON object with id, recommendation (advance|hold|reject), confidence (0-100), and a one-line rationale grounded in the trial criteria. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Pre-screen these patients against trial:\n\nTrial: ${trial.title} (${trial.trialId})\nIndication: ${trial.indication}\nEligibility: ${trial.eligibilityCriteria}\n\nPatients:\n${summary}\n\nReturn JSON: { "results": [ { "id": number, "recommendation": "advance|hold|reject", "confidence": number, "rationale": string } ] }`,
        },
      ],
      3500
    );

    const aiText = response.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(aiText) || { results: [] };

    const advance = (parsed.results || []).filter((r) => r.recommendation === 'advance');
    const hold = (parsed.results || []).filter((r) => r.recommendation === 'hold');
    const reject = (parsed.results || []).filter((r) => r.recommendation === 'reject');

    await logAudit(req, 'pre_screen_batch', 'trial', trial_id, {
      scanned: patients.length,
      advance: advance.length,
      hold: hold.length,
      reject: reject.length,
    });

    res.json({
      trialId: trial_id,
      trialTitle: trial.title,
      scanned: patients.length,
      summary: { advance: advance.length, hold: hold.length, reject: reject.length },
      results: parsed.results || [],
      raw: !parsed.results ? aiText : undefined,
      model: response.model,
      usage: response.usage,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/biomarker-trend
 * Body: { patient_id, biomarker_name, threshold? }
 * Predict next biomarker values from history; alert if trajectory crosses threshold.
 */
router.post('/biomarker-trend', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { patient_id, biomarker_name, threshold } = req.body;
    if (!patient_id || !biomarker_name) {
      return res.status(400).json({ error: 'patient_id and biomarker_name are required' });
    }

    const patient = await Patient.findByPk(patient_id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const history = await Biomarker.findAll({
      where: { patientId: patient_id, name: biomarker_name },
      order: [['testDate', 'ASC']],
    });

    if (history.length < 2) {
      return res.status(400).json({
        error: 'Need at least 2 historical biomarker readings to predict a trend.',
      });
    }

    const series = history.map(
      (b) => `${b.testDate || 'unknown'}: ${b.value} ${b.unit} (status=${b.status})`
    );

    const response = await callOpenRouter(
      [
        {
          role: 'system',
          content:
            'You are a biostatistician AI. Given longitudinal biomarker measurements, project the next 3 values, estimate confidence intervals, and flag if the trajectory will cross the supplied threshold. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Patient: ${patient.firstName} ${patient.lastName} (${patient.diagnosis})\nBiomarker: ${biomarker_name}\nThreshold of concern: ${threshold ?? 'not provided'}\n\nHistorical readings:\n${series.join('\n')}\n\nReturn JSON: { "trend": "increasing|decreasing|stable|volatile", "next_predictions": [ { "date_offset_days": number, "value": number, "ci_low": number, "ci_high": number } ], "threshold_crossing": { "will_cross": boolean, "estimated_days_until_crossing": number|null, "confidence": number }, "clinical_note": string }`,
        },
      ],
      2500
    );

    const aiText = response.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(aiText);

    res.json({
      patientId: patient_id,
      biomarker: biomarker_name,
      threshold: threshold ?? null,
      historyCount: history.length,
      prediction: parsed,
      raw: parsed ? undefined : aiText,
      model: response.model,
      usage: response.usage,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/site-feasibility-rank
 * Body: { trial_id, max_sites?: number }
 * Rank known sites by capacity, prior enrollment performance, and trial fit.
 */
router.post('/site-feasibility-rank', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { trial_id, max_sites } = req.body;
    if (!trial_id) return res.status(400).json({ error: 'trial_id is required' });

    const trial = await Trial.findByPk(trial_id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });

    const cap = Math.min(parseInt(max_sites) || 20, 50);
    const sites = await Site.findAll({ where: { status: 'active' }, limit: cap });

    if (sites.length === 0) {
      return res.json({ trialId: trial_id, ranking: [], disclaimer: DISCLAIMER });
    }

    // Pre-compute historical enrollment per site
    const enrollmentCounts = await Enrollment.findAll({
      attributes: [
        'siteId',
        [
          require('sequelize').fn('COUNT', require('sequelize').col('id')),
          'enrolled',
        ],
      ],
      group: ['siteId'],
    });
    const countMap = {};
    enrollmentCounts.forEach((e) => {
      countMap[e.siteId] = parseInt(e.get('enrolled')) || 0;
    });

    const summary = sites
      .map(
        (s) =>
          `- id=${s.id} | ${s.name} (${s.city}, ${s.state}) | capacity=${s.capacity} | active=${s.activeTrials} | priorEnrolled=${countMap[s.id] || 0} | PI=${s.principalInvestigator}`
      )
      .join('\n');

    const response = await callOpenRouter(
      [
        {
          role: 'system',
          content:
            'You are a clinical site feasibility AI. Rank investigator sites for a trial considering capacity, historical enrollment velocity, geography, and PI experience. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Trial: ${trial.title}\nTherapeutic area: ${trial.therapeuticArea}\nIndication: ${trial.indication}\nTarget enrollment: ${trial.targetEnrollment}\n\nSites:\n${summary}\n\nReturn JSON: { "ranking": [ { "site_id": number, "rank": number, "score": number, "capacity_fit": "high|medium|low", "estimated_monthly_enrollment": number, "rationale": string } ], "portfolio_recommendation": string }`,
        },
      ],
      3500
    );

    const aiText = response.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(aiText);

    await logAudit(req, 'site_feasibility_rank', 'trial', trial_id, { sites: sites.length });

    res.json({
      trialId: trial_id,
      sitesEvaluated: sites.length,
      ranking: parsed,
      raw: parsed ? undefined : aiText,
      model: response.model,
      usage: response.usage,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/protocol-version-diff
 * Body: { protocol_a_id, protocol_b_id }
 * Diff two protocol versions; flag changed eligibility criteria and patient impact.
 */
router.post('/protocol-version-diff', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { protocol_a_id, protocol_b_id } = req.body;
    if (!protocol_a_id || !protocol_b_id) {
      return res.status(400).json({ error: 'protocol_a_id and protocol_b_id are required' });
    }
    if (protocol_a_id === protocol_b_id) {
      return res.status(400).json({ error: 'Two distinct protocol IDs are required' });
    }

    const a = await Protocol.findByPk(protocol_a_id);
    const b = await Protocol.findByPk(protocol_b_id);
    if (!a || !b) return res.status(404).json({ error: 'One or both protocols not found' });

    const response = await callOpenRouter(
      [
        {
          role: 'system',
          content:
            'You are a clinical trial protocol comparison AI. Diff two protocol versions, highlight changes (especially eligibility), assess patient-impact severity, and suggest required notifications. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `PROTOCOL A:\n${a.protocolNumber} v${a.version}\nObjectives: ${a.objectives}\nDesign: ${a.studyDesign}\nDosage: ${a.dosageRegimen}\nSummary: ${a.summary}\n\nPROTOCOL B:\n${b.protocolNumber} v${b.version}\nObjectives: ${b.objectives}\nDesign: ${b.studyDesign}\nDosage: ${b.dosageRegimen}\nSummary: ${b.summary}\n\nReturn JSON: { "summary": string, "changes": [ { "section": string, "type": "added|removed|modified", "description": string, "patient_impact": "none|low|medium|high|critical", "regulatory_action": string } ], "screen_failure_risk_change_pct": number, "required_notifications": [string], "recommendation": "amend|reissue|withdraw" }`,
        },
      ],
      3500
    );

    const aiText = response.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(aiText);

    await logAudit(req, 'protocol_version_diff', 'protocol', protocol_a_id, {
      compared_with: protocol_b_id,
    });

    res.json({
      protocolA: { id: a.id, version: a.version, number: a.protocolNumber },
      protocolB: { id: b.id, version: b.version, number: b.protocolNumber },
      diff: parsed,
      raw: parsed ? undefined : aiText,
      model: response.model,
      usage: response.usage,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/multi-trial-cohort
 * Body: { min_concurrent?: number = 5, limit?: number = 25 }
 * Find patients eligible for multiple concurrent trials.
 */
router.post('/multi-trial-cohort', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { min_concurrent = 3, limit = 25 } = req.body;
    const cap = Math.min(parseInt(limit) || 25, 100);

    const patients = await Patient.findAll({ where: { status: 'active' }, limit: cap });
    const trials = await Trial.findAll({ where: { status: 'recruiting' }, limit: 50 });

    if (patients.length === 0 || trials.length === 0) {
      return res.json({
        cohort: [],
        message: 'Insufficient patients or recruiting trials',
        disclaimer: DISCLAIMER,
      });
    }

    const patientSummary = patients
      .map(
        (p) =>
          `id=${p.id} dx=${p.diagnosis} stage=${p.stage} bm=${(p.biomarkers || '').slice(0, 60)}`
      )
      .join('\n');
    const trialSummary = trials
      .map((t) => `id=${t.id} title="${t.title}" ind=${t.indication} crit=${(t.eligibilityCriteria || '').slice(0, 100)}`)
      .join('\n');

    const response = await callOpenRouter(
      [
        {
          role: 'system',
          content:
            'You are a clinical operations AI. Identify patients eligible for multiple concurrent recruiting trials. For each eligible patient, list trial IDs and a strategy that maximizes data collection without compromising safety. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Find patients eligible for at least ${min_concurrent} concurrent trials.\n\nPATIENTS:\n${patientSummary}\n\nTRIALS:\n${trialSummary}\n\nReturn JSON: { "cohort": [ { "patient_id": number, "eligible_trial_ids": [number], "strategy": string, "safety_concerns": [string] } ], "total_matched": number }`,
        },
      ],
      3500
    );

    const aiText = response.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(aiText);

    res.json({
      patientsScanned: patients.length,
      trialsScanned: trials.length,
      minConcurrent: min_concurrent,
      result: parsed,
      raw: parsed ? undefined : aiText,
      model: response.model,
      usage: response.usage,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/outcome-ensemble
 * Body: { patient_id, trial_id, runs?: number = 3 }
 * Run multiple outcome predictions; report consensus and variance.
 */
router.post('/outcome-ensemble', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { patient_id, trial_id, runs = 3 } = req.body;
    if (!patient_id || !trial_id) {
      return res.status(400).json({ error: 'patient_id and trial_id are required' });
    }
    const ensembleSize = Math.min(Math.max(parseInt(runs) || 3, 2), 5);

    const patient = await Patient.findByPk(patient_id);
    const trial = await Trial.findByPk(trial_id);
    if (!patient || !trial) return res.status(404).json({ error: 'Patient or trial not found' });

    const tasks = [];
    for (let i = 0; i < ensembleSize; i++) {
      tasks.push(
        callOpenRouter(
          [
            {
              role: 'system',
              content: `You are clinical outcome forecaster #${i + 1}. Provide a probabilistic outcome estimate. Respond with valid JSON only.`,
            },
            {
              role: 'user',
              content: `Patient: ${patient.firstName} ${patient.lastName} (${patient.diagnosis}, stage ${patient.stage})\nBiomarkers: ${patient.biomarkers}\nTrial: ${trial.title} (${trial.phase})\nPrimary endpoint: ${trial.primaryEndpoint}\n\nReturn JSON: { "predicted_response_pct": number, "confidence": number, "key_factors": [string], "risk_flags": [string] }`,
            },
          ],
          1500
        )
      );
    }

    const responses = await Promise.all(tasks);
    const parsed = responses
      .map((r) => parseAIJson(r.choices?.[0]?.message?.content || ''))
      .filter(Boolean);

    if (parsed.length === 0) {
      return res.status(502).json({ error: 'All ensemble runs failed to produce parsable JSON' });
    }

    const responses_pct = parsed.map((p) => Number(p.predicted_response_pct) || 0);
    const mean = responses_pct.reduce((a, b) => a + b, 0) / responses_pct.length;
    const variance =
      responses_pct.reduce((acc, v) => acc + (v - mean) ** 2, 0) / responses_pct.length;
    const stdev = Math.sqrt(variance);
    const highVariance = stdev > 15;

    res.json({
      patientId: patient_id,
      trialId: trial_id,
      ensembleSize,
      predictions: parsed,
      consensus: {
        mean_predicted_response_pct: Number(mean.toFixed(2)),
        stdev: Number(stdev.toFixed(2)),
        min: Math.min(...responses_pct),
        max: Math.max(...responses_pct),
        high_variance: highVariance,
        review_recommended: highVariance,
      },
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/regulatory-readiness
 * Returns: per-trial regulatory document status, gaps, expiry-soon alerts.
 * Query: trial_id? page=1 limit=20
 */
router.get('/regulatory-readiness', authenticate, async (req, res) => {
  try {
    const { trial_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const trialWhere = trial_id ? { id: trial_id } : {};

    const trials = await Trial.findAll({
      where: trialWhere,
      limit,
      offset,
      order: [['id', 'ASC']],
    });

    const totalTrials = await Trial.count({ where: trialWhere });

    const requiredDocTypes = [
      'IRB_approval',
      'FDA_IND',
      'protocol',
      'ICF',
      'investigator_brochure',
      'site_agreement',
    ];

    const now = new Date();
    const dashboard = await Promise.all(
      trials.map(async (t) => {
        const docs = await Regulatory.findAll({ where: { trialId: t.id } });
        const docTypes = docs.map((d) => d.documentType);
        const missing = requiredDocTypes.filter((req) => !docTypes.includes(req));
        const expiring = docs
          .filter((d) => d.expiryDate)
          .map((d) => {
            const daysLeft = Math.ceil(
              (new Date(d.expiryDate) - now) / (1000 * 60 * 60 * 24)
            );
            return { id: d.id, type: d.documentType, expiryDate: d.expiryDate, daysLeft };
          })
          .filter((d) => d.daysLeft <= 30 && d.daysLeft >= 0);
        const expired = docs
          .filter((d) => d.expiryDate)
          .filter((d) => new Date(d.expiryDate) < now);

        const score = Math.round(
          ((requiredDocTypes.length - missing.length) / requiredDocTypes.length) * 100 -
            expired.length * 10 -
            expiring.length * 5
        );

        return {
          trialId: t.id,
          title: t.title,
          phase: t.phase,
          status: t.status,
          documentCount: docs.length,
          missing,
          expiringSoon: expiring,
          expired: expired.map((d) => ({ id: d.id, type: d.documentType, expiryDate: d.expiryDate })),
          readinessScore: Math.max(0, Math.min(100, score)),
          readinessLabel:
            score >= 90 ? 'ready' : score >= 70 ? 'minor_gaps' : score >= 40 ? 'major_gaps' : 'not_ready',
        };
      })
    );

    res.json({
      data: dashboard,
      pagination: {
        page,
        limit,
        total: totalTrials,
        totalPages: Math.ceil(totalTrials / limit),
      },
      generatedAt: new Date().toISOString(),
      requiredDocTypes,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/predict-dropout
 * Body: { enrollment_id }
 * Predict early-dropout risk for one enrollment using patient + trial context.
 */
router.post('/predict-dropout', authenticate, aiRateLimiter, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI not configured' });
    }
    const { enrollment_id } = req.body;
    if (!enrollment_id) return res.status(400).json({ error: 'enrollment_id is required' });

    const enrollment = await Enrollment.findByPk(enrollment_id);
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    const patient = enrollment.patientId ? await Patient.findByPk(enrollment.patientId) : null;
    const trial = enrollment.trialId ? await Trial.findByPk(enrollment.trialId) : null;

    const response = await callOpenRouter(
      [
        {
          role: 'system',
          content:
            'You are a clinical trial retention AI. Estimate dropout risk (0-100) for the supplied enrollment using patient comorbidities, trial burden, geography, and historical signals. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `ENROLLMENT id=${enrollment.id} status=${enrollment.status}\n\nPATIENT: ${patient ? `${patient.firstName} ${patient.lastName} dx=${patient.diagnosis} stage=${patient.stage}` : 'unknown'}\n\nTRIAL: ${trial ? `${trial.title} phase=${trial.phase} indication=${trial.indication}` : 'unknown'}\n\nReturn JSON: { "risk_score": number, "risk_band": "low|medium|high", "top_drivers": [string], "mitigations": [string], "follow_up_window_days": number }`,
        },
      ],
      1500
    );

    const aiText = response.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(aiText);

    await logAudit(req, 'predict_dropout', 'enrollment', enrollment_id, {
      risk: parsed?.risk_band,
    });

    res.json({
      enrollmentId: enrollment.id,
      patientId: enrollment.patientId,
      trialId: enrollment.trialId,
      prediction: parsed,
      raw: parsed ? undefined : aiText,
      model: response.model,
      usage: response.usage,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/site-optimizer
 * Body: { trial_id, target_sites?: number = 5 }
 * Recommend an optimal site network for a protocol balancing geography, capacity, and cost.
 */
router.post('/site-optimizer', authenticate, aiRateLimiter, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI not configured' });
    }
    const { trial_id, target_sites = 5 } = req.body;
    if (!trial_id) return res.status(400).json({ error: 'trial_id is required' });

    const trial = await Trial.findByPk(trial_id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });

    const sites = await Site.findAll({ where: { status: 'active' }, limit: 50 });
    if (sites.length === 0) {
      return res.json({ trialId: trial_id, recommendation: null, disclaimer: DISCLAIMER });
    }

    const summary = sites
      .map(
        (s) =>
          `- id=${s.id} | ${s.name} (${s.city}, ${s.state}) | capacity=${s.capacity} | active=${s.activeTrials} | PI=${s.principalInvestigator}`
      )
      .join('\n');

    const response = await callOpenRouter(
      [
        {
          role: 'system',
          content:
            'You are a clinical operations AI. Compose an optimal site network of the requested size that maximises target enrollment within timelines, balancing geography, capacity, and PI experience. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Trial: ${trial.title}\nIndication: ${trial.indication}\nTarget enrollment: ${trial.targetEnrollment}\nDesired network size: ${target_sites}\n\nCANDIDATE SITES:\n${summary}\n\nReturn JSON: { "selected_site_ids": [number], "estimated_total_monthly_enrollment": number, "geographic_coverage": string, "rationale": string, "alternates": [number] }`,
        },
      ],
      2500
    );

    const aiText = response.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(aiText);

    await logAudit(req, 'site_optimizer', 'trial', trial_id, {
      target_sites,
      candidate_count: sites.length,
    });

    res.json({
      trialId: trial_id,
      candidates: sites.length,
      targetSites: target_sites,
      recommendation: parsed,
      raw: parsed ? undefined : aiText,
      model: response.model,
      usage: response.usage,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
