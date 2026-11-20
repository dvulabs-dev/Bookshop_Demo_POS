import { useMemo, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import { Mail, MessageCircle, Printer, FileDown } from 'lucide-react'
import { Modal, Barcode } from './ui'
import { PAY_LABEL, saleDiscount } from '../lib/calc'
import { fmtDateTime, fmtDate, lkr, withCheck } from '../lib/utils'
import { translate } from '../i18n'
import { useStore } from '../store/useStore'
import { toast } from './dialogs'
import type { Sale, Settings } from '../types'

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#14355a" />
      <path d="M9 9h6a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H9z" fill="#42c0d6" />
      <path d="M23 9h-5v11h5z" fill="#fff" opacity=".92" />
    </svg>
  )
}

function Qr({ text, size = 84 }: { text: string; size?: number }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true })
  }, [text])
  return <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
}

const Row = ({ l, r, bold }: { l: ReactNode; r: ReactNode; bold?: boolean }) => (
  <div className={`rc-row ${bold ? 'bold' : ''}`}>
    <span>{l}</span>
    <span>{r}</span>
  </div>
)

export function ReceiptView({ sale, settings, layout }: { sale: Sale; settings: Settings; layout?: 'thermal' | 'a4' }) {
  const users = useStore((s) => s.users)
  const customers = useStore((s) => s.customers)
  const r = settings.receipt
  const lay = layout ?? r.layout
  const lang = settings.appearance.language
  const t = (k: string) => translate(lang, k)
  const cashier = users.find((u) => u.id === sale.cashierId)?.name ?? '—'
  const customer = customers.find((c) => c.id === sale.customerId)
  const disc = saleDiscount(sale)
  const b = settings.business
  const voided = sale.status === 'voided'

  if (lay === 'a4') {
    return (
      <div className="print-area a4-doc">
        <header className="a4-head">
          <div className="row gap">
            <LogoMark size={52} />
            <div>
              <h2>{b.name}</h2>
              <p>{b.tagline}</p>
            </div>
          </div>
          <div className="a4-right">
            <h1>{t('Invoice').toUpperCase()}</h1>
            <p>
              <b>{sale.no}</b>
            </p>
            <p>{fmtDateTime(sale.date)}</p>
          </div>
        </header>
        <div className="a4-meta">
          <div>
            <small>FROM</small>
            <p>
              {b.address}
              <br />
              {b.phone} • {b.email}
              {b.regNo && (
                <>
                  <br />
                  Reg. No: {b.regNo}
                </>
              )}
            </p>
          </div>
          <div>
            <small>BILL TO</small>
            <p>
              <b>{sale.customerName ?? settings.pos.walkInLabel}</b>
              {r.showCustomer && customer && (
                <>
                  <br />
                  {customer.phone}
                  {customer.address && (
                    <>
                      <br />
                      {customer.address}
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <div>
            <small>DETAILS</small>
            <p>
              {r.showCashier && (
                <>
                  Cashier: {cashier}
                  <br />
                </>
              )}
              Status: {voided ? 'VOIDED' : sale.balance > 0 ? 'PARTIALLY PAID' : 'PAID'}
            </p>
          </div>
        </div>
        <table className="a4-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th className="r">Qty</th>
              <th className="r">Unit price</th>
              <th className="r">Discount</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  {l.title}
                  {r.showIsbn && <small> • {l.barcode}</small>}
                </td>
                <td className="r">{l.qty}</td>
                <td className="r">{lkr(l.price)}</td>
                <td className="r">{l.discount ? lkr(l.discount) : '—'}</td>
                <td className="r">{lkr(l.price * l.qty - l.discount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="a4-bottom">
          <div>
            {r.showQr && <Qr text={`${b.name}|${sale.no}|${sale.total}`} size={86} />}
            <p className="a4-policy">
              <b>Return policy:</b> {r.returnPolicy}
            </p>
            {r.taxInfo && <p className="a4-policy">{r.taxInfo}</p>}
          </div>
          <div className="a4-totals">
            <Row l={t('Subtotal')} r={lkr(sale.subtotal)} />
            {sale.discount > 0 && <Row l="Bill discount" r={`− ${lkr(sale.discount)}`} />}
            {sale.tax > 0 && <Row l={`${settings.pos.taxLabel} (${settings.pos.taxPct}%)`} r={lkr(sale.tax)} />}
            <Row l={<b>{t('Total')}</b>} r={<b>{lkr(sale.total)}</b>} bold />
            <hr />
            {sale.payments.map((p, i) => (
              <Row key={i} l={`${t(PAY_LABEL[p.method])}${r.showPaymentRef && p.ref ? ` (${p.ref})` : ''}`} r={lkr(p.amount)} />
            ))}
            <Row l={t('Paid')} r={lkr(sale.paid)} />
            {sale.change > 0 && <Row l={t('Change')} r={lkr(sale.change)} />}
            {sale.balance > 0 && <Row l={<b>Balance due</b>} r={<b>{lkr(sale.balance)}</b>} bold />}
            {disc > 0 && <p className="a4-saved">You saved {lkr(disc)}</p>}
          </div>
        </div>
        <footer className="a4-foot">
          <b>{r.thankYou}</b>
          <p>{r.footer}</p>
        </footer>
      </div>
    )
  }

  return (
    <div className="print-area thermal">
      <div className="rc-center">
        <LogoMark size={34} />
        <h2>{b.name}</h2>
        <p>{b.address}</p>
        <p>Tel: {b.phone}</p>
        {b.regNo && <p>Reg: {b.regNo}</p>}
      </div>
      <div className="rc-sep" />
      <Row l={`${t('Receipt')} #`} r={sale.no} bold />
      <Row l={t('Date')} r={fmtDateTime(sale.date)} />
      {r.showCashier && <Row l={t('Cashier')} r={cashier} />}
      {r.showCustomer && <Row l={t('Customer')} r={sale.customerName ?? settings.pos.walkInLabel} />}
      {voided && <div className="rc-void">*** VOIDED ***</div>}
      <div className="rc-sep" />
      {sale.lines.map((l, i) => (
        <div key={i} className="rc-item">
          <div className="rc-title">{l.title}</div>
          {r.showIsbn && <div className="rc-sub">{l.barcode}</div>}
          <Row l={`${l.qty} × ${lkr(l.price, { symbol: false })}`} r={lkr(l.price * l.qty, { symbol: false })} />
          {l.discount > 0 && <Row l="  Discount" r={`− ${lkr(l.discount, { symbol: false })}`} />}
        </div>
      ))}
      <div className="rc-sep" />
      <Row l={t('Subtotal')} r={lkr(sale.subtotal)} />
      {sale.discount > 0 && <Row l="Discount" r={`− ${lkr(sale.discount)}`} />}
      {sale.tax > 0 && <Row l={`${settings.pos.taxLabel} ${settings.pos.taxPct}%`} r={lkr(sale.tax)} />}
      <Row l={t('Total').toUpperCase()} r={lkr(sale.total)} bold />
      <div className="rc-sep" />
      {sale.payments.map((p, i) => (
        <Row key={i} l={`${t(PAY_LABEL[p.method])}${r.showPaymentRef && p.ref ? ` ${p.ref}` : ''}`} r={lkr(p.amount)} />
      ))}
      <Row l={t('Paid')} r={lkr(sale.paid)} />
      {sale.change > 0 && <Row l={t('Change')} r={lkr(sale.change)} />}
      {sale.balance > 0 && <Row l="BALANCE DUE" r={lkr(sale.balance)} bold />}
      {disc > 0 && <div className="rc-center rc-saved">You saved {lkr(disc)}</div>}
      <div className="rc-sep" />
      <p className="rc-policy">{r.returnPolicy}</p>
      {r.taxInfo && <p className="rc-policy">{r.taxInfo}</p>}
      <div className="rc-center">
        {r.showQr && <Qr text={`${b.name}|${sale.no}|${sale.total}`} size={78} />}
        <Barcode code={withCheck(sale.no.replace(/\D/g, '').padStart(12, '0').slice(-12))} height={26} showText={false} scale={1.1} />
        <p className="rc-thanks">{r.thankYou}</p>
        <p className="rc-policy">{r.footer}</p>
      </div>
    </div>
  )
}

export function ReceiptModal({ sale, onClose, title = 'Receipt' }: { sale: Sale; onClose: () => void; title?: string }) {
  const settings = useStore((s) => s.settings)
  const customers = useStore((s) => s.customers)
  const customer = customers.find((c) => c.id === sale.customerId)
  const layout = settings.receipt.layout
  const text = `${settings.business.name}\nReceipt ${sale.no}\n${fmtDate(sale.date)}\nTotal: ${lkr(sale.total)}\n${settings.receipt.thankYou}`
  const wa = () => {
    const phone = (customer?.phone ?? '').replace(/\D/g, '').replace(/^0/, '94')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
  }
  const mail = () => {
    window.location.href = `mailto:${customer?.email ?? ''}?subject=${encodeURIComponent(`${settings.business.name} – Receipt ${sale.no}`)}&body=${encodeURIComponent(text)}`
  }
  return (
    <Modal
      title={title}
      subtitle={`${sale.no} • ${layout === 'thermal' ? 'Thermal 80mm' : 'A4 invoice'} layout (change in Settings → Receipt)`}
      width={layout === 'a4' ? 880 : 460}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={wa} title="Opens WhatsApp with a pre-filled message">
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button className="btn" onClick={mail}>
            <Mail size={16} /> Email
          </button>
          <button
            className="btn"
            onClick={() => {
              toast.info('In the print dialog choose “Save as PDF” as the destination')
              setTimeout(() => window.print(), 300)
            }}
          >
            <FileDown size={16} /> PDF
          </button>
          <button className="btn primary" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
        </>
      }
    >
      <div className="receipt-stage">
        <ReceiptView sale={sale} settings={settings} />
      </div>
    </Modal>
  )
}
