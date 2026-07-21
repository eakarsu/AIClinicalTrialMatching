const test=require('node:test'),assert=require('node:assert/strict');const {eligibility,validConsent,requireRole,ClinicalError}=require('../services/clinicalPolicy');
test('eligibility remains a review artifact',()=>{const x=eligibility([{criterionId:'age',result:'met',evidenceRef:'FHIR/Patient/1'},{criterionId:'lab',result:'unknown',evidenceRef:'Observation/2'}]);assert.equal(x.score,.5);assert.equal(x.state,'needs_information');});
test('failed criteria still require professional review',()=>assert.equal(eligibility([{criterionId:'x',result:'not_met',evidenceRef:'e1'}]).state,'needs_professional_review'));
test('consent must be active and unexpired',()=>{assert.equal(validConsent({status:'active',expiresAt:'2999-01-01'}),true);assert.equal(validConsent({status:'withdrawn',expiresAt:'2999-01-01'}),false);});
test('non-clinical role cannot decide',()=>assert.throws(()=>requireRole('coordinator',['clinical_reviewer']),ClinicalError));
