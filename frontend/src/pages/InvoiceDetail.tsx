import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi, paymentsApi, downloadPdf } from '../api/client'
import type { Invoice } from '../types'
import InvoicePrint from '../components/InvoicePrint'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { fmtDate, fmtAmount, statusLabel } from '../lib/utils'

export default function InvoiceDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const [showPay, setShowPay]   = useState(false)
  const [delPayId, setDelPayId] = useState<string | null>(null)
  const [payForm, setPayForm]   = useState({
    amount: '', payment_date: '', method: 'bank_transfer', reference: '',
  })

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn:  () => invoicesApi.get(id!).then(r => r.data),
    enabled:  !!id,
  })

  const sendMut = useMutation({
    mutationFn: () => invoicesApi.send(id!),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Marked as Sent') },
  })

  const dupMut = useMutation({
    mutationFn: () => invoicesApi.duplicate(id!),
    onSuccess:  (r) => { navigate(`/invoices/${r.data.id}`); toast.success('Invoice duplicated') },
  })

  const payMut = useMutation({
    mutationFn: () => paymentsApi.create(id!, {
      ...payForm,
      amount: parseFloat(payForm.amount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      toast.success('Payment recorded')
      setShowPay(false)
      setPayForm({ amount: '', payment_date: '', method: 'bank_transfer', reference: '' })
    },
    onError: () => toast.error('Payment failed'),
  })

  const delPayMut = useMutation({
    mutationFn: (pid: string) => paymentsApi.delete(id!, pid),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      toast.success('Payment removed')
      setDelPayId(null)
    },
  })

  if (isLoading || !invoice) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {delPayId && (
        <Modal
          title="Remove Payment"
          message="Remove this payment record? The invoice balance will be updated."
          confirmLabel="Remove"
          danger
          onConfirm={() => delPayMut.mutate(delPayId)}
          onCancel={() => setDelPayId(null)}
        />
      )}

      {/* Toolbar */}
      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1A1714]">{invoice.invoice_number}</span>
            <span className={`badge-${invoice.status}`}>{statusLabel(invoice.status)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => downloadPdf(invoice.id, invoice.invoice_number)}
            className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
          >
            PDF
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
          >
            Print
          </button>
          {invoice.status === 'draft' && (
            <>
              <Link
                to={`/invoices/${id}/edit`}
                className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
              >
                Edit
              </Link>
              <button
                onClick={() => sendMut.mutate()}
                disabled={sendMut.isPending}
                className="px-3 py-1.5 bg-[#1A1714] text-white text-xs font-medium rounded-lg hover:bg-[#2C2825] transition-colors disabled:opacity-40"
              >
                {sendMut.isPending ? '…' : 'Mark Sent'}
              </button>
            </>
          )}
          <button
            onClick={() => dupMut.mutate()}
            disabled={dupMut.isPending}
            className="px-3 py-1.5 text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors disabled:opacity-40"
          >
            {dupMut.isPending ? '…' : 'Duplicate'}
          </button>
        </div>
      </div>

      {/* Record payment */}
      {['sent', 'partially_paid', 'overdue'].includes(invoice.status) && (
        <div className="no-print space-y-3">
          {!showPay ? (
            <button
              onClick={() => setShowPay(true)}
              className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors"
            >
              + Record Payment
            </button>
          ) : (
            <div className="bg-white border border-[#E5DFD6] rounded-2xl p-6">
              <p className="text-sm font-semibold text-[#1A1714] mb-5">Record Payment</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="label">Amount (AED)</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00"
                    value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input className="input" type="date"
                    value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Method</label>
                  <select className="select" value={payForm.method}
                    onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Reference</label>
                  <input className="input" placeholder="Ref #"
                    value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-5 pt-5 border-t border-[#E5DFD6]">
                <button
                  onClick={() => payMut.mutate()}
                  disabled={payMut.isPending || !payForm.amount || !payForm.payment_date}
                  className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors disabled:opacity-40"
                >
                  {payMut.isPending ? 'Saving…' : 'Save Payment'}
                </button>
                <button
                  onClick={() => setShowPay(false)}
                  className="px-4 py-2 bg-white border border-[#E5DFD6] text-[#6B6259] text-sm font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Payment history */}
          {invoice.payments.length > 0 && !showPay && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5DFD6]">
                <p className="text-sm font-semibold text-[#1A1714]">Payments</p>
              </div>
              <table className="tbl">
                <thead><tr>
                  <th>Date</th><th>Method</th><th>Reference</th>
                  <th className="text-right">Amount</th><th></th>
                </tr></thead>
                <tbody>
                  {invoice.payments.map(p => (
                    <tr key={p.id}>
                      <td className="text-[#6B6259]">{fmtDate(p.payment_date)}</td>
                      <td className="text-[#6B6259] capitalize">{p.method.replace('_', ' ')}</td>
                      <td className="text-[#A39890]">{p.reference || '—'}</td>
                      <td className="text-right font-medium text-[#3A6B4F]">AED {fmtAmount(p.amount)}</td>
                      <td className="text-right">
                        <button
                          onClick={() => setDelPayId(p.id)}
                          className="text-xs text-[#A39890] hover:text-[#8B3A3A] hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-[#E5DFD6] text-right text-sm">
                <span className="text-[#A39890]">Balance Due: </span>
                <span className="font-bold text-[#1A1714]">AED {fmtAmount(invoice.balance_due)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice print view */}
      <InvoicePrint invoice={invoice} />
    </div>
  )
}
