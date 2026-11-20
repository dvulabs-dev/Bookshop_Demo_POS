import { useMemo, useState } from 'react'
import { Check, Edit3, Plus, ShieldCheck, X } from 'lucide-react'
import { useCurrentUser, useStore, userName } from '../store/useStore'
import { Badge, Card, Empty, Field, Modal, PageHeader, Pager, Tabs, Toggle, usePaged } from '../components/ui'
import { toast } from '../components/dialogs'
import { ALL_PERMISSIONS, ROLE_DESC, ROLE_LABELS, ROLE_PERMISSIONS } from '../data/roles'
import { fmtDateTime, uid } from '../lib/utils'
import { PERMISSION_LABELS, type RoleId, type User } from '../types'

export default function Staff() {
  const [tab, setTab] = useState<'users' | 'roles' | 'log'>('users')
  return (
    <>
      <PageHeader title="Staff & permissions" subtitle="Create accounts, assign roles and fine-tune what each person can do" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'Staff accounts' }, { id: 'roles', label: 'Roles & permissions' }, { id: 'log', label: 'Activity log' }]} />
      {tab === 'users' && <Users />}
      {tab === 'roles' && <Roles />}
      {tab === 'log' && <Log />}
    </>
  )
}

function Users() {
  const { users, saveUser, settings } = useStore()
  const me = useCurrentUser()
  const [edit, setEdit] = useState<User | null>(null)
  const blank = (): User => ({ id: uid('u'), name: '', username: '', password: '', pin: '', role: 'cashier', permissions: [...ROLE_PERMISSIONS.cashier], active: true })
  return (
    <>
      <Card title="Accounts" pad={false} actions={<button className="btn primary sm" onClick={() => setEdit(blank())}><Plus size={15} /> Add staff member</button>}>
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Permissions</th><th>Last login</th><th>Status</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'muted'}>
                  <td><div className="row gap-s"><div className="avatar sm">{u.name[0]}</div><b>{u.name}</b>{u.id === me?.id && <Badge tone="teal">you</Badge>}</div></td>
                  <td className="mono">{u.username}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>{u.role === 'owner' ? 'All' : `${u.permissions.length} of ${ALL_PERMISSIONS.length}`}{JSON.stringify([...u.permissions].sort()) !== JSON.stringify([...ROLE_PERMISSIONS[u.role]].sort()) && <Badge tone="amber">customised</Badge>}</td>
                  <td>{fmtDateTime(u.lastLogin)}</td>
                  <td><Badge tone={u.active ? 'green' : 'gray'}>{u.active ? 'Active' : 'Deactivated'}</Badge></td>
                  <td className="r"><button className="icon-btn sm" onClick={() => setEdit(u)}><Edit3 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && <UserForm initial={edit} isNew={!users.some((u) => u.id === edit.id)} isSelf={edit.id === me?.id} onClose={() => setEdit(null)} minPw={settings.security.minPasswordLength} onSave={(u) => { saveUser(u); toast.success('Staff account saved'); setEdit(null) }} />}
    </>
  )
}

