import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { checkPreparation, fields } from '../../tools/check-migration-preparation.mjs';

const complete = () => ({ formatVersion: 1, ...Object.fromEntries(Object.entries(fields).map(([key,type]) => [key,type === 'boolean' ? true : 1])) });
test('blank preparation template reports all unknowns, never migration readiness', () => {
  const result = checkPreparation(JSON.parse(readFileSync(new URL('../../docs/migration-preparation.template.json',import.meta.url))));
  assert.equal(result.status,'incomplete'); assert.equal(result.missing.length,Object.keys(fields).length); assert.equal(result.migrationAuthorized,false);
});
test('false evidence remains pending; zeros are valid for counts but not capacity', () => {
  const input = complete(); input.restoreDrillPassed = false; input.sourceFileCount = 0;
  assert.deepEqual(checkPreparation(input).pending,['restoreDrillPassed']);
  input.targetRamGiB = 0; assert.deepEqual(checkPreparation(input).invalid,['targetRamGiB']);
});
test('rejects coercions, unsafe counts and unknown properties without disclosing values', () => {
  const input = complete(); input.sourceTableCount = '26'; input.sourceDatabaseBytes = Number.MAX_SAFE_INTEGER + 1; input.authMappingReviewed = 'true';
  assert.equal(checkPreparation(input).invalid.length,3);
  assert.throws(() => checkPreparation({...complete(), password:'DO_NOT_ECHO'}), /^Error: INVALID_FORMAT$/);
  assert.throws(() => checkPreparation([]), /^Error: INVALID_FORMAT$/);
});
test('filled checklist is explicitly unverified and cannot authorize migration', () => {
  const result = checkPreparation(complete());
  assert.equal(result.status,'checklist_complete_unverified'); assert.equal(result.migrationAuthorized,false);
});
