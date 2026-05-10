import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { invoicesApi, downloadPdf } from '../api/client'
import type { Invoice, PaginatedResponse } from '../types'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import { fmtDate, fmtAmount, statusLabel } from '../lib/utils'

const STATUS_OPTIONS = [
  { value: '',               label: 'All' },
  { value: 'draft',          label: 'Draft' },
  { value: 'sent',           label: 'Sent' },
  { value: 'paid',           label: 'Paid' },
  { value: 'partially_paid', label: 'Partial' },
  { value: 'overdue',        label: 'Overdue' },
  { value: 'cancelled',      label: 'Cancelled' },
]

export default function Invoices() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [downloading, setDl]            = useState<string | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const queryClient                     = useQueryClient()

  const status = searchParams.get('status') || ''
  const q      = searchParams.get('search') || ''
  const page   = parseInt(searchParams.get('page') || '1')

  const { data, isLoading } = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ['invoices', status, q, page],
    queryFn:  () => invoicesApi.list({
      ...(status && { status }),
      ...(q      && { search: q }),
      page: String(page),
      ordering: '-created_at',
    }).then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice deleted')
      setDeleteTarget(null)
    },
    onError: () => { toast.error('Cannot delete this invoice'); setDeleteTarget(null) },
  })

  const sendMut = useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Marked as Sent') },
  })

  const dupMut = useMutation({
    mutationFn: (id: string) => invoicesApi.duplicate(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Duplicated') },
  })

  async function handlePdf(inv: Invoice) {
    setDl(inv.id)
    try { await downloadPdf(inv.id, inv.invoice_number) }
    catch { toast.error('PDF generation failed') }
    finally { setDl(null) }
  }

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams)
    val ? p.set(key, val) : p.delete(key)
    if (key !== 'page') p.delete('page')
    setSearchParams(p)
  }

  const invoices   = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / 20) : 1

  return (
    <div className="space-y-5">

      {deleteTarget && (
        <Modal
          title="Delete Invoice"
          message={`Delete ${deleteTarget.invoice_number}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { setDeletingId(deleteTarget.id); deleteMut.mutate(deleteTarget.id) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1714] tracking-tight">Invoices</h1>
          <p className="text-xs text-[#A39890] mt-0.5">{data?.count ?? 0} total</p>
        </div>
        <Link
          to="/invoices/new"
          className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors"
        >
          + New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-48 border-0 focus:ring-0 bg-transparent"
          placeholder="Search by invoice # or client…"
          defaultValue={q}
          onChange={e => setParam('search', e.target.value)}
        />
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setParam('status', o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === o.value
                  ? 'bg-[#1A1714] text-white'
                  : 'text-[#6B6259] hover:bg-[#F3F0EB] hover:text-[#1A1714]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center p-16"><div className="spinner" /></div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[#A39890] mb-1">No invoices found</p>
            <p className="text-xs text-[#CEC8BE] mb-4">
              {(status || q) ? 'Try different filters' : 'Create your first invoice to get started'}
            </p>
            {!status && !q && (
              <Link
                to="/invoices/new"
                className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors"
              >
                Create Invoice
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[720px]">
              <thead><tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Due</th>
                <th className="text-right">Total</th>
                <th className="text-right">Balance</th>
                <th className="text-right">Actions</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      <Link to={`/invoices/${inv.id}`} className="font-semibold text-[#1A1714] hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="text-[#6B6259]">{inv.client_name}</td>
                    <td>
                      <span className={`badge-${inv.status}`}>{statusLabel(inv.status)}</span>
                    </td>
                    <td className="text-[#A39890]">{fmtDate(inv.issue_date)}</td>
                    <td className={inv.status === 'overdue' ? 'text-[#8B3A3A] font-medium' : 'text-[#A39890]'}>
                      {fmtDate(inv.due_date)}
                    </td>
                    <td className="text-right font-medium text-[#1A1714]">
                      AED {fmtAmount(inv.total_aed)}
                    </td>
                    <td className={`text-right font-medium ${Number(inv.balance_due) > 0 ? 'text-[#8B3A3A]' : 'text-[#3A6B4F]'}`}>
                      AED {fmtAmount(inv.balance_due)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-3 text-xs">
                        <Link to={`/invoices/${inv.id}`} className="text-[#6B6259] hover:text-[#1A1714] font-medium transition-colors">
                          View
                        </Link>
                        <button
                          onClick={() => handlePdf(inv)}
                          disabled={downloading === inv.id}
                          className="text-[#6B6259] hover:text-[#1A1714] font-medium transition-colors disabled:opacity-40"
                        >
                          {downloading === inv.id ? '…' : 'PDF'}
                        </button>
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => sendMut.mutate(inv.id)}
                            className="text-[#3A5F8B] hover:underline font-medium"
                          >
                            Send
                          </button>
                        )}
                        <button
                          onClick={() => dupMut.mutate(inv.id)}
                          className="text-[#6B6259] hover:text-[#1A1714] font-medium transition-colors"
                        >
                          Copy
                        </button>
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => setDeleteTarget(inv)}
                            disabled={deletingId === inv.id}
                            className="text-[#8B3A3A] font-medium hover:underline disabled:opacity-40"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#A39890]">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setParam('page', String(page - 1))}
              className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setParam('page', String(page + 1))}
              className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
