const express = require('express');
const https = require('https');
const { authenticate } = require('../middleware/auth');
const { Patient, Trial, Match, Biomarker, DrugInteraction, Outcome } = require('../models');
const router = express.Router();

function callOpenRouter(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      messages,
      max_tokens: 2000,
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Clinical Trial Matching',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) reject(new Error(parsed.error.message || 'OpenRouter API error'));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// AI Patient-Trial Matching
router.post('/match-patient', authenticate, async (req, res) => {
  try {
    const { patientId } = req.body;
    const patient = await Patient.findByPk(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const trials = await Trial.findAll({ where: { status: 'recruiting' } });

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert clinical trial matching AI. Analyze patient data against available clinical trials and provide detailed matching recommendations with scores, reasoning, and eligibility assessment. Format your response with clear sections using markdown.' },
      { role: 'user', content: `Patient Profile:\n- Name: ${patient.firstName} ${patient.lastName}\n- Diagnosis: ${patient.diagnosis}\n- Stage: ${patient.stage}\n- Biomarkers: ${patient.biomarkers}\n- Medical History: ${patient.medicalHistory}\n- Current Medications: ${patient.currentMedications}\n\nAvailable Clinical Trials:\n${trials.map(t => `- ${t.trialId}: ${t.title} (Phase ${t.phase}, ${t.therapeuticArea})\n  Indication: ${t.indication}\n  Eligibility: ${t.eligibilityCriteria}`).join('\n\n')}\n\nProvide detailed matching analysis for each trial with match scores (0-100), eligibility assessment, and recommendations.` }
    ]);

    const aiContent = response.choices?.[0]?.message?.content || 'No analysis available';
    res.json({
      analysis: aiContent,
      model: response.model,
      usage: response.usage,
      patient: patient.toJSON(),
      trialsAnalyzed: trials.length,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Patient Screening
router.post('/screen-patient', authenticate, async (req, res) => {
  try {
    const { patientId, trialId } = req.body;
    const patient = await Patient.findByPk(patientId);
    const trial = await Trial.findByPk(trialId);
    if (!patient || !trial) return res.status(404).json({ error: 'Patient or Trial not found' });

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert clinical trial screening AI. Perform a detailed eligibility screening of the patient against the trial criteria. Provide a structured assessment with inclusion/exclusion criteria analysis, risk factors, and a final recommendation. Use markdown formatting.' },
      { role: 'user', content: `Screen this patient for trial eligibility:\n\nPatient: ${patient.firstName} ${patient.lastName}\n- DOB: ${patient.dateOfBirth}\n- Gender: ${patient.gender}\n- Diagnosis: ${patient.diagnosis}\n- Stage: ${patient.stage}\n- Biomarkers: ${patient.biomarkers}\n- Medical History: ${patient.medicalHistory}\n- Medications: ${patient.currentMedications}\n\nTrial: ${trial.title} (${trial.trialId})\n- Phase: ${trial.phase}\n- Indication: ${trial.indication}\n- Eligibility Criteria: ${trial.eligibilityCriteria}\n- Primary Endpoint: ${trial.primaryEndpoint}` }
    ]);

    res.json({
      screening: response.choices?.[0]?.message?.content || 'No screening available',
      model: response.model,
      usage: response.usage,
      patient: patient.toJSON(),
      trial: trial.toJSON(),
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Biomarker Analysis
router.post('/analyze-biomarkers', authenticate, async (req, res) => {
  try {
    const { patientId } = req.body;
    const biomarkers = await Biomarker.findAll({ where: { patientId } });
    const patient = await Patient.findByPk(patientId);

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert biomarker analysis AI for clinical trials. Analyze the biomarker data and provide insights on treatment implications, trial eligibility impact, and prognostic significance. Use markdown formatting with clear sections.' },
      { role: 'user', content: `Analyze biomarkers for patient ${patient?.firstName} ${patient?.lastName}:\n\nDiagnosis: ${patient?.diagnosis}\nStage: ${patient?.stage}\n\nBiomarker Results:\n${biomarkers.map(b => `- ${b.name}: ${b.value} ${b.unit} (Normal: ${b.normalRange}, Status: ${b.status})`).join('\n')}\n\nProvide comprehensive biomarker analysis including treatment implications and trial eligibility impact.` }
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
      biomarkerCount: biomarkers.length,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Drug Interaction Check
router.post('/check-interactions', authenticate, async (req, res) => {
  try {
    const { medications } = req.body;

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert pharmacology AI specializing in drug interactions for clinical trials. Analyze the provided medications for potential interactions, contraindications, and safety concerns. Format with clear severity levels and recommendations using markdown.' },
      { role: 'user', content: `Check for drug interactions among these medications:\n\n${medications}\n\nProvide a detailed interaction analysis including severity, mechanism, and clinical recommendations for each potential interaction.` }
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Outcome Prediction
router.post('/predict-outcome', authenticate, async (req, res) => {
  try {
    const { patientId, trialId } = req.body;
    const patient = await Patient.findByPk(patientId);
    const trial = await Trial.findByPk(trialId);
    const outcomes = await Outcome.findAll({ where: { trialId } });

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert clinical trial outcomes prediction AI. Based on patient data, trial information, and historical outcomes, predict likely treatment outcomes. Provide confidence levels and supporting evidence. Use markdown formatting.' },
      { role: 'user', content: `Predict outcomes for:\n\nPatient: ${patient?.firstName} ${patient?.lastName}\n- Diagnosis: ${patient?.diagnosis}\n- Stage: ${patient?.stage}\n- Biomarkers: ${patient?.biomarkers}\n\nTrial: ${trial?.title}\n- Phase: ${trial?.phase}\n- Primary Endpoint: ${trial?.primaryEndpoint}\n\nHistorical Outcomes (${outcomes.length} records):\n${outcomes.slice(0, 10).map(o => `- ${o.endpoint}: ${o.value} ${o.unit} (${o.status})`).join('\n')}\n\nProvide detailed outcome predictions with confidence intervals.` }
    ]);

    res.json({
      prediction: response.choices?.[0]?.message?.content || 'No prediction available',
      model: response.model,
      usage: response.usage,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Protocol Analysis
router.post('/analyze-protocol', authenticate, async (req, res) => {
  try {
    const { protocolId } = req.body;
    const { Protocol } = require('../models');
    const protocol = await Protocol.findByPk(protocolId);
    if (!protocol) return res.status(404).json({ error: 'Protocol not found' });

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert clinical trial protocol analyst AI. Review the protocol and provide insights on design quality, potential issues, regulatory compliance, and improvement suggestions. Use markdown formatting.' },
      { role: 'user', content: `Analyze this clinical trial protocol:\n\nProtocol: ${protocol.protocolNumber}\nTitle: ${protocol.title}\nVersion: ${protocol.version}\nStatus: ${protocol.status}\n\nSummary: ${protocol.summary}\nObjectives: ${protocol.objectives}\nStudy Design: ${protocol.studyDesign}\nDosage Regimen: ${protocol.dosageRegimen}\n\nProvide a comprehensive protocol analysis with improvement recommendations.` }
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
      protocol: protocol.toJSON(),
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Adverse Event Analysis
router.post('/analyze-adverse-events', authenticate, async (req, res) => {
  try {
    const { trialId } = req.body;
    const { AdverseEvent } = require('../models');
    const events = await AdverseEvent.findAll({ where: { trialId } });
    const trial = await Trial.findByPk(trialId);

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert pharmacovigilance AI. Analyze adverse events for safety signals, patterns, and risk assessment. Provide structured analysis with severity distribution, causality assessment, and safety recommendations. Use markdown formatting.' },
      { role: 'user', content: `Analyze adverse events for trial: ${trial?.title}\n\nAdverse Events (${events.length} total):\n${events.map(e => `- ${e.eventType} | Severity: ${e.severity} | Relatedness: ${e.relatedness} | Outcome: ${e.outcome}\n  Description: ${e.description}`).join('\n')}\n\nProvide comprehensive safety analysis with signal detection and recommendations.` }
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
      eventCount: events.length,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Regulatory Compliance Check
router.post('/check-compliance', authenticate, async (req, res) => {
  try {
    const { trialId } = req.body;
    const { Regulatory } = require('../models');
    const docs = await Regulatory.findAll({ where: { trialId } });
    const trial = await Trial.findByPk(trialId);

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert regulatory compliance AI for clinical trials. Review regulatory documents and compliance status. Identify gaps, expiring documents, and provide compliance recommendations. Use markdown formatting.' },
      { role: 'user', content: `Check regulatory compliance for trial: ${trial?.title}\n\nRegulatory Documents:\n${docs.map(d => `- ${d.documentType}: ${d.title}\n  Status: ${d.status} | Authority: ${d.authority}\n  Submission: ${d.submissionDate} | Approval: ${d.approvalDate} | Expiry: ${d.expiryDate}`).join('\n')}\n\nProvide compliance gap analysis and recommendations.` }
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
      documentCount: docs.length,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Report Generation
router.post('/generate-report', authenticate, async (req, res) => {
  try {
    const { reportType, trialId } = req.body;
    const trial = trialId ? await Trial.findByPk(trialId) : null;

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert clinical trial report generation AI. Generate comprehensive, professional reports based on the requested type. Include executive summary, key findings, analysis, and recommendations. Use markdown formatting with tables where appropriate.' },
      { role: 'user', content: `Generate a ${reportType} report${trial ? ` for trial: ${trial.title} (${trial.trialId})` : ''}.\n\nTrial Details:\n- Phase: ${trial?.phase}\n- Status: ${trial?.status}\n- Sponsor: ${trial?.sponsor}\n- Therapeutic Area: ${trial?.therapeuticArea}\n- Target Enrollment: ${trial?.targetEnrollment}\n- Current Enrollment: ${trial?.currentEnrollment}\n\nGenerate a comprehensive ${reportType} report with executive summary, findings, and recommendations.` }
    ]);

    res.json({
      report: response.choices?.[0]?.message?.content || 'No report generated',
      model: response.model,
      usage: response.usage,
      reportType,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// AI Enrollment Optimization
router.post('/optimize-enrollment', authenticate, async (req, res) => {
  try {
    const { trialId } = req.body;
    const trial = await Trial.findByPk(trialId);
    const { Enrollment, Site } = require('../models');
    const enrollments = await Enrollment.findAll({ where: { trialId } });
    const sites = await Site.findAll();

    const response = await callOpenRouter([
      { role: 'system', content: 'You are an expert clinical trial enrollment optimization AI. Analyze enrollment data and provide strategies to accelerate patient recruitment, improve site performance, and optimize enrollment timelines. Use markdown formatting.' },
      { role: 'user', content: `Optimize enrollment for trial: ${trial?.title}\n\nCurrent Status:\n- Target: ${trial?.targetEnrollment}\n- Current: ${trial?.currentEnrollment}\n- Enrollments: ${enrollments.length}\n\nEnrollment Status Distribution:\n${enrollments.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {})}\n\nActive Sites: ${sites.length}\n${sites.map(s => `- ${s.name} (${s.city}, ${s.state}) - Capacity: ${s.capacity}`).join('\n')}\n\nProvide enrollment optimization strategies and timeline projections.` }
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
