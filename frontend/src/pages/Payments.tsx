import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { paymentsApi } from '../api/client'
import type { PaymentWithInvoice } from '../types'
import { fmtDate, fmtAmount } from '../lib/utils'

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
  cheque:        'Cheque',
  other:         'Other',
}

export default function Payments() {
  const { data, isLoading } = useQuery<PaymentWithInvoice[]>({
    queryKey: ['payments-all'],
    queryFn:  () => paymentsApi.listAll().then(r => r.data),
  })

  const payments = data ?? []
  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0)

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="space-y-0">

      {/* Header */}
      <div className="pb-7">
        <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-[0.14em] mb-1">Finance</p>
        <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">Payments</h1>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 border-t border-b border-[#E5DFD6] divide-x divide-[#E5DFD6]">
        <div className="px-5 py-6 pl-0">
          <p className="text-[10px] font-medium text-[#A39890] uppercase tracking-[0.1em] mb-2">Total Collected</p>
          <p className="text-2xl font-bold tracking-tight text-[#3A6B4F]">AED {fmtAmount(totalAmount)}</p>
        </div>
        <div className="px-5 py-6">
          <p className="text-[10px] font-medium text-[#A39890] uppercase tracking-[0.1em] mb-2">Payments</p>
          <p className="text-2xl font-bold tracking-tight text-[#1A1714]">{payments.length}</p>
        </div>
      </div>

      {/* List */}
      <div className="pt-7">
        {payments.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#A39890] mb-2">No payments recorded yet</p>
            <p className="text-xs text-[#CEC8BE]">Payments are recorded from within each invoice</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="hidden md:grid gap-4 px-2 mb-2" style={{ gridTemplateColumns: '110px 130px 1fr 130px 1fr 130px' }}>
              {['Date', 'Invoice', 'Client', 'Method', 'Reference', 'Amount'].map(h => (
                <p key={h} className="text-[10px] font-semibold text-[#A39890] uppercase tracking-[0.1em] last:text-right">{h}</p>
              ))}
            </div>

            <div className="space-y-0">
              {payments.map(p => (
                <div
                  key={p.id}
                  className="hidden md:grid gap-4 items-center py-3.5 border-b border-[#F3F0EB] last:border-0 hover:bg-white/60 -mx-2 px-2 rounded-lg transition-colors"
                  style={{ gridTemplateColumns: '110px 130px 1fr 130px 1fr 130px' }}
                >
                  <span className="text-xs text-[#A39890] tabular-nums">{fmtDate(p.payment_date)}</span>
                  <Link
                    to={`/invoices/${p.invoice_id}`}
                    className="text-sm font-semibold text-[#1A1714] hover:text-[#3A6B4F] transition-colors"
                  >
                    {p.invoice_number}
                  </Link>
                  <span className="text-sm text-[#6B6259] truncate">{p.client_name}</span>
                  <span className="text-xs text-[#6B6259]">{METHOD_LABEL[p.method] ?? p.method}</span>
                  <span className="text-xs text-[#A39890] truncate">{p.reference || '—'}</span>
                  <span className="text-sm font-bold text-[#3A6B4F] tabular-nums text-right">
                    AED {fmtAmount(p.amount)}
                  </span>
                </div>
              ))}

              {/* Mobile cards */}
              {payments.map(p => (
                <Link
                  key={p.id + '-m'}
                  to={`/invoices/${p.invoice_id}`}
                  className="md:hidden flex items-center justify-between py-3 border-b border-[#F3F0EB] last:border-0 hover:bg-white/60 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-[#1A1714]">{p.invoice_number}</span>
                      <span className="text-xs text-[#A39890]">{METHOD_LABEL[p.method] ?? p.method}</span>
                    </div>
                    <p className="text-xs text-[#A39890]">{p.client_name} · {fmtDate(p.payment_date)}</p>
                  </div>
                  <span className="text-sm font-bold text-[#3A6B4F] tabular-nums ml-3 shrink-0">
                    AED {fmtAmount(p.amount)}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
