const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    feature: 'Retention Risk',
    summary: { highRiskParticipants: 7, missedVisitRisk: 4, travelBurdenCases: 5, outreachPriority: 'Coordinator follow-up' },
    participants: [
      { id: 'PT-1042', trial: 'Oncology Phase II', risk: 'High', driver: 'Two missed labs and long travel distance' },
      { id: 'PT-1098', trial: 'Cardio Outcomes', risk: 'Medium', driver: 'Televisit preference not configured' },
      { id: 'PT-1130', trial: 'Rare Disease Registry', risk: 'High', driver: 'Caregiver availability conflict' },
    ],
    interventions: [
      'Offer travel support before next required on-site assessment.',
      'Switch eligible follow-ups to remote monitoring visits.',
      'Trigger coordinator call when two retention drivers stack.',
    ],
  });
});

module.exports = router;
