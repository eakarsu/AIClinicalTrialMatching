/*
 * EHR adapter — pulls candidate patients from an electronic health record via
 * FHIR R4 and maps them into the app's Patient shape so the trial-matching
 * engine can score them.
 *
 * Two modes (per Integration.mode):
 *   - 'sandbox' (default): returns a synthetic FHIR Bundle so sync runs without
 *      any vendor credentials. Same mapping path as live.
 *   - 'live': fetches from the connection's FHIR base URL using the bearer token
 *      in Integration.config.accessToken. Drop in real Epic/Cerner creds to use.
 *
 * The mapping (mapFhirPatient) is identical for both modes, so a sandbox sync
 * exercises the exact code a live sync would.
 */

// ---------------------------------------------------------------------------
// Synthetic FHIR data (oncology-leaning, to match the trial-matching domain)
// ---------------------------------------------------------------------------
function syntheticBundle() {
  const mk = (id, family, given, gender, birthDate, mrn, diagnosis, stage, biomarkers, meds, history) => ({
    resource: {
      resourceType: 'Patient',
      id,
      identifier: [{ system: 'urn:oid:mrn', value: mrn }],
      name: [{ family, given: [given] }],
      gender,
      birthDate,
      telecom: [
        { system: 'email', value: `${given}.${family}@example-ehr.org`.toLowerCase() },
        { system: 'phone', value: '555-01' + mrn.slice(-2) },
      ],
      // Clinical context flattened onto the bundle entry for the mapper.
      _clinical: { diagnosis, stage, biomarkers, meds, history },
    },
  });

  return {
    resourceType: 'Bundle',
    type: 'searchset',
    entry: [
      mk('p-1001', 'Nguyen', 'Mai', 'female', '1968-04-12', 'MRN100231',
        'Non-small cell lung cancer', 'IIIB', ['EGFR exon 19 deletion', 'PD-L1 45%'],
        ['Osimertinib'], 'Former smoker; hypertension'),
      mk('p-1002', 'Okafor', 'David', 'male', '1955-09-30', 'MRN100884',
        'Metastatic colorectal cancer', 'IV', ['KRAS G12C', 'MSI-stable'],
        ['FOLFOX', 'Bevacizumab'], 'Type 2 diabetes'),
      mk('p-1003', 'Rossi', 'Elena', 'female', '1979-01-22', 'MRN101145',
        'HER2-positive breast cancer', 'II', ['HER2 IHC 3+', 'ER-positive'],
        ['Trastuzumab', 'Letrozole'], 'No significant comorbidities'),
      mk('p-1004', 'Hassan', 'Omar', 'male', '1962-11-05', 'MRN101990',
        'Multiple myeloma', 'III', ['del(17p)', 'high-risk cytogenetics'],
        ['Lenalidomide', 'Dexamethasone'], 'Chronic kidney disease stage 2'),
      mk('p-1005', 'Park', 'Soojin', 'female', '1985-07-19', 'MRN102457',
        'Melanoma', 'IIIC', ['BRAF V600E'],
        ['Dabrafenib', 'Trametinib'], 'No prior therapy'),
    ],
  };
}

// ---------------------------------------------------------------------------
// FHIR -> Patient mapping
// ---------------------------------------------------------------------------
function fhirName(resource, part) {
  const n = (resource.name && resource.name[0]) || {};
  if (part === 'family') return n.family || 'Unknown';
  return (n.given && n.given[0]) || 'Unknown';
}
function fhirTelecom(resource, system) {
  const t = (resource.telecom || []).find((x) => x.system === system);
  return t ? t.value : null;
}
function fhirMrn(resource) {
  const id = (resource.identifier || []).find((x) => /mrn/i.test(x.system || '')) || (resource.identifier || [])[0];
  return id ? id.value : resource.id;
}

/** Map one FHIR Patient (with optional _clinical context) to the Patient model shape. */
function mapFhirPatient(resource, vendorLabel) {
  const c = resource._clinical || {};
  return {
    firstName: fhirName(resource, 'given'),
    lastName: fhirName(resource, 'family'),
    dateOfBirth: resource.birthDate || null,
    gender: resource.gender || null,
    email: fhirTelecom(resource, 'email'),
    phone: fhirTelecom(resource, 'phone'),
    diagnosis: c.diagnosis || null,
    stage: c.stage || null,
    biomarkers: Array.isArray(c.biomarkers) ? c.biomarkers.join(', ') : (c.biomarkers || null),
    currentMedications: Array.isArray(c.meds) ? c.meds.join(', ') : (c.meds || null),
    medicalHistory: c.history || null,
    mrn: fhirMrn(resource),
    source: `${vendorLabel} (EHR)`,
    status: 'active',
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------
async function fetchLiveBundle(integration) {
  const base = (integration.baseUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('Live EHR sync requires a baseUrl on the integration.');
  const token = integration.config && integration.config.accessToken;
  const res = await fetch(`${base}/Patient?_count=50`, {
    headers: {
      Accept: 'application/fhir+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EHR FHIR ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Pull patients from the EHR and return mapped Patient rows (not yet persisted).
 * `vendorLabel` is a human label like "Epic" for provenance.
 */
async function pullPatients(integration) {
  const vendorLabel =
    (integration.vendor || 'EHR').charAt(0).toUpperCase() + (integration.vendor || 'EHR').slice(1);
  const bundle =
    integration.mode === 'live' ? await fetchLiveBundle(integration) : syntheticBundle();
  const entries = (bundle && bundle.entry) || [];
  return entries
    .filter((e) => e.resource && e.resource.resourceType === 'Patient')
    .map((e) => mapFhirPatient(e.resource, vendorLabel));
}

module.exports = { pullPatients, mapFhirPatient, syntheticBundle };
