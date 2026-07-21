require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
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
app.use(express.json({ limit: '1mb' }));

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
app.use('/api/retention-risk', require('./routes/retentionRisk'));
// Audit-recommended additions (integration API)
app.use('/api/webhooks', require('./routes/webhooks'));

// Custom views — 4 endpoints (2 VIZ: enrollment funnel + criteria heatmap;
// 2 NON-VIZ: patient match summary PDF + eligibility criteria editor CRUD).
// Mounted BEFORE any 404 handler so /api/custom-views/* resolves first.
app.use('/api/custom-views', require('./routes/customViews'));

// Export routes — mount reportRoutes at /api/export so /export/matches becomes /api/export/matches
const exportRoutes = require('./routes/reports');
app.use('/api/export', exportRoutes);
app.use('/api/governed-matching', require('./routes/governedMatching'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
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
