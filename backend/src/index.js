require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
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

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

app.use(cors());
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synced.');
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
