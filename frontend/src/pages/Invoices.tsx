import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
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

function IndeterminateCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate: boolean; onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="w-3.5 h-3.5 accent-[#1A1714] cursor-pointer" />
  )
}

export default function Invoices() {
  const navigate                        = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [downloading, setDl]            = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const qc                              = useQueryClient()

  const status = searchParams.get('status') || ''
  const q      = searchParams.get('search') || ''
  const page   = parseInt(searchParams.get('page') || '1')

  useEffect(() => { setSelected(new Set()) }, [status, q, page])

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
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Deleted'); setDeleteTarget(null) },
    onError:    () => { toast.error('Cannot delete'); setDeleteTarget(null) },
  })

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => invoicesApi.delete(id))),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setSelected(new Set()); toast.success('Deleted') },
    onError:    () => toast.error('Some invoices could not be deleted'),
  })

  const sendMut = useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Marked as Sent') },
  })

  const dupMut = useMutation({
    mutationFn: (id: string) => invoicesApi.duplicate(id),
    onSuccess:  (r) => { qc.invalidateQueries({ queryKey: ['invoices'] }); navigate(`/invoices/${r.data.id}`) },
  })

  async function handlePdf(e: React.MouseEvent, inv: Invoice) {
    e.stopPropagation()
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

  const raw      = data?.results ?? []
  const invoices = raw.filter(inv => {
    if (dateFrom && inv.issue_date < dateFrom) return false
    if (dateTo   && inv.issue_date > dateTo)   return false
    return true
  })

  const allSelected  = invoices.length > 0 && invoices.every(i => selected.has(i.id))
  const someSelected = invoices.some(i => selected.has(i.id)) && !allSelected
  const selCount     = invoices.filter(i => selected.has(i.id)).length

  function toggleAll() {
    setSelected(prev => {
      const n = new Set(prev)
      allSelected ? invoices.forEach(i => n.delete(i.id)) : invoices.forEach(i => n.add(i.id))
      return n
    })
  }

  function toggleOne(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const totalPages = data ? Math.ceil(data.count / 20) : 1
  const hasFilters = !!(status || q || dateFrom || dateTo)

  return (
    <div className="space-y-5">

      {deleteTarget && (
        <Modal
          title="Delete Invoice"
          message={`Delete ${deleteTarget.invoice_number}? This cannot be undone.`}
          confirmLabel="Delete" danger
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1714] tracking-tight">Invoices</h1>
          <p className="text-xs text-[#A39890] mt-0.5">{data?.count ?? 0} total</p>
        </div>
        <Link to="/invoices/new"
          className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors">
          + New Invoice
        </Link>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl overflow-hidden">
        {/* Search + date row */}
        <div className="px-3 py-2.5 flex flex-wrap items-center gap-2 border-b border-[#F3F0EB]">
          <input
            className="input flex-1 min-w-48 border-0 focus:ring-0 bg-transparent text-sm"
            placeholder="Search invoice # or client…"
            defaultValue={q}
            onChange={e => setParam('search', e.target.value)}
          />
          <div className="h-4 w-px bg-[#E5DFD6]" />
          <div className="flex items-center gap-1.5 text-xs text-[#A39890]">
            <span>From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="input border-0 focus:ring-0 bg-transparent text-sm text-[#6B6259] w-34 px-1" />
            <span>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="input border-0 focus:ring-0 bg-transparent text-sm text-[#6B6259] w-34 px-1" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs text-[#A39890] hover:text-[#8B3A3A] transition-colors">
              Clear
            </button>
          )}
        </div>
        {/* Status pills */}
        <div className="px-3 py-2 flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setParam('status', o.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                status === o.value
                  ? 'bg-[#1A1714] text-white'
                  : 'text-[#6B6259] hover:bg-[#F3F0EB] hover:text-[#1A1714]'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl overflow-hidden">

        {/* Bulk action bar */}
        {selCount > 0 && (
          <div className="px-4 py-2.5 bg-[#1A1714] flex items-center justify-between">
            <span className="text-sm font-medium text-white">{selCount} selected</span>
            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={() => bulkDeleteMut.mutate([...selected].filter(id => invoices.find(i => i.id === id)))}
                disabled={bulkDeleteMut.isPending}
                className="text-[#F5EBEB] hover:text-white font-medium disabled:opacity-40 transition-colors">
                Delete selected
              </button>
              <button onClick={() => setSelected(new Set())}
                className="text-[#A39890] hover:text-white transition-colors">
                Deselect all
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center p-16"><div className="spinner" /></div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[#A39890] mb-1">No invoices found</p>
            <p className="text-xs text-[#CEC8BE] mb-4">
              {hasFilters ? 'Try adjusting your filters' : 'Create your first invoice to get started'}
            </p>
            {!hasFilters && (
              <Link to="/invoices/new"
                className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors">
                Create Invoice
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[780px]">
              <thead><tr>
                <th className="w-10 px-4">
                  <IndeterminateCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
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
                {invoices.map(inv => {
                  const isSel = selected.has(inv.id)
                  return (
                    <tr key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className={`cursor-pointer transition-colors ${isSel ? 'bg-[#F8F5F0]' : 'hover:bg-[#FAFAF8]'}`}>
                      <td className="w-10 px-4" onClick={e => toggleOne(inv.id, e)}>
                        <input type="checkbox" checked={isSel} onChange={() => {}}
                          className="w-3.5 h-3.5 accent-[#1A1714] cursor-pointer" />
                      </td>
                      <td>
                        <span className="font-semibold text-[#1A1714]">{inv.invoice_number}</span>
                      </td>
                      <td className="text-[#6B6259]">{inv.client_name}</td>
                      <td><span className={`badge-${inv.status}`}>{statusLabel(inv.status)}</span></td>
                      <td className="text-[#A39890]">{fmtDate(inv.issue_date)}</td>
                      <td className={inv.status === 'overdue' ? 'text-[#8B3A3A] font-medium' : 'text-[#A39890]'}>
                        {fmtDate(inv.due_date)}
                      </td>
                      <td className="text-right font-medium text-[#1A1714]">AED {fmtAmount(inv.total_aed)}</td>
                      <td className={`text-right font-medium ${Number(inv.balance_due) > 0 ? 'text-[#8B3A3A]' : 'text-[#3A6B4F]'}`}>
                        AED {fmtAmount(inv.balance_due)}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-3 text-xs">
                          <button onClick={e => handlePdf(e, inv)} disabled={downloading === inv.id}
                            className="text-[#6B6259] hover:text-[#1A1714] font-medium disabled:opacity-40 transition-colors">
                            {downloading === inv.id ? '…' : 'PDF'}
                          </button>
                          <Link to={`/invoices/${inv.id}/edit`}
                            className="text-[#6B6259] hover:text-[#1A1714] font-medium transition-colors">
                            Edit
                          </Link>
                          {inv.status === 'draft' && (
                            <button onClick={e => { e.stopPropagation(); sendMut.mutate(inv.id) }}
                              className="text-[#3A5F8B] hover:underline font-medium">
                              Send
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); dupMut.mutate(inv.id) }}
                            className="text-[#6B6259] hover:text-[#1A1714] font-medium transition-colors">
                            Copy
                          </button>
                          {inv.status === 'draft' && (
                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(inv) }}
                              className="text-[#8B3A3A] font-medium hover:underline">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#A39890]">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}
              className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              ← Prev
            </button>
            <button disabled={page >= totalPages} onClick={() => setParam('page', String(page + 1))}
              className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
