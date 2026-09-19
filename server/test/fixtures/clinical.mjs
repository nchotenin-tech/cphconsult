// Synthetic data only. Not an import seed and not linked to real login accounts.
export const hospitals = [
  { id: 'fixture-h-origin', name: 'โรงพยาบาลจำลองต้นทาง', level: 'community' },
  { id: 'fixture-h-destination', name: 'โรงพยาบาลจำลองปลายทาง', level: 'general' },
  { id: 'fixture-h-other', name: 'โรงพยาบาลจำลองอื่น', level: 'community' },
];
const dentist = (id, hospital_id, specialties = [], role = 'user') => ({ id: `fixture-d-${id}`, name: `ทันตแพทย์จำลอง ${id}`, hospital_id: `fixture-h-${hospital_id}`, specialties, role });
export const dentists = [
  dentist('sender', 'origin', ['general']),
  dentist('primary', 'destination', ['oral-surgery']),
  dentist('destination-other-specialty', 'destination', ['general']),
  dentist('same-specialty-other-hospital', 'other', ['oral-surgery']),
  dentist('pending-invitee', 'other', ['general']),
  dentist('accepted-invitee', 'other', ['general']),
  dentist('unrelated', 'other', ['general']),
  dentist('admin', 'other', [], 'admin'),
];
export const accounts = dentists.map((dentist, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  dentist_id: dentist.id, login: `${dentist.id}@example.invalid`, status: 'active',
}));
const states = [
  ['pending', 'pending', null, null, null],
  ['active', 'active', null, null, null],
  ['closed', 'completed', null, null, null],
  ['refer-planning', 'completed', 'refer', 'planning', null],
  ['refer-finished', 'completed', 'refer', 'referred_back', null],
  ['shared-care', 'completed', 'shared_care', null, 'in_progress'],
];
export const consults = states.map(([key, status, option, referStatus, sharedStatus], index) => ({
  id: `fixture-case-${key}`, patient_name: `ผู้ป่วยจำลอง ${index + 1}`, patient_age: 30 + index,
  patient_gender: 'male', patient_scheme: 'fixture-only', consult_details: 'ข้อมูลจำลองสำหรับทดสอบสิทธิ์เท่านั้น',
  sender_id: 'fixture-d-sender', target_hospital_id: 'fixture-h-destination',
  target_specialties: ['oral-surgery'], target_dentist_ids: ['fixture-d-primary', 'fixture-d-accepted-invitee'],
  primary_consultant_id: key === 'pending' ? null : 'fixture-d-primary',
  status, post_consult_option: option, refer_status: referStatus, shared_care_status: sharedStatus,
  refer_data: {}, shared_care_data: key === 'shared-care' ? { steps: [{ id: 'fixture-step-1', number: 1, status: 'waiting', detail: 'แผนจำลอง' }] } : {},
  attachments: [], created_at: `2026-09-${String(10 + index).padStart(2, '0')}T02:00:00.000Z`,
}));
export const invitations = consults.flatMap(consult => [
  { id: `${consult.id}-pending-invite`, consult_id: consult.id, invited_dentist_id: 'fixture-d-pending-invitee', status: 'pending' },
  { id: `${consult.id}-accepted-invite`, consult_id: consult.id, invited_dentist_id: 'fixture-d-accepted-invitee', status: 'accepted' },
]);

// Explicit oracle from the baseline SQL, independent of the implementation.
export const expectedReaders = [
  'fixture-d-sender', 'fixture-d-primary', 'fixture-d-destination-other-specialty',
  'fixture-d-same-specialty-other-hospital', 'fixture-d-accepted-invitee', 'fixture-d-admin',
];
