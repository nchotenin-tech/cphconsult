import test from 'node:test';
import assert from 'node:assert/strict';
import { hospitals, dentists, accounts, consults, invitations, expectedReaders } from './fixtures/clinical.mjs';
import { canReadLegacyCase } from '../../dist/policies/legacy-case-read.js';

test('synthetic fixture IDs and relationships are valid; no real accounts are seeded', () => {
  for (const rows of [hospitals, dentists, accounts, consults, invitations]) assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  for (const dentist of dentists) assert.ok(hospitals.some(hospital => hospital.id === dentist.hospital_id));
  for (const account of accounts) {
    assert.ok(account.login.endsWith('@example.invalid'));
    assert.ok(dentists.some(dentist => dentist.id === account.dentist_id));
    assert.equal(account.password, undefined);
  }
  for (const consult of consults) {
    assert.ok(dentists.some(dentist => dentist.id === consult.sender_id));
    assert.ok(hospitals.some(hospital => hospital.id === consult.target_hospital_id));
    assert.ok(consult.target_dentist_ids.every(id => dentists.some(dentist => dentist.id === id)));
    assert.ok(consult.created_at.endsWith('Z'));
    assert.deepEqual(consult.attachments, []);
  }
  for (const invitation of invitations) {
    const consult = consults.find(row => row.id === invitation.consult_id);
    assert.ok(consult);
    assert.equal(consult.target_dentist_ids.includes(invitation.invited_dentist_id), invitation.status === 'accepted');
  }
});
for (const consult of consults) {
  test(`legacy read matrix: ${consult.id} across eight actors`, () => {
    for (const actor of dentists) {
      assert.equal(canReadLegacyCase(consult, actor), expectedReaders.includes(actor.id), actor.id);
    }
    assert.equal(canReadLegacyCase(consult, null), false);
  });
}
test('same specialty across hospitals and destination hospital alone grant legacy read access', () => {
  assert.equal(canReadLegacyCase(consults[0], dentists[2]), true);
  assert.equal(canReadLegacyCase(consults[0], dentists[3]), true);
});
test('pending invitation alone and unrelated actor confer no access', () => {
  assert.equal(canReadLegacyCase(consults[0], dentists[4]), false);
  assert.equal(canReadLegacyCase(consults[0], dentists[6]), false);
});
test('null hospital and empty specialties do not accidentally match; unknown case denied', () => {
  const actor = { id: 'fixture-unrelated', role: 'user', hospital_id: null, specialties: null };
  assert.equal(canReadLegacyCase({ sender_id: null, target_hospital_id: null, target_specialties: null, target_dentist_ids: null }, actor), false);
  assert.equal(canReadLegacyCase(null, dentists[7]), false);
});
test('accepted invitation alone does not authorize arbitrary cases', () => {
  const other = { ...consults[0], target_dentist_ids: ['fixture-d-primary'] };
  assert.equal(canReadLegacyCase(other, dentists[5]), false);
});
