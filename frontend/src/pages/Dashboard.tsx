import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dashboardApi, invoicesApi } from '../api/client'
import type { DashboardStats, Invoice, PaginatedResponse } from '../types'
import { fmtAmount, fmtDate, statusLabel } from '../lib/utils'

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn:  () => dashboardApi.stats().then(r => r.data),
  })

  const { data: recent } = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ['invoices', '', ''],
    queryFn:  () => invoicesApi.list({ ordering: '-created_at' }).then(r => r.data),
    staleTime: 60_000,
  })

  const recentInvoices = recent?.results?.slice(0, 8) ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-sub">NORKA Solution</p>
        </div>
        <Link to="/invoices/new" className="btn-primary">+ New Invoice</Link>
      </div>

      {/* Overdue alert */}
      {(stats?.overdue_count ?? 0) > 0 && (
        <div className="card px-4 py-3 flex items-center justify-between border-[#E5D5D5]">
          <span className="text-sm text-[#8B3A3A]">
            {stats!.overdue_count} overdue invoice{stats!.overdue_count > 1 ? 's' : ''} require attention
          </span>
          <Link to="/invoices?status=overdue" className="text-xs text-[#8B3A3A] font-medium hover:underline">
            View →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Collected this month — span 2 on large */}
        <div className="card p-5 lg:col-span-2 flex flex-col justify-between bg-[#1A1714] border-[#1A1714]">
          <p className="text-xs text-white/50 uppercase tracking-widest">Collected this month</p>
          <div>
            <p className="text-3xl font-bold text-white mt-3">
              AED {fmtAmount(stats?.paid_this_month ?? 0)}
            </p>
            <p className="text-xs text-white/40 mt-1">{stats?.sent_count ?? 0} invoices pending</p>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-xs text-[#A39890] uppercase tracking-widest">Total</p>
          <p className="text-3xl font-bold text-[#1A1714] mt-2">{stats?.total_invoices ?? 0}</p>
          <p className="text-xs text-[#A39890] mt-1">Invoices</p>
        </div>

        <div className="card p-5">
          <p className="text-xs text-[#A39890] uppercase tracking-widest">Paid</p>
          <p className="text-3xl font-bold text-[#3A6B4F] mt-2">{stats?.paid_count ?? 0}</p>
          <p className="text-xs text-[#A39890] mt-1">{stats?.draft_count ?? 0} drafts</p>
        </div>

      </div>

      {/* Recent invoices */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5DFD6] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1A1714]">Recent Invoices</h2>
          <Link to="/invoices" className="text-xs text-[#6B6259] hover:text-[#1A1714] hover:underline">
            All invoices →
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="empty-state">
            <p className="text-sm text-[#A39890] mb-4">No invoices yet</p>
            <Link to="/invoices/new" className="btn-primary btn-sm">Create First Invoice</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[600px]">
              <thead><tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Status</th>
                <th>Due</th>
                <th className="text-right">Total (AED)</th>
              </tr></thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      <Link to={`/invoices/${inv.id}`} className="font-medium text-[#1A1714] hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="text-[#6B6259]">{inv.client_name}</td>
                    <td>
                      <span className={`badge-${inv.status}`}>{statusLabel(inv.status)}</span>
                    </td>
                    <td className={`text-sm ${inv.status === 'overdue' ? 'text-[#8B3A3A]' : 'text-[#A39890]'}`}>
                      {fmtDate(inv.due_date)}
                    </td>
                    <td className="text-right font-medium text-[#1A1714]">
                      {fmtAmount(inv.total_aed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