function UserForm({ initial, isNew, isSelf, minPw, onClose, onSave }: { initial: User; isNew: boolean; isSelf: boolean; minPw: number; onClose: () => void; onSave: (u: User) => void }) {
  const users = useStore((s) => s.users)
  const [u, setU] = useState(initial)
  const set = <K extends keyof User>(k: K, v: User[K]) => setU({ ...u, [k]: v })
  const dup = users.some((x) => x.id !== u.id && x.username.toLowerCase() === u.username.trim().toLowerCase())
  const err = !u.name.trim() ? 'Name is required' : !u.username.trim() ? 'Username is required' : dup ? 'Username already exists' : (isNew || u.password !== initial.password) && u.password.length < minPw ? `Password must be at least ${minPw} characters` : u.pin && !/^\d{4,6}$/.test(u.pin) ? 'PIN must be 4–6 digits' : ''
  const toggle = (p: User['permissions'][number], on: boolean) => set('permissions', on ? [...new Set([...u.permissions, p])] : u.permissions.filter((x) => x !== p))
  return (
    <Modal
      title={isNew ? 'Add staff member' : `Edit ${initial.name}`}
      width={760}
      onClose={onClose}
      footer={<>{err && <span className="error-text grow">{err}</span>}{!err && <span className="grow" />}<button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!!err} onClick={() => onSave({ ...u, name: u.name.trim(), username: u.username.trim() })}>Save</button></>}
    >
      <div className="stack">
        <div className="grid cols-3">
          <Field label="Full name" required><input className="input" value={u.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="Username" required><input className="input mono" value={u.username} onChange={(e) => set('username', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={u.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Password" required hint={`Min. ${minPw} characters`}><input className="input" type="text" value={u.password} onChange={(e) => set('password', e.target.value)} /></Field>
          <Field label="Approval PIN" hint="4–6 digits, used to approve discounts, voids, refunds"><input className="input mono" value={u.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
          <Field label="Role">
            <select className="select" value={u.role} onChange={(e) => { const r = e.target.value as RoleId; setU({ ...u, role: r, permissions: [...ROLE_PERMISSIONS[r]] }) }}>
              {(Object.keys(ROLE_LABELS) as RoleId[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
        </div>
        <p className="muted small">{ROLE_DESC[u.role]}</p>
        <div className="perm-head">
          <h4><ShieldCheck size={16} /> Permission controls</h4>
          <button className="btn sm" onClick={() => set('permissions', [...ROLE_PERMISSIONS[u.role]])}>Reset to role defaults</button>
        </div>
        <div className="perm-grid">
          {ALL_PERMISSIONS.map((p) => (
            <Toggle key={p} checked={u.permissions.includes(p) || u.role === 'owner'} disabled={u.role === 'owner'} onChange={(v) => toggle(p, v)} label={PERMISSION_LABELS[p]} />
          ))}
        </div>
        <Toggle checked={u.active} disabled={isSelf} onChange={(v) => set('active', v)} label="Account active" hint={isSelf ? 'You cannot deactivate your own account' : 'Deactivated users cannot sign in'} />
      </div>
    </Modal>
  )
}

function Roles() {
  return (
    <div className="stack">
      <div className="grid cols-3">
        {(Object.keys(ROLE_LABELS) as RoleId[]).map((r) => (
          <div key={r} className="list-card">
            <b>{ROLE_LABELS[r]}</b>
            <p className="small muted">{ROLE_DESC[r]}</p>
          </div>
        ))}
      </div>
      <Card title="Default permission matrix" pad={false} actions={<span className="muted small">Individual users can be customised on the Staff accounts tab</span>}>
        <div className="tbl-wrap">
          <table className="table compact matrix">
            <thead><tr><th>Permission</th>{(Object.keys(ROLE_LABELS) as RoleId[]).map((r) => <th key={r} className="center">{ROLE_LABELS[r].split(' /')[0]}</th>)}</tr></thead>
            <tbody>
              {ALL_PERMISSIONS.map((p) => (
                <tr key={p}>
                  <td>{PERMISSION_LABELS[p]}</td>
                  {(Object.keys(ROLE_LABELS) as RoleId[]).map((r) => <td key={r} className="center">{ROLE_PERMISSIONS[r].includes(p) ? <Check size={16} color="var(--green)" /> : <X size={14} color="var(--muted)" />}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="note-box"><b>Recommended default:</b> cashiers only access the functions needed for counter sales. Sensitive operations require manager or owner approval (PIN) and remain recorded in the activity log.</p>
    </div>
  )
}

function Log() {
  const { audit, users } = useStore()
  const [uidF, setUid] = useState('')
  const [sensitive, setSensitive] = useState(false)
  const rows = useMemo(() => audit.filter((a) => (!uidF || a.userId === uidF) && (!sensitive || a.sensitive)), [audit, uidF, sensitive])
  const pg = usePaged(rows, 15)
  return (
    <Card title="Activity & audit history" pad={false}>
      <div className="filters">
        <select className="select" value={uidF} onChange={(e) => setUid(e.target.value)}>
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <Toggle checked={sensitive} onChange={setSensitive} label="Sensitive changes only" />
      </div>
      <div className="tbl-wrap">
        <table className="table">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {pg.rows.map((a) => (
              <tr key={a.id}><td>{fmtDateTime(a.date)}</td><td>{userName(users, a.userId)}</td><td>{a.sensitive ? <Badge tone="amber">{a.action}</Badge> : a.action}</td><td className="muted">{a.detail}</td></tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="No activity" />}
      </div>
      <Pager {...pg} />
    </Card>
  )
}
