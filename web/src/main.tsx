import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Consults } from './Consults';
import { createRoot } from 'react-dom/client';
import './style.css';

type Session = { user: { id: string; login: string; mustChangePassword: boolean }; csrfToken: string };
function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const expired = useCallback(() => { setSession(null); setPassword(''); setError('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง'); }, []);
  useEffect(() => {
    let live = true;
    fetch('/api/v1/auth/me', { credentials: 'same-origin' }).then(async response => {
      if (!live) return;
      if (response.ok) { const value = await response.json(); if (live) setSession(value); }
      else if (response.status !== 401) setError('ยังเชื่อมต่อระบบบัญชีไม่ได้ โปรดลองใหม่ภายหลัง');
    }).catch(() => { if (live) setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจว่าเปิด backend อยู่'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      if (!response.ok) {
        setError(response.status === 401 ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่เปิดใช้งาน' : response.status === 429 ? 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอหนึ่งนาที' : 'เข้าสู่ระบบไม่ได้ กรุณาลองใหม่');
        return;
      }
      setSession(await response.json()); setPassword('');
    } catch { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    if (!session) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': session.csrfToken } });
      if (response.ok || response.status === 401) { setSession(null); setPassword(''); }
      else setError('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่');
    } catch { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ยังยืนยันการออกจากระบบไม่ได้'); }
    finally { setBusy(false); }
  }
  if (session && !session.user.mustChangePassword) return <main className="workspace"><header className="workspace-header"><strong>CPH Consult</strong><span>{session.user.login}</span><button className="secondary" disabled={busy} onClick={signOut}>ออกจากระบบ</button></header>{error && <p role="alert" className="error">{error}</p>}<Consults onExpired={expired}/><footer>สภาพแวดล้อมทดสอบ · ใช้ข้อมูลจำลองเท่านั้น</footer></main>;
  return <main className="layout">
    <section className="intro"><div className="brand"><span className="mark" aria-hidden="true">+</span> CPH Consult</div>
      <div className="intro-copy"><p className="eyebrow">เครือข่ายปรึกษาทางทันตกรรม</p><h1>เชื่อมต่อทีมดูแล<br/>เพื่อการรักษาที่ต่อเนื่อง</h1><p>พื้นที่ทำงานร่วมกันสำหรับการปรึกษา<br/>ส่งต่อ และติดตามการดูแลผู้ป่วย</p></div>
      <div className="intro-footer"><span className="dot"/> ระบบใหม่ · สภาพแวดล้อมทดสอบ</div>
    </section>
    <section className="panel" aria-label="บัญชีผู้ใช้"><div className="card">
      <span className="badge">สำหรับการทดสอบ</span>
      {loading ? <p role="status">กำลังตรวจสอบการเข้าสู่ระบบ…</p> : session ? <>
        <h2>เข้าสู่ระบบแล้ว</h2><p className="muted">ยินดีต้อนรับเข้าสู่ CPH Consult</p>
        <dl className="identity"><dt>บัญชีผู้ใช้</dt><dd>{session.user.login}</dd><dt>สถานะ</dt><dd>เชื่อมต่อบัญชีสำเร็จ</dd></dl>
        <p className="notice">{session.user.mustChangePassword ? 'บัญชีนี้ต้องเปลี่ยนรหัสผ่านก่อนใช้งานคลินิก ขณะนี้ฟังก์ชันเปลี่ยนรหัสผ่านยังไม่เปิดให้ใช้' : 'ระบบงานคลินิกกำลังพัฒนา ขณะนี้ทดสอบการเข้าและออกจากระบบได้เท่านั้น'}</p>
        <button disabled={busy} onClick={signOut}>{busy ? 'กำลังดำเนินการ…' : 'ออกจากระบบ'}</button>
      </> : <><h2>เข้าสู่ระบบ</h2><p className="muted">ใช้บัญชีทดสอบของระบบใหม่</p>
        <form onSubmit={signIn}><label htmlFor="login">ชื่อผู้ใช้</label><input id="login" name="username" autoComplete="username" required maxLength={254} value={login} onChange={e => setLogin(e.target.value)} placeholder="ชื่อผู้ใช้ของคุณ"/>
          <label htmlFor="password">รหัสผ่าน</label><input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/>
          <button type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button></form>
        <p className="hint">บัญชีระบบเดิมยังไม่ได้ย้ายมาใช้งานที่นี่</p>
      </>}
      {error && <p role="alert" className="error">{error}</p>}
      <footer>ใช้ข้อมูลจำลองในการทดสอบเท่านั้น</footer>
    </div></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
