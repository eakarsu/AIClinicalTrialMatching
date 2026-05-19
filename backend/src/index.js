require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { sequelize } = require('./models');

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const trialRoutes = require('./routes/trials');
const matchRoutes = require('./routes/matches');
const siteRoutes = require('./routes/sites');
const enrollmentRoutes = require('./routes/enrollments');
const adverseEventRoutes = require('./routes/adverseEvents');
const protocolRoutes = require('./routes/protocols');
const biomarkerRoutes = require('./routes/biomarkers');
const drugInteractionRoutes = require('./routes/drugInteractions');
const regulatoryRoutes = require('./routes/regulatory');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const eligibilityRoutes = require('./routes/eligibility');
const outcomeRoutes = require('./routes/outcomes');
const aiRoutes = require('./routes/ai');
const aiNewRoutes = require('./routes/aiNew');
const aiAdvancedRoutes = require('./routes/aiAdvanced');
const complianceRoutes = require('./routes/compliance');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

// Security: helmet (with relaxed CSP for API)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS from env; fall back to localhost during dev
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? true : corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/trials', trialRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/adverse-events', adverseEventRoutes);
app.use('/api/protocols', protocolRoutes);
app.use('/api/biomarkers', biomarkerRoutes);
app.use('/api/drug-interactions', drugInteractionRoutes);
app.use('/api/regulatory', regulatoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/eligibility', eligibilityRoutes);
app.use('/api/outcomes', outcomeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai', aiNewRoutes);
app.use('/api/ai', aiAdvancedRoutes);
app.use('/api/compliance', complianceRoutes);
// Audit-recommended additions (integration API)
app.use('/api/webhooks', require('./routes/webhooks'));

// Custom views — 4 endpoints (2 VIZ: enrollment funnel + criteria heatmap;
// 2 NON-VIZ: patient match summary PDF + eligibility criteria editor CRUD).
// Mounted BEFORE any 404 handler so /api/custom-views/* resolves first.
app.use('/api/custom-views', require('./routes/customViews'));

// Export routes — mount reportRoutes at /api/export so /export/matches becomes /api/export/matches
const exportRoutes = require('./routes/reports');
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synced.');
    
app.use('/api/outcome-predictor', require('./routes/outcomePredictor')); // apply pass 6 — audit custom suggestion

app.use('/api/site-network-optimizer', require('./routes/siteNetworkOptimizer')); // apply pass 6 — audit custom suggestion

app.use('/api/regulatory-agent', require('./routes/regulatoryAgent')); // apply pass 6 — audit custom suggestion

app.use('/api/trial-integrations', require('./routes/trialPlatformIntegrations')); // apply pass 6 — audit custom suggestion

app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();


// === Batch 01 Gaps & Frontend Mounts ===
app.use('/api/gap-no-ai-emr-to-protocol-matcher-only-manual-screenin', require('./routes/gap_no_ai_emr_to_protocol_matcher_only_manual_screenin'));
app.use('/api/gap-no-ai-patient-friendly-consent-form-generator', require('./routes/gap_no_ai_patient_friendly_consent_form_generator'));
app.use('/api/gap-no-ai-investigator-brochure-summarization', require('./routes/gap_no_ai_investigator_brochure_summarization'));
app.use('/api/gap-no-ai-digital-twin-synthetic-control-arm', require('./routes/gap_no_ai_digital_twin_synthetic_control_arm'));
app.use('/api/gap-no-direct-edc-ctms-ehr-api-client-medidata-veeva-e', require('./routes/gap_no_direct_edc_ctms_ehr_api_client_medidata_veeva_e'));
app.use('/api/gap-no-e-consent-module-with-audit-trail', require('./routes/gap_no_e_consent_module_with_audit_trail'));
app.use('/api/gap-no-remote-monitoring-televisit-module', require('./routes/gap_no_remote_monitoring_televisit_module'));
app.use('/api/gap-no-randomization-trial-supply-management-rtsm', require('./routes/gap_no_randomization_trial_supply_management_rtsm'));
app.use('/api/gap-no-patient-engagement-portal-with-rewards', require('./routes/gap_no_patient_engagement_portal_with_rewards'));
app.use('/api/gap-notification-routes-exist-but-no-sms-email-deliver', require('./routes/gap_notification_routes_exist_but_no_sms_email_deliver'));
