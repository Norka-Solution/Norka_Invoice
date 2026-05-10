import type { Invoice, InvoiceItem } from '../types'

interface Props { invoice: Invoice }

const SC: Record<string, { en: string; ar: string; dot: string; bg: string; fg: string }> = {
  draft:          { en: 'Draft',    ar: 'مسودة',  dot: '#A39890', bg: '#F3F0EB', fg: '#6B6259' },
  sent:           { en: 'Sent',     ar: 'مُرسلة', dot: '#3A5F8B', bg: '#EBF0F8', fg: '#3A5F8B' },
  paid:           { en: 'Paid',     ar: 'مدفوعة', dot: '#3A6B4F', bg: '#EBF3EF', fg: '#3A6B4F' },
  partially_paid: { en: 'Partial',  ar: 'جزئي',   dot: '#7A5B3A', bg: '#F5EFEA', fg: '#7A5B3A' },
  overdue:        { en: 'Overdue',  ar: 'متأخرة', dot: '#8B3A3A', bg: '#F5EBEB', fg: '#8B3A3A' },
  cancelled:      { en: 'Cancelled',ar: 'ملغاة',  dot: '#A39890', bg: '#F3F0EB', fg: '#A39890' },
}

const CAT_AR: Record<string, string> = {
  subscription: 'اشتراك', service: 'خدمة', product: 'منتج',
  development:  'تطوير',  maintenance: 'صيانة', other: 'أخرى',
}
const CAT_EN: Record<string, string> = {
  subscription: 'Subscription', service: 'Service', product: 'Product',
  development:  'Development',  maintenance: 'Maintenance', other: 'Other',
}

const LETTERS = ['A','B','C','D','E','F','G','H']

