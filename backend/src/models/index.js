const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'clinical_trial_matching',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

// User Model
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'researcher' },
});

// Patient Model
const Patient = sequelize.define('Patient', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  dateOfBirth: { type: DataTypes.DATEONLY },
  gender: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  diagnosis: { type: DataTypes.STRING },
  stage: { type: DataTypes.STRING },
  biomarkers: { type: DataTypes.TEXT },
  medicalHistory: { type: DataTypes.TEXT },
  currentMedications: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
});

// Clinical Trial Model
const Trial = sequelize.define('Trial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trialId: { type: DataTypes.STRING, unique: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  phase: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'recruiting' },
  sponsor: { type: DataTypes.STRING },
  therapeuticArea: { type: DataTypes.STRING },
  indication: { type: DataTypes.STRING },
  startDate: { type: DataTypes.DATEONLY },
  endDate: { type: DataTypes.DATEONLY },
  targetEnrollment: { type: DataTypes.INTEGER },
  currentEnrollment: { type: DataTypes.INTEGER, defaultValue: 0 },
  eligibilityCriteria: { type: DataTypes.TEXT },
  primaryEndpoint: { type: DataTypes.STRING },
  secondaryEndpoints: { type: DataTypes.TEXT },
});

// Match Model
const Match = sequelize.define('Match', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  patientId: { type: DataTypes.INTEGER, allowNull: false },
  trialId: { type: DataTypes.INTEGER, allowNull: false },
  matchScore: { type: DataTypes.FLOAT },
  matchReason: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  aiAnalysis: { type: DataTypes.TEXT },
});

// Site Model
const Site = sequelize.define('Site', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  state: { type: DataTypes.STRING },
  country: { type: DataTypes.STRING },
  zipCode: { type: DataTypes.STRING },
  principalInvestigator: { type: DataTypes.STRING },
  contactEmail: { type: DataTypes.STRING },
  contactPhone: { type: DataTypes.STRING },
  capacity: { type: DataTypes.INTEGER },
  activeTrials: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
});

// Enrollment Model
const Enrollment = sequelize.define('Enrollment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  patientId: { type: DataTypes.INTEGER, allowNull: false },
  trialId: { type: DataTypes.INTEGER, allowNull: false },
  siteId: { type: DataTypes.INTEGER },
  enrollmentDate: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING, defaultValue: 'screening' },
  consentDate: { type: DataTypes.DATEONLY },
  screeningResult: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT },
});

// Adverse Event Model
const AdverseEvent = sequelize.define('AdverseEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  patientId: { type: DataTypes.INTEGER, allowNull: false },
  trialId: { type: DataTypes.INTEGER, allowNull: false },
  eventType: { type: DataTypes.STRING, allowNull: false },
  severity: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  onsetDate: { type: DataTypes.DATEONLY },
  resolutionDate: { type: DataTypes.DATEONLY },
  outcome: { type: DataTypes.STRING },
  relatedness: { type: DataTypes.STRING },
  actionTaken: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'open' },
});

// Protocol Model
const Protocol = sequelize.define('Protocol', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trialId: { type: DataTypes.INTEGER },
  protocolNumber: { type: DataTypes.STRING, unique: true },
  title: { type: DataTypes.STRING, allowNull: false },
  version: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'draft' },
  approvalDate: { type: DataTypes.DATEONLY },
  amendmentNumber: { type: DataTypes.INTEGER, defaultValue: 0 },
  summary: { type: DataTypes.TEXT },
  objectives: { type: DataTypes.TEXT },
  studyDesign: { type: DataTypes.TEXT },
  dosageRegimen: { type: DataTypes.TEXT },
});

// Biomarker Model
const Biomarker = sequelize.define('Biomarker', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  patientId: { type: DataTypes.INTEGER },
  name: { type: DataTypes.STRING, allowNull: false },
  value: { type: DataTypes.STRING },
  unit: { type: DataTypes.STRING },
  testDate: { type: DataTypes.DATEONLY },
  normalRange: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING },
  significance: { type: DataTypes.TEXT },
});

