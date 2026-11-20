import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Barcode as BarcodeIcon, BarChart3, ShieldCheck, ShoppingCart, LogIn } from 'lucide-react'
import { useStore } from '../store/useStore'
import { LogoMark } from '../components/Receipt'
import { ROLE_LABELS } from '../data/roles'
import { Field } from '../components/ui'

export default function Login() {
  const nav = useNavigate()
  const login = useStore((s) => s.login)
  const users = useStore((s) => s.users)
  const current = useStore((s) => s.currentUserId)
  const settings = useStore((s) => s.settings)
  const [username, setUsername] = useState('owner')
  const [password, setPassword] = useState('demo')
  const [err, setErr] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = settings.appearance.theme
  }, [settings.appearance.theme])
  useEffect(() => {
    if (!current) return
    const role = users.find((u) => u.id === current)?.role
    nav(role === 'cashier' ? '/pos' : '/', { replace: true })
  }, [current, nav, users])

  const submit = (e?: React.FormEvent, u = username, p = password) => {
    e?.preventDefault()
    if (!login(u, p)) setErr('Incorrect username or password.')
  }

  return (
    <div className="login">
      <div className="login-hero">
        <div className="row gap">
          <LogoMark size={46} />
          <div>
            <h1>{settings.business.name}</h1>
            <p>POS &amp; Bookshop Management System</p>
          </div>
        </div>
        <ul className="login-points">
          <li>
            <BarcodeIcon size={20} /> Scan ISBN / barcodes and bill in seconds
          </li>
          <li>
            <ShoppingCart size={20} /> Stock, suppliers, purchasing and customers in one place
          </li>
          <li>
            <ShieldCheck size={20} /> Role-based access with manager approvals
          </li>
          <li>
            <BarChart3 size={20} /> Sales, stock and profit reports the owner can trust
          </li>
        </ul>
        <small>DVULabs • Interactive frontend demo — all data is sample data stored in your browser.</small>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="muted">Use a demo account below to explore each role.</p>
          <Field label="Username">
            <input className="input" value={username} onChange={(e) => (setUsername(e.target.value), setErr(''))} autoFocus autoComplete="username" />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={password} onChange={(e) => (setPassword(e.target.value), setErr(''))} autoComplete="current-password" />
          </Field>
          {err && <p className="error-text">{err}</p>}
          <button className="btn primary lg block" type="submit">
            <LogIn size={18} /> Sign in
          </button>
          <div className="demo-accounts">
            <small className="muted">Quick demo login (password: demo)</small>
            <div className="demo-grid">
              {users.filter((u) => u.active).map((u) => (
                <button type="button" key={u.id} className="demo-acc" onClick={() => submit(undefined, u.username, 'demo')}>
                  <b>{ROLE_LABELS[u.role]}</b>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
