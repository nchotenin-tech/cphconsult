/** Source-only parity model for can_access_consult at baseline 56ba8b1.
 * Not wired into an API and not a substitute for database RLS.
 * Dentist identity must be resolved from an authenticated account mapping.
 * Pending invitations add no rights; accepted invitations are materialized in
 * target_dentist_ids by the source respond_consult_invitation transaction.
 */
export interface ReadActor {
  id: string;
  hospital_id: string | null;
  specialties: string[] | null;
  role: string;
}
export interface ReadCase {
  sender_id: string | null;
  target_hospital_id: string | null;
  target_specialties: string[] | null;
  target_dentist_ids: string[] | null;
}
export function canReadLegacyCase(consult: ReadCase | null, actor: ReadActor | null): boolean {
  if (!consult || !actor?.id) return false;
  return actor.role === 'admin'
    || consult.sender_id === actor.id
    || (consult.target_dentist_ids ?? []).includes(actor.id)
    || (actor.hospital_id !== null && actor.hospital_id === consult.target_hospital_id)
    || (actor.specialties ?? []).some(specialty => (consult.target_specialties ?? []).includes(specialty));
}
