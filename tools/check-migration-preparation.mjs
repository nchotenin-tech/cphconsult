import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const fields = {
  deployedRevisionConfirmed: 'boolean', liveSchemaCatalogAvailable: 'boolean',
  liveTableMappingReviewed: 'boolean', sourceTableCount: 'count', sourceDatabaseBytes: 'count',
  storageInventoryAvailable: 'boolean', sourceFileCount: 'count', sourceFileBytes: 'count',
  authMappingReviewed: 'boolean', activationMethodApproved: 'boolean',
  targetOsConfirmed: 'boolean', targetCpuCores: 'positive', targetRamGiB: 'positive',
  targetFreeDiskGiB: 'positive', backupDestinationApproved: 'boolean',
  restoreDrillPassed: 'boolean', allowedDowntimeMinutes: 'count',
  syntheticFullImportPassed: 'boolean', realRehearsalReconciled: 'boolean',
  clinicalAcceptancePassed: 'boolean', postWriteRollbackReviewed: 'boolean',
};

export function checkPreparation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_FORMAT');
  const expected = ['formatVersion', ...Object.keys(fields)];
  // Never echo untrusted keys/values: a mistaken password field must not reach logs.
  if (Object.keys(input).some(key => !expected.includes(key)) || input.formatVersion !== 1) throw new Error('INVALID_FORMAT');
  const missing = [], pending = [], invalid = [];
  for (const [key, type] of Object.entries(fields)) {
    const value = input[key];
    if (value === null || value === undefined) { missing.push(key); continue; }
    if (type === 'boolean') {
      if (typeof value !== 'boolean') invalid.push(key);
      else if (!value) pending.push(key);
    } else if (!Number.isSafeInteger(value) || value < (type === 'positive' ? 1 : 0)) invalid.push(key);
  }
  return { status: invalid.length ? 'invalid' : missing.length || pending.length ? 'incomplete' : 'checklist_complete_unverified', missing, pending, invalid, migrationAuthorized: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('INVALID_FORMAT');
    const result = checkPreparation(JSON.parse(readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'invalid' ? 2 : result.status === 'incomplete' ? 1 : 0;
  } catch {
    console.error('preparation_check_failed: unreadable file or invalid format; input values omitted');
    process.exitCode = 2;
  }
}