const fmt = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function groupItems(items: InvoiceItem[]) {
  const map = new Map<string, InvoiceItem[]>()
  for (const item of items) {
    const k = item.category || 'other'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  return [...map.entries()].map(([cat, list], i) => ({
    cat, list, letter: LETTERS[i] ?? String(i + 1),
  }))
}

type Row =
  | { kind: 'cat';  cat: string; letter: string }
  | { kind: 'item'; item: InvoiceItem; num: number }

export default function InvoicePrint({ invoice }: Props) {
  const client = invoice.client_data
  const bank   = invoice.bank_data
  const sc     = SC[invoice.status] ?? SC.draft

  const groups = groupItems(invoice.items ?? [])
  const rows: Row[] = []
  let n = 0
  for (const g of groups) {
    rows.push({ kind: 'cat', cat: g.cat, letter: g.letter })
    for (const item of g.list) {
      n++
      rows.push({ kind: 'item', item, num: n })
    }
  }

  const page: React.CSSProperties = {
    fontFamily: "'Segoe UI', Arial, 'Noto Sans Arabic', sans-serif",
    fontSize: 11,
    color: '#1A1714',
    background: '#fff',
    width: '210mm',
    minHeight: '297mm',
    padding: '14mm 15mm',
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 24px rgba(0,0,0,0.06)',
    borderRadius: 4,
  }

  return (
    <div id="invoice-print" style={page}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 64, height: 64, border: '1.5px solid #E5DFD6', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#F8F5F0', flexShrink: 0,
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#1A1714' }}>N</span>
          </div>
          <div style={{ paddingTop: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1A1714', letterSpacing: 0.3 }}>NORKA SOLUTION</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6259', marginTop: 2 }}>نوركا سوليونش</div>
            <div style={{ fontSize: 9, color: '#A39890', marginTop: 4 }}>IT Services &amp; Digital Solutions</div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#1A1714', lineHeight: 1, letterSpacing: -1 }}>INVOICE</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#6B6259', marginTop: 3 }}>فاتورة خدمات</div>
          <div style={{
            display: 'inline-block', marginTop: 8,
            background: '#F3F0EB', border: '1px solid #E5DFD6',
            borderRadius: 20, padding: '4px 14px',
            fontSize: 10, color: '#6B6259',
          }}>
            {invoice.invoice_number} &nbsp;|&nbsp; {invoice.issue_date}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1.5, background: '#1A1714', marginBottom: 18 }} />

      {/* Info grid */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
        <div style={{ flex: 1, borderRight: '1px solid #E5DFD6', paddingRight: 20 }}>
          {([
            ['Invoice No. | رقم الفاتورة',  invoice.invoice_number],
            ['Issue Date | تاريخ الإصدار',  invoice.issue_date],
            ['Due Date | تاريخ الاستحقاق',  invoice.due_date],
            ...(invoice.period_start && invoice.period_end
              ? [['Period | الفترة', `${invoice.period_start} – ${invoice.period_end}`] as [string, string]]
              : []),
            ['Items | عدد البنود', `${invoice.items?.length ?? 0} items`],
          ] as [string, string][]).map(([label, value], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F3F0EB' }}>
              <span style={{ fontSize: 9, color: '#A39890' }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
            <span style={{ fontSize: 9, color: '#A39890' }}>Status | الحالة</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: sc.bg, color: sc.fg,
              borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
              {sc.ar} · {sc.en}
            </span>
          </div>
        </div>

        <div style={{ width: 210, flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#A39890', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            SUBMITTED TO &nbsp;|&nbsp; مقدَّم إلى
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#1A1714' }}>{client?.name_en || '—'}</div>
          {client?.name_ar && <div style={{ fontSize: 12, fontWeight: 700, color: '#6B6259', marginTop: 2 }}>{client.name_ar}</div>}
          {client?.address_en && <div style={{ fontSize: 9, color: '#A39890', marginTop: 4 }}>{client.address_en}</div>}
          {client?.address_ar && <div style={{ fontSize: 9, color: '#A39890' }}>{client.address_ar}</div>}
          {client?.phone && <div style={{ fontSize: 9, color: '#A39890', marginTop: 2 }}>Tel: {client.phone}</div>}
          {client?.trn && <div style={{ fontSize: 9, color: '#A39890' }}>TRN: {client.trn}</div>}

          <div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px solid #E5DFD6' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#A39890', marginBottom: 4 }}>FROM &nbsp;|&nbsp; من</div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>NORKA SOLUTION</div>
            <div style={{ fontSize: 10, color: '#6B6259', marginTop: 1 }}>نوركا سوليونش</div>
            <div style={{ fontSize: 9, color: '#A39890' }}>Abu Dhabi, UAE &nbsp;|&nbsp; أبوظبي، الإمارات</div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ border: '1px solid #E5DFD6', borderRadius: 10, display: 'flex', marginBottom: 22, background: '#F8F5F0', overflow: 'hidden' }}>
        {([
          { value: String(invoice.items?.length ?? 0), label: 'Service Items', ar: 'بنود الخدمة' },
          { value: `AED ${fmt(invoice.subtotal_aed)}`,  label: 'Subtotal', ar: 'المجموع الفرعي' },
          { value: invoice.vat_enabled ? `AED ${fmt(invoice.vat_amount)}` : '—', label: invoice.vat_enabled ? `VAT ${invoice.vat_rate}%` : 'No VAT', ar: 'ضريبة القيمة' },
          { value: `AED ${fmt(invoice.total_aed)}`, label: 'Total Due', ar: 'المجموع الكلي', highlight: true },
        ] as { value: string; label: string; ar: string; highlight?: boolean }[]).map((s, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', padding: '14px 8px',
            borderRight: i < 3 ? '1px solid #E5DFD6' : 'none',
            background: s.highlight ? '#1A1714' : undefined,
          }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.highlight ? '#fff' : '#1A1714' }}>{s.value}</div>
            <div style={{ fontSize: 8, color: s.highlight ? 'rgba(255,255,255,0.6)' : '#A39890', marginTop: 3 }}>{s.label}</div>
            <div style={{ fontSize: 8, color: s.highlight ? 'rgba(255,255,255,0.4)' : '#CEC8BE' }}>{s.ar}</div>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1A1714', letterSpacing: 0.3 }}>INVOICE ITEMS</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1A1714' }}>بنود الفاتورة</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {(['#', 'DESCRIPTION', 'CATEGORY', 'QTY', 'TOTAL (AED)'] as const).map((h, i) => (
                <th key={i} style={{
                  padding: '7px 8px', fontSize: 9, fontWeight: 700, color: '#A39890',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  textAlign: i >= 3 ? 'right' : 'left',
                  borderBottom: '1.5px solid #1A1714',
                  width: i === 0 ? 28 : i === 3 ? 40 : i === 4 ? 90 : undefined,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.kind === 'cat') {
                return (
                  <tr key={`cat-${ri}`} style={{ background: '#F3F0EB' }}>
                    <td colSpan={5} style={{ padding: '6px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1714' }}>
                          {CAT_EN[row.cat] ?? row.cat}{CAT_AR[row.cat] ? ` · ${CAT_AR[row.cat]}` : ''}
                        </span>
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: '#1A1714', color: '#fff',
                          fontSize: 11, fontWeight: 900,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>{row.letter}</span>
                      </div>
                    </td>
                  </tr>
                )
              }
              const item = row.item
              return (
                <tr key={`item-${ri}`} style={{ borderBottom: '1px solid #F3F0EB' }}>
                  <td style={{ padding: '8px', fontSize: 10, color: '#A39890' }}>{row.num}</td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: 10 }}>{item.description_en}</div>
                    {item.description_ar && <div style={{ fontSize: 9, color: '#A39890', marginTop: 2 }}>{item.description_ar}</div>}
                    {item.currency !== 'AED' && (
                      <div style={{ fontSize: 8, color: '#CEC8BE', marginTop: 1, fontStyle: 'italic' }}>
                        {item.currency} {fmt(item.unit_price)} × {item.exchange_rate}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px', fontSize: 9, color: '#A39890' }}>{CAT_EN[item.category] ?? item.category}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>{item.quantity}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontSize: 10, fontWeight: 700 }}>{fmt(item.total_aed)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0 22px' }}>
        <div style={{ width: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #E5DFD6', fontSize: 10 }}>
            <span style={{ color: '#A39890' }}>Subtotal</span>
            <span>AED {fmt(invoice.subtotal_aed)}</span>
          </div>
          {invoice.vat_enabled && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #E5DFD6', fontSize: 10, color: '#6B6259' }}>
              <span>VAT ({invoice.vat_rate}%)</span>
              <span>AED {fmt(invoice.vat_amount)}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            background: '#1A1714', color: '#fff',
            padding: '8px 12px', borderRadius: 6, marginTop: 6,
            fontWeight: 900, fontSize: 13,
          }}>
            <span>TOTAL DUE</span>
            <span>AED {fmt(invoice.total_aed)}</span>
          </div>
          {invoice.total_paid > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', marginTop: 5, fontSize: 10, color: '#3A6B4F' }}>
                <span>Paid</span><span>AED {fmt(invoice.total_paid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, color: '#8B3A3A', fontWeight: 700 }}>
                <span>Balance Due</span><span>AED {fmt(invoice.balance_due)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bank */}
      {bank && (
        <div style={{ border: '1px solid #E5DFD6', borderRadius: 8, padding: '10px 14px', marginBottom: 20, background: '#F8F5F0' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#A39890', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Payment Instructions — Bank Transfer
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            {([
              ['Bank', bank.bank_name], ['Account Name', bank.account_name],
              ['Account No.', bank.account_number], ['IBAN', bank.iban],
              ['SWIFT', bank.swift_code], ...(bank.branch ? [['Branch', bank.branch]] : []),
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 7, color: '#A39890', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 10, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      {invoice.payments?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#3A6B4F', marginBottom: 6 }}>Payment History</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#EBF3EF' }}>
              {['Date','Method','Reference','Amount (AED)'].map((h, i) => (
                <th key={i} style={{ padding: '4px 8px', fontSize: 8, color: '#3A6B4F', textAlign: i === 3 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {invoice.payments.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 1 ? '#F3F0EB' : '#fff' }}>
                  <td style={{ padding: '4px 8px', fontSize: 9 }}>{p.payment_date}</td>
                  <td style={{ padding: '4px 8px', fontSize: 9, textTransform: 'capitalize' }}>{p.method.replace('_',' ')}</td>
                  <td style={{ padding: '4px 8px', fontSize: 9 }}>{p.reference || '—'}</td>
                  <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 600 }}>{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes + Signature */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, alignItems: 'flex-start' }}>
        {(invoice.notes_en || invoice.notes_ar) && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Notes | ملاحظات</div>
            {invoice.notes_ar && <div style={{ fontSize: 10, color: '#6B6259', lineHeight: 1.7, marginBottom: 4, direction: 'rtl' }}>{invoice.notes_ar}</div>}
            {invoice.notes_en && <div style={{ fontSize: 10, color: '#6B6259', lineHeight: 1.7 }}>{invoice.notes_en}</div>}
          </div>
        )}
        <div style={{ width: 170, textAlign: 'center', flexShrink: 0, marginLeft: 'auto' }}>
          <div style={{ fontSize: 9, color: '#A39890', marginBottom: 4 }}>Authorized Signature | توقيع المفوَّض</div>
          <div style={{ height: 40, borderBottom: '1px solid #CEC8BE', marginBottom: 8 }} />
          <div style={{ fontSize: 10, fontWeight: 700 }}>NORKA SOLUTION</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 'auto', borderTop: '1px solid #E5DFD6', paddingTop: 8,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 8, color: '#A39890',
      }}>
        <span>NORKA SOLUTION · Abu Dhabi, UAE</span>
        <span>فاتورة خدمات · {invoice.invoice_number}</span>
      </div>
    </div>
  )
}
