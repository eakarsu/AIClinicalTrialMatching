import api from './api';

// Wrapper service for all AI endpoints in the platform.
// Centralizes URLs, request bodies, and parsing.

export const aiService = {
  // /ai routes (legacy / core)
  matchPatient: (patientId) => api.post('/ai/match-patient', { patientId }),
  screenPatient: (patientId, trialId) => api.post('/ai/screen-patient', { patientId, trialId }),
  analyzeBiomarkers: (patientId) => api.post('/ai/analyze-biomarkers', { patientId }),
  checkInteractions: (medications) => api.post('/ai/check-interactions', { medications }),
  predictOutcome: (patientId, trialId) => api.post('/ai/predict-outcome', { patientId, trialId }),
  analyzeProtocol: (protocolId) => api.post('/ai/analyze-protocol', { protocolId }),
  analyzeAdverseEvents: (trialId) => api.post('/ai/analyze-adverse-events', { trialId }),
  checkCompliance: (trialId) => api.post('/ai/check-compliance', { trialId }),
  generateReport: (reportType, trialId) => api.post('/ai/generate-report', { reportType, trialId }),
  optimizeEnrollment: (trialId) => api.post('/ai/optimize-enrollment', { trialId }),

  // /ai routes (aiNew specialized)
  cohortAnalysis: (trial_id) => api.post('/ai/cohort-analysis', { trial_id }),
  protocolOptimizer: (protocol_text, enrollment_challenges) =>
    api.post('/ai/protocol-optimizer', { protocol_text, enrollment_challenges }),
  siteSelection: (trial_requirements, available_sites) =>
    api.post('/ai/site-selection', { trial_requirements, available_sites }),
  consentSimplifier: (informed_consent_text) =>
    api.post('/ai/consent-simplifier', { informed_consent_text }),

  // Advanced (proposed-NEW) endpoints
  preScreenBatch: (trial_id, patient_ids, limit) =>
    api.post('/ai/pre-screen-batch', { trial_id, patient_ids, limit }),
  biomarkerTrend: (patient_id, biomarker_name, threshold) =>
    api.post('/ai/biomarker-trend', { patient_id, biomarker_name, threshold }),
  siteFeasibilityRank: (trial_id, max_sites) =>
    api.post('/ai/site-feasibility-rank', { trial_id, max_sites }),
  protocolVersionDiff: (protocol_a_id, protocol_b_id) =>
    api.post('/ai/protocol-version-diff', { protocol_a_id, protocol_b_id }),
  multiTrialCohort: (min_concurrent, limit) =>
    api.post('/ai/multi-trial-cohort', { min_concurrent, limit }),
  outcomeEnsemble: (patient_id, trial_id, runs) =>
    api.post('/ai/outcome-ensemble', { patient_id, trial_id, runs }),
  regulatoryReadiness: (params) => api.get('/ai/regulatory-readiness', { params }),
  predictDropout: (enrollment_id) => api.post('/ai/predict-dropout', { enrollment_id }),
  siteOptimizer: (trial_id, target_sites) =>
    api.post('/ai/site-optimizer', { trial_id, target_sites }),
};

export default aiService;
