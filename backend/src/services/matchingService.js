/*
 * Trial-matching service.
 *
 * Deterministic heuristic scoring of a patient against currently recruiting
 * trials, persisting Match rows. Shared so both the manual /api/matches/score
 * endpoint and the automatic EHR-sync flow score patients the same way.
 *
 * (AI-enhanced scoring lives in /api/ai/match-patient; this is the fast,
 * credential-free baseline used to seed candidate matches.)
 */

function computeScore(patient, trial) {
  const diag = (patient.diagnosis || '').toLowerCase().trim();
  const indication = (trial.indication || '').toLowerCase();
  const criteria = (trial.eligibilityCriteria || '').toLowerCase();

  let score = 0;
  const reasons = [];

  // Diagnosis ↔ indication overlap (strongest signal).
  if (diag && indication) {
    const head = diag.split(' ')[0];
    if (indication.includes(diag) || (head && indication.includes(head))) {
      score += 40;
      reasons.push(`diagnosis matches indication (${trial.indication})`);
    }
  }

  // Biomarker hits against the trial's eligibility criteria.
  const biomarkers = (patient.biomarkers || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  let bmHits = 0;
  for (const b of biomarkers) {
    const token = b.split(' ')[0];
    if (token && (criteria.includes(token) || indication.includes(token))) bmHits++;
  }
  if (bmHits > 0) {
    score += Math.min(30, bmHits * 15);
    reasons.push(`${bmHits} biomarker match(es)`);
  }

  // Phase weighting.
  const phaseBonus = { 'Phase 1': 5, 'Phase 2': 10, 'Phase 3': 15, 'Phase 4': 10 }[trial.phase] || 0;
  if (phaseBonus) { score += phaseBonus; reasons.push(`${trial.phase}`); }

  return { score: Math.min(100, score), reason: reasons.join('; ') || 'no strong criteria match' };
}

/**
 * Score one patient against all recruiting trials and upsert Match rows.
 * Returns the candidate matches (sorted by score, best first).
 */
async function scorePatient(patient, models) {
  const { Trial, Match } = models;
  const recruiting = await Trial.findAll({ where: { status: 'recruiting' } });
  const results = [];
  for (const trial of recruiting) {
    const { score, reason } = computeScore(patient, trial);
    const [match, created] = await Match.findOrCreate({
      where: { patientId: patient.id, trialId: trial.id },
      defaults: { matchScore: score, matchReason: reason, status: 'candidate' },
    });
    if (!created) await match.update({ matchScore: score, matchReason: reason });
    results.push({ trialId: trial.id, trialTitle: trial.title, matchScore: score, created });
  }
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}

module.exports = { scorePatient, computeScore };
