const express = require('express');
const https = require('https');
const { authenticate } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { Trial, Enrollment, Site } = require('../models');
const router = express.Router();

const DISCLAIMER =
  'All matching suggestions require review by qualified clinical research professionals.';

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

function callOpenRouter(messages, maxTokens = 3000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
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

/**
 * POST /api/ai/cohort-analysis
 * Body: { trial_id }
 * Returns enrollment patterns, dropout risk, and completion prediction for the trial cohort.
 */
router.post('/cohort-analysis', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { trial_id } = req.body;
    if (!trial_id) {
      return res.status(400).json({ error: 'trial_id is required' });
    }

    const trial = await Trial.findByPk(trial_id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });

    const enrollments = await Enrollment.findAll({ where: { trialId: trial_id } });

    // Build status distribution
    const statusDist = enrollments.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {});

    const screeningFailRate =
      enrollments.length > 0
        ? (((statusDist['screen_failed'] || 0) / enrollments.length) * 100).toFixed(1)
        : 0;

    const response = await callOpenRouter([
      {
        role: 'system',
        content:
          'You are an expert clinical trial biostatistician and data analyst. Analyze cohort enrollment patterns, predict completion timelines, and identify risk factors for dropout and screen failure. Use structured markdown with tables and quantitative estimates.',
      },
      {
        role: 'user',
        content: `Perform a cohort analysis for the following clinical trial:

Trial: ${trial.title} (${trial.trialId || 'N/A'})
Phase: ${trial.phase}
Status: ${trial.status}
Therapeutic Area: ${trial.therapeuticArea}
Target Enrollment: ${trial.targetEnrollment}
Current Enrollment: ${trial.currentEnrollment}
Start Date: ${trial.startDate}
End Date: ${trial.endDate}

Enrollment Status Distribution:
${Object.entries(statusDist).map(([k, v]) => `- ${k}: ${v} (${((v / (enrollments.length || 1)) * 100).toFixed(1)}%)`).join('\n')}

Total Enrollment Records: ${enrollments.length}
Screen Failure Rate: ${screeningFailRate}%

Provide a comprehensive cohort analysis covering:

1. ENROLLMENT PATTERN ANALYSIS
   - Enrollment velocity assessment (fast/slow/on-track)
   - Estimated months to full enrollment at current rate
   - Enrollment gap: target vs. current

2. COMPLETION PREDICTION
   - Predicted trial completion date
   - Confidence level (Low/Medium/High)
   - Key assumptions

3. DROPOUT & SCREEN FAILURE RISK
   - Current screen failure rate assessment
   - Expected dropout rate for this phase/indication
   - High-risk dropout periods in the trial timeline
   - Root cause hypotheses

4. COHORT QUALITY INDICATORS
   - Retention rate estimate
   - Protocol deviation risk
   - Demographic balance considerations

5. RECOMMENDATIONS
   - Top 3 actions to improve enrollment velocity
   - Site activation or expansion suggestions
   - Patient retention strategies

Format with clear tables where quantitative data applies.`,
      },
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
      trial: { id: trial.id, title: trial.title, phase: trial.phase },
      enrollmentSummary: {
        total: enrollments.length,
        target: trial.targetEnrollment,
        current: trial.currentEnrollment,
        statusDistribution: statusDist,
      },
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/protocol-optimizer
 * Body: { protocol_text, enrollment_challenges }
 * Returns protocol amendment suggestions to address enrollment and retention challenges.
 */
router.post('/protocol-optimizer', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { protocol_text, enrollment_challenges } = req.body;

    const errors = [];
    if (!protocol_text || typeof protocol_text !== 'string' || protocol_text.trim().length < 10) {
      errors.push('protocol_text is required and must be at least 10 characters');
    }
    if (!enrollment_challenges || typeof enrollment_challenges !== 'string') {
      errors.push('enrollment_challenges is required');
    }
    if (errors.length > 0) return res.status(400).json({ errors });

    const response = await callOpenRouter([
      {
        role: 'system',
        content:
          'You are an expert clinical trial protocol designer and regulatory affairs specialist. Review clinical trial protocols and recommend specific, actionable amendments to address enrollment challenges while maintaining scientific integrity and regulatory compliance (ICH-GCP, FDA 21 CFR, EMA guidelines).',
      },
      {
        role: 'user',
        content: `Optimize this clinical trial protocol to address the stated enrollment challenges:

PROTOCOL SUMMARY:
${protocol_text}

ENROLLMENT CHALLENGES:
${enrollment_challenges}

Provide a structured protocol optimization report with:

1. ROOT CAUSE ANALYSIS
   - Primary barriers to enrollment based on the protocol text
   - Eligibility criteria that may be overly restrictive
   - Operational or logistical friction points

2. PROPOSED PROTOCOL AMENDMENTS
   For each amendment, provide:
   - Amendment description
   - Rationale
   - Regulatory risk (Low/Medium/High)
   - Expected enrollment impact (+X% estimate)
   - Implementation timeline

3. ELIGIBILITY CRITERIA OPTIMIZATION
   - Specific inclusion/exclusion criteria to consider modifying
   - Evidence basis for each modification
   - Risk-benefit assessment

4. OPERATIONAL IMPROVEMENTS (non-amendment)
   - Site selection and activation strategies
   - Patient identification improvements
   - Screening process streamlining

5. REGULATORY CONSIDERATIONS
   - Amendment classification (substantial vs. non-substantial)
   - Required notifications (IRB, FDA, EMA)
   - Estimated timeline for amendment approval

6. RISK ASSESSMENT
   - Scientific integrity impact
   - Data comparability concerns
   - Overall recommendation (Proceed / Proceed with caution / Do not proceed)

Format with numbered sections, bullet points, and a summary table of amendments.`,
      },
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/site-selection
 * Body: { trial_requirements, available_sites: [] }
 * Returns ranked site list with rationale and readiness scores.
 */
router.post('/site-selection', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { trial_requirements, available_sites } = req.body;

    const errors = [];
    if (!trial_requirements || typeof trial_requirements !== 'object') {
      errors.push('trial_requirements must be an object');
    }
    if (!available_sites || !Array.isArray(available_sites) || available_sites.length === 0) {
      errors.push('available_sites must be a non-empty array');
    }
    if (errors.length > 0) return res.status(400).json({ errors });

    const response = await callOpenRouter([
      {
        role: 'system',
        content:
          'You are an expert clinical trial site selection and feasibility specialist. Evaluate and rank investigator sites based on trial requirements, historical performance, patient population access, infrastructure, and regulatory track record.',
      },
      {
        role: 'user',
        content: `Perform a site selection analysis and ranking for the following clinical trial:

TRIAL REQUIREMENTS:
${JSON.stringify(trial_requirements, null, 2)}

AVAILABLE SITES (${available_sites.length}):
${JSON.stringify(available_sites, null, 2)}

Deliver a comprehensive site selection report:

1. SITE RANKING TABLE
   Create a ranked table with columns:
   | Rank | Site Name | Overall Score (0-100) | Patient Access | Infrastructure | PI Experience | Regulatory Track Record | Recommendation |

2. PER-SITE ANALYSIS (top 5)
   For each top-ranked site:
   - Strengths
   - Weaknesses / Risk factors
   - Estimated patient recruitment rate
   - Time to first patient enrolled
   - Required support / training

3. SITE PORTFOLIO RECOMMENDATION
   - Optimal number of sites for this trial
   - Geographic distribution strategy
   - Primary vs. backup sites

4. FEASIBILITY CONCERNS
   - Sites with disqualifying factors
   - Regulatory red flags
   - Infrastructure gaps

5. ACTIVATION TIMELINE
   - Expected site activation sequence
   - Milestones and dependencies

Rank all ${available_sites.length} sites and provide an overall portfolio recommendation.`,
      },
    ]);

    res.json({
      analysis: response.choices?.[0]?.message?.content || 'No analysis available',
      model: response.model,
      usage: response.usage,
      sitesEvaluated: available_sites.length,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/consent-simplifier
 * Body: { informed_consent_text }
 * Returns plain-language summary, readability score, and patient-friendly Q&A.
 */
router.post('/consent-simplifier', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { informed_consent_text } = req.body;

    if (!informed_consent_text || typeof informed_consent_text !== 'string' || informed_consent_text.trim().length < 50) {
      return res.status(400).json({
        error: 'informed_consent_text is required and must be at least 50 characters',
      });
    }

    const response = await callOpenRouter(
      [
        {
          role: 'system',
          content:
            'You are an expert in health literacy, patient communication, and informed consent for clinical trials. Simplify complex medical and legal consent language into plain English understandable by an 8th-grade reading level patient, while preserving all material information required by 21 CFR Part 50 and ICH E6(R2) GCP guidelines.',
        },
        {
          role: 'user',
          content: `Simplify the following clinical trial informed consent document for patients:

ORIGINAL CONSENT TEXT:
${informed_consent_text}

Provide:

1. READABILITY ASSESSMENT
   - Estimated Flesch-Kincaid Grade Level of original text
   - Key comprehension barriers identified
   - Critical information density

2. PLAIN-LANGUAGE SUMMARY
   Write a clear, patient-friendly summary covering all required elements:
   - What is this study and why is it being done?
   - What will happen to me if I take part?
   - What are the risks?
   - What are the possible benefits?
   - What are my alternatives?
   - Will my information be kept private?
   - What if I want to stop participating?
   - Who do I contact with questions?

3. SIMPLIFIED CONSENT SECTIONS
   Rewrite each major section in plain language (target: 6th-8th grade reading level):
   - Use short sentences (≤20 words average)
   - Replace medical jargon with everyday language
   - Use active voice
   - Define any technical terms that must be retained

4. PATIENT Q&A
   Generate 10 common patient questions with clear answers based on this consent

5. READABILITY METRICS (ESTIMATED)
   | Metric | Original | Simplified |
   |--------|----------|------------|
   | Flesch-Kincaid Grade | ? | ? |
   | Average Sentence Length | ? words | ? words |
   | Average Word Length | ? chars | ? chars |
   | Passive Voice % | ? | ? |

6. REGULATORY COMPLIANCE CHECK
   Confirm all 21 CFR 50.25 required elements are present in the simplified version.

Note: This simplified version is a communication aid and does not replace the legally required consent document.`,
        },
      ],
      4000
    );

    res.json({
      simplifiedConsent: response.choices?.[0]?.message?.content || 'No simplification available',
      model: response.model,
      usage: response.usage,
      originalLength: informed_consent_text.length,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