// Drug Interaction Model
const DrugInteraction = sequelize.define('DrugInteraction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  drugA: { type: DataTypes.STRING, allowNull: false },
  drugB: { type: DataTypes.STRING, allowNull: false },
  interactionType: { type: DataTypes.STRING },
  severity: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  recommendation: { type: DataTypes.TEXT },
  evidenceLevel: { type: DataTypes.STRING },
  mechanism: { type: DataTypes.TEXT },
});

// Regulatory Model
const Regulatory = sequelize.define('Regulatory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trialId: { type: DataTypes.INTEGER },
  documentType: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  submissionDate: { type: DataTypes.DATEONLY },
  approvalDate: { type: DataTypes.DATEONLY },
  expiryDate: { type: DataTypes.DATEONLY },
  authority: { type: DataTypes.STRING },
  referenceNumber: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT },
});

// Notification Model
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT },
  type: { type: DataTypes.STRING },
  priority: { type: DataTypes.STRING, defaultValue: 'normal' },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  actionUrl: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING },
});

// Report Model
const Report = sequelize.define('Report', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  parameters: { type: DataTypes.TEXT },
  generatedBy: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'generated' },
  data: { type: DataTypes.TEXT },
  format: { type: DataTypes.STRING, defaultValue: 'pdf' },
});

// Eligibility Criteria Model
const Eligibility = sequelize.define('Eligibility', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trialId: { type: DataTypes.INTEGER },
  criteriaType: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT, allowNull: false },
  isInclusion: { type: DataTypes.BOOLEAN, defaultValue: true },
  priority: { type: DataTypes.STRING, defaultValue: 'required' },
  ageMin: { type: DataTypes.INTEGER },
  ageMax: { type: DataTypes.INTEGER },
  gender: { type: DataTypes.STRING },
  biomarkerRequirement: { type: DataTypes.TEXT },
});

// Outcome Model
const Outcome = sequelize.define('Outcome', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trialId: { type: DataTypes.INTEGER },
  patientId: { type: DataTypes.INTEGER },
  outcomeType: { type: DataTypes.STRING },
  endpoint: { type: DataTypes.STRING },
  value: { type: DataTypes.STRING },
  unit: { type: DataTypes.STRING },
  assessmentDate: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING },
  prediction: { type: DataTypes.TEXT },
  confidence: { type: DataTypes.FLOAT },
  notes: { type: DataTypes.TEXT },
});

// Associations
Patient.hasMany(Match, { foreignKey: 'patientId' });
Trial.hasMany(Match, { foreignKey: 'trialId' });
Match.belongsTo(Patient, { foreignKey: 'patientId' });
Match.belongsTo(Trial, { foreignKey: 'trialId' });

Patient.hasMany(Enrollment, { foreignKey: 'patientId' });
Trial.hasMany(Enrollment, { foreignKey: 'trialId' });
Enrollment.belongsTo(Patient, { foreignKey: 'patientId' });
Enrollment.belongsTo(Trial, { foreignKey: 'trialId' });

Patient.hasMany(AdverseEvent, { foreignKey: 'patientId' });
Trial.hasMany(AdverseEvent, { foreignKey: 'trialId' });

Patient.hasMany(Biomarker, { foreignKey: 'patientId' });
Trial.hasMany(Protocol, { foreignKey: 'trialId' });
Trial.hasMany(Regulatory, { foreignKey: 'trialId' });
Trial.hasMany(Eligibility, { foreignKey: 'trialId' });
Trial.hasMany(Outcome, { foreignKey: 'trialId' });
Patient.hasMany(Outcome, { foreignKey: 'patientId' });

module.exports = {
  sequelize,
  User,
  Patient,
  Trial,
  Match,
  Site,
  Enrollment,
  AdverseEvent,
  Protocol,
  Biomarker,
  DrugInteraction,
  Regulatory,
  Notification,
  Report,
  Eligibility,
  Outcome,
};
