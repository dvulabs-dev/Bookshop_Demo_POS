import { Printer } from 'lucide-react'
import { Modal } from './ui'
import { LogoMark } from './Receipt'
import { useStore } from '../store/useStore'

export interface DocPrintData {
  title: string // e.g. QUOTATION
  number: string
  date: string
  meta: { label: string; lines: string[] }[]
  columns: { label: string; align?: 'r' }[]
  rows: (string | number)[][]
  totals: { label: string; value: string; bold?: boolean }[]
  notes?: string[]
}

export function DocPrintModal({ doc, onClose }: { doc: DocPrintData; onClose: () => void }) {
  const b = useStore((s) => s.settings.business)
  return (
    <Modal
      title={`${doc.title} ${doc.number}`}
      width={880}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={() => window.print()}>
            <Printer size={16} /> Print / Save as PDF
          </button>
        </>
      }
    >
      <div className="receipt-stage">
        <div className="print-area a4-doc">
          <header className="a4-head">
            <div className="row gap">
              <LogoMark size={52} />
              <div>
                <h2>{b.name}</h2>
                <p>{b.address}</p>
                <p>{b.phone} • {b.email}</p>
              </div>
            </div>
            <div className="a4-right">
              <h1>{doc.title}</h1>
              <p><b>{doc.number}</b></p>
              <p>{doc.date}</p>
            </div>
          </header>
          <div className="a4-meta">
            {doc.meta.map((m) => (
              <div key={m.label}>
                <small>{m.label}</small>
                <p>{m.lines.map((l, i) => <span key={i}>{i === 0 ? <b>{l}</b> : l}<br /></span>)}</p>
              </div>
            ))}
          </div>
          <table className="a4-table">
            <thead>
              <tr>{doc.columns.map((c) => <th key={c.label} className={c.align}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {doc.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={doc.columns[j].align}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div className="a4-bottom">
            <div>{doc.notes?.map((n, i) => <p key={i} className="a4-policy">{n}</p>)}</div>
            <div className="a4-totals">
              {doc.totals.map((t) => (
                <div key={t.label} className={`rc-row ${t.bold ? 'bold' : ''}`}><span>{t.label}</span><span>{t.value}</span></div>
              ))}
            </div>
          </div>
          <footer className="a4-foot"><p>{b.name} • {b.phone} • {b.email}</p></footer>
        </div>
      </div>
    </Modal>
  )
}
