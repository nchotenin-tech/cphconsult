import { useEffect, useState } from 'react';

type Case = { id: string; patient_name: string; patient_age: number; status: string; post_consult_option: string | null; refer_status: string | null; shared_care_status: string | null; created_at: string; consult_details?: string; patient_gender?: string; patient_scheme?: string; sender_name?: string | null; target_hospital_name?: string | null; primary_consultant_name?: string | null };
const labels: Record<string, string> = { pending: 'รอรับปรึกษา', active: 'กำลังปรึกษา', completed: 'จบการปรึกษา', refer: 'ส่งต่อ', shared_care: 'ดูแลร่วมกัน', planning: 'วางแผนส่งต่อ', referred_back: 'ส่งกลับแล้ว', in_progress: 'กำลังดำเนินการ' };
const label = (value: string | null) => value ? labels[value] ?? value : '—';

export function Consults({ onExpired }: { onExpired: () => void }) {
  const [cursors, setCursors] = useState(['']);
  const after = cursors[cursors.length - 1];
  const setAfter = (value: string) => setCursors([value]);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState('all');
  const [workflow, setWorkflow] = useState('all');
  const [progress, setProgress] = useState('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [reload, setReload] = useState(0);
  const [rows, setRows] = useState<Case[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    document.title = selected ? 'CPH Consult · รายละเอียดเคส' : 'CPH Consult · รายการเคส';
    return () => { document.title = 'CPH Consult · เข้าสู่ระบบ'; };
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setDetail(null); setRows([]); setNext(null);
    const path = selected ? '/' + encodeURIComponent(selected) : '?limit=' + pageSize + '&after=' + encodeURIComponent(after) + '&status=' + encodeURIComponent(status) + '&workflow=' + workflow + '&progress=' + progress + '&q=' + encodeURIComponent(search);
    void fetch('/api/v1/consults' + path, { credentials: 'same-origin', signal: controller.signal }).then(async response => {
      if (controller.signal.aborted) return;
      if (response.status === 401) { onExpired(); return; }
      if (!response.ok) throw new Error(response.status === 404 ? 'ไม่พบเคสหรือคุณไม่มีสิทธิ์เข้าถึง' : response.status === 403 ? 'บัญชีนี้ยังไม่พร้อมใช้งานคลินิก กรุณาตรวจสอบสถานะบัญชี' : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (selected) setDetail(data.item); else { setRows(data.items); setNext(data.nextCursor); }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'เชื่อมต่อไม่ได้'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [after, pageSize, status, workflow, progress, search, selected, reload, onExpired]);
  return <section className="clinical" aria-label="เคสปรึกษา">
    <div className="clinical-heading"><div><p className="eyebrow">CPH CONSULT · ระบบทดสอบ</p><h1>{selected ? 'รายละเอียดเคส' : 'รายการเคสปรึกษา'}</h1></div>
      <button className="secondary" onClick={() => setReload(value => value + 1)} disabled={loading}>โหลดใหม่</button></div>
    <p className="notice">แสดงเฉพาะเคสที่บัญชีของคุณมีสิทธิ์อ่าน · ขณะนี้เปิดดูข้อมูลได้เท่านั้น</p>
    {!selected && <form role="search" onSubmit={event => { event.preventDefault(); setSearch(searchDraft.trim()); setAfter(''); setReload(value => value + 1); }}>
      <label htmlFor="case-search">ค้นหาชื่อผู้ป่วยหรือรหัสเคส</label>
      <input id="case-search" type="search" maxLength={200} autoComplete="off" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="เช่น ผู้ป่วยจำลอง 1 หรือ fixture-case-pending"/>
      <div className="case-search-actions"><button className="secondary" type="submit">ค้นหา</button><button className="secondary" type="button" onClick={() => { setSearchDraft(''); setSearch(''); setAfter(''); }}>ล้างคำค้น</button></div>
      {search && <p className="notice" role="status">ผลค้นหาสำหรับ “{search}” ตามตัวกรองที่เลือก</p>}
    </form>}
    {!selected && <div className="case-filters" role="group" aria-label="กรองสถานะการปรึกษา">{['all', 'pending', 'active', 'completed'].map(value => <button key={value} className="secondary" aria-pressed={status === value} onClick={() => { setStatus(value); setAfter(''); }}>{value === 'all' ? 'ทั้งหมด' : label(value)}</button>)}</div>}
    {!selected && <p className="notice">สถานะนี้แสดงการปรึกษา เคสที่จบการปรึกษาอาจยังอยู่ระหว่างส่งต่อหรือดูแลร่วมกัน</p>}
    {!selected && <div className="case-filters" role="group" aria-label="กรองการดูแลต่อเนื่อง">{[['all','ทุกประเภท'],['refer','ส่งต่อ'],['shared_care','ดูแลร่วมกัน']].map(([value,text]) => <button key={value} className="secondary" aria-pressed={workflow === value} onClick={() => { setWorkflow(value); setProgress('all'); setAfter(''); }}>{text}</button>)}</div>}
    {!selected && workflow !== 'all' && <div className="case-filters" role="group" aria-label="สถานะการดูแลต่อเนื่อง">{[['all','ทุกสถานะการดูแล'],['active','ยังดำเนินการ'],['finished','เสร็จสิ้น'],['cancelled','ยกเลิก']].map(([value,text]) => <button key={value} className="secondary" aria-pressed={progress === value} onClick={() => { setProgress(value); setAfter(''); }}>{text}</button>)}</div>}
    {selected && <button className="secondary" onClick={() => setSelected(null)}>← กลับรายการ</button>}
    {!selected && <div className="page-settings"><label htmlFor="page-size">จำนวนเคสต่อหน้า</label><select id="page-size" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setAfter(''); }}>{[5,20,50].map(size => <option key={size} value={size}>{size}</option>)}</select><button className="secondary" onClick={() => { setSearchDraft(''); setSearch(''); setStatus('all'); setWorkflow('all'); setProgress('all'); setAfter(''); }}>ล้างการค้นหาและตัวกรองทั้งหมด</button></div>}
    {loading ? <p role="status">กำลังโหลดข้อมูล…</p> : error ? <p role="alert" className="error">{error}</p> : detail ? <article className="case-detail"><h2>{detail.patient_name}</h2>
      <dl><dt>รหัสเคส</dt><dd>{detail.id}</dd><dt>อายุ / เพศ</dt><dd>{detail.patient_age} ปี / {detail.patient_gender === 'male' ? 'ชาย' : detail.patient_gender === 'female' ? 'หญิง' : detail.patient_gender}</dd>
        <dt>ทันตแพทย์ผู้ส่ง</dt><dd>{detail.sender_name ?? 'ไม่ระบุ'}</dd><dt>โรงพยาบาลปลายทาง</dt><dd>{detail.target_hospital_name ?? 'ไม่ระบุ'}</dd><dt>ผู้รับปรึกษาหลัก</dt><dd>{detail.primary_consultant_name ?? 'ยังไม่ระบุ'}</dd>
        <dt>สิทธิการรักษา</dt><dd>{detail.patient_scheme}</dd><dt>สถานะ</dt><dd>{label(detail.status)}</dd><dt>การดูแลต่อเนื่อง</dt><dd>{label(detail.post_consult_option)} · {label(detail.refer_status ?? detail.shared_care_status)}</dd>
        <dt>รายละเอียดการปรึกษา</dt><dd className="case-text">{detail.consult_details}</dd><dt>วันที่สร้าง</dt><dd>{new Date(detail.created_at).toLocaleString('th-TH')}</dd></dl>
      <p className="notice">ไฟล์แนบ แชท และการแก้ไขเคสยังไม่เปิดใช้งาน</p></article> : <>
      {rows.length === 0 ? <p className="empty">{search || status !== 'all' || workflow !== 'all' ? 'ไม่พบเคสตามคำค้นและตัวกรองที่เลือก ลองล้างการค้นหาและตัวกรองทั้งหมด' : after ? 'ไม่มีเคสในหน้านี้แล้ว ลองกลับหน้าแรก' : 'ยังไม่มีเคสที่แสดงได้สำหรับบัญชีนี้'}</p> : <div className="table-scroll"><table><caption className="sr-only">เคสที่คุณมีสิทธิ์อ่าน</caption><thead><tr><th>ผู้ป่วย</th><th>สถานะ</th><th>การดูแลต่อ</th><th>วันที่สร้าง</th><th>รายละเอียด</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.patient_name}<small>{row.patient_age} ปี</small></td><td>{label(row.status)}</td><td>{label(row.post_consult_option)}</td><td>{new Date(row.created_at).toLocaleDateString('th-TH')}</td><td><button className="secondary" onClick={() => setSelected(row.id)} aria-label={'เปิดเคส ' + row.patient_name}>เปิดเคส</button></td></tr>)}</tbody></table></div>}
      <nav className="pagination" aria-label="หน้ารายการเคส"><span role="status">หน้า {cursors.length} · แสดง {rows.length} เคสในหน้านี้</span>{after && <><button className="secondary" onClick={() => setAfter('')}>กลับหน้าแรก</button><button className="secondary" onClick={() => setCursors(values => values.slice(0,-1))}>← หน้าก่อนหน้า</button></>}{next && <button className="secondary" onClick={() => setCursors(values => [...values,next])}>หน้าถัดไป →</button>}</nav>
    </>}
  </section>;
}

