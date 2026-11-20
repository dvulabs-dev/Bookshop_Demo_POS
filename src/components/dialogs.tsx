import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from 'lucide-react'
import { Modal, Field } from './ui'
import { useStore, useCan } from '../store/useStore'
import { PERMISSION_LABELS, type Permission, type User } from '../types'

/* ---------------- toasts ---------------- */

interface ToastItem {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
}
interface ToastStore {
  items: ToastItem[]
  push: (kind: ToastItem['kind'], text: string) => void
  dismiss: (id: number) => void
}
let toastSeq = 1
const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (kind, text) => {
    const id = toastSeq++
    set((s) => ({ items: [...s.items, { id, kind, text }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3800)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (t: string) => useToastStore.getState().push('success', t),
  error: (t: string) => useToastStore.getState().push('error', t),
  info: (t: string) => useToastStore.getState().push('info', t),
}

/* ---------------- confirm dialog ---------------- */

interface ConfirmReq {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}
const useConfirmStore = create<{ req: ConfirmReq | null }>(() => ({ req: null }))

export const confirmDialog = (opts: Omit<ConfirmReq, 'resolve'>) =>
  new Promise<boolean>((resolve) => useConfirmStore.setState({ req: { ...opts, resolve } }))

/* ---------------- manager approval ---------------- */

interface ApprovalReq {
  perm: Permission
  reason: string
  resolve: (u: User | null) => void
}
const useApprovalStore = create<{ req: ApprovalReq | null }>(() => ({ req: null }))

/** Ask for manager/owner PIN approval for a restricted action. Resolves with the approving user, or null. */
export const requestApproval = (perm: Permission, reason: string) =>
  new Promise<User | null>((resolve) => useApprovalStore.setState({ req: { perm, reason, resolve } }))

/** Hook: returns a function that runs `action` directly if the current user holds `perm`, else asks for PIN approval first. */
export function useGuarded() {
  const can = useCan()
  return async (perm: Permission, reason: string): Promise<{ ok: boolean; approvedBy?: string }> => {
    if (can(perm)) return { ok: true }
    const u = await requestApproval(perm, reason)
    return u ? { ok: true, approvedBy: u.id } : { ok: false }
  }
}

function ApprovalDialog({ req }: { req: ApprovalReq }) {
  const verifyPin = useStore((s) => s.verifyPin)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const close = (u: User | null) => {
    useApprovalStore.setState({ req: null })
    req.resolve(u)
  }
  const submit = () => {
    const u = verifyPin(pin, req.perm)
    if (u) {
      toast.success(`Approved by ${u.name}`)
      close(u)
    } else {
      setErr('Incorrect PIN, or that user is not allowed to approve this action.')
      setPin('')
    }
  }
  return (
    <Modal
      title={
        <span className="row gap-s">
          <ShieldCheck size={20} /> Manager approval required
        </span>
      }
      width={420}
      onClose={() => close(null)}
      footer={
        <>
          <button className="btn" onClick={() => close(null)}>
            Cancel
          </button>
          <button className="btn primary" disabled={pin.length < 4} onClick={submit}>
            Approve
          </button>
        </>
      }
    >
      <p>{req.reason}</p>
      <p className="muted small">
        Permission: <b>{PERMISSION_LABELS[req.perm]}</b>. A manager or the owner must enter their PIN.
      </p>
      <Field label="Approver PIN">
        <input
          className="input pin"
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''))
            setErr('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && submit()}
          placeholder="••••"
        />
      </Field>
      {err && <p className="error-text">{err}</p>}
      <p className="demo-hint">Demo PINs — Manager: 2222 • Owner: 1111</p>
    </Modal>
  )
}

/* ---------------- host (mounted once in the layout) ---------------- */

export function DialogHost() {
  const toasts = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)
  const confirm = useConfirmStore((s) => s.req)
  const approval = useApprovalStore((s) => s.req)

  useEffect(() => {
    // resolve pending dialogs if the host unmounts
    return () => {
      useConfirmStore.getState().req?.resolve(false)
      useApprovalStore.getState().req?.resolve(null)
    }
  }, [])

  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
            {t.kind === 'success' ? <CheckCircle2 size={18} /> : t.kind === 'error' ? <XCircle size={18} /> : <Info size={18} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      {confirm && (
        <Modal
          title={
            <span className="row gap-s">
              <AlertTriangle size={20} color={confirm.danger ? 'var(--red)' : 'var(--amber)'} /> {confirm.title}
            </span>
          }
          width={440}
          onClose={() => {
            useConfirmStore.setState({ req: null })
            confirm.resolve(false)
          }}
          footer={
            <>
              <button
                className="btn"
                onClick={() => {
                  useConfirmStore.setState({ req: null })
                  confirm.resolve(false)
                }}
              >
                Cancel
              </button>
              <button
                className={`btn ${confirm.danger ? 'danger' : 'primary'}`}
                autoFocus
                onClick={() => {
                  useConfirmStore.setState({ req: null })
                  confirm.resolve(true)
                }}
              >
                {confirm.confirmLabel ?? 'Confirm'}
              </button>
            </>
          }
        >
          <p>{confirm.message}</p>
        </Modal>
      )}
      {approval && <ApprovalDialog req={approval} />}
    </>
  )
}
