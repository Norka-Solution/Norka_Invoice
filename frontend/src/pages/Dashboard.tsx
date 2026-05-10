import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dashboardApi, invoicesApi } from '../api/client'
import type { DashboardStats, Invoice, MonthlyRevenue, PaginatedResponse } from '../types'
import { fmtAmount, fmtDate, statusLabel } from '../lib/utils'

function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.amount), 1)
  const barW = 32
  const totalW = data.length * (barW + 16) - 16
  const chartH = 96

  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + 28}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barH = Math.max((d.amount / max) * chartH, d.amount > 0 ? 4 : 2)
        const x = i * (barW + 16)
        const y = chartH - barH
        const isLast = i === data.length - 1
        return (
          <g key={`${d.month}-${i}`}>
            <rect
              x={x} y={y} width={barW} height={barH}
              rx={5}
              fill={isLast ? '#1A1714' : '#D4CFC9'}
            />
            {d.amount > 0 && (
              <text
                x={x + barW / 2} y={y - 5}
                textAnchor="middle" fontSize="8.5" fill={isLast ? '#1A1714' : '#A39890'}
                fontFamily="system-ui, -apple-system, sans-serif" fontWeight={isLast ? '600' : '400'}
              >
                {d.amount >= 1000 ? `${(d.amount / 1000).toFixed(0)}k` : d.amount.toFixed(0)}
              </text>
            )}
            <text
              x={x + barW / 2} y={chartH + 18}
              textAnchor="middle" fontSize="10" fill={isLast ? '#1A1714' : '#A39890'}
              fontFamily="system-ui, -apple-system, sans-serif" fontWeight={isLast ? '600' : '400'}
            >
              {d.month}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs text-[#6B6259] shrink-0">{label}</div>
      <div className="flex-1 h-1.5 bg-[#EDE8E3] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-6 text-xs font-semibold text-[#1A1714] text-right shrink-0">{count}</div>
    </div>
  )
}

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

  const recentInvoices = recent?.results?.slice(0, 6) ?? []
  const total = stats?.total_invoices ?? 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1714] tracking-tight">Overview</h1>
          <p className="text-xs text-[#A39890] mt-0.5">NORKA Solution</p>
        </div>
        <Link
          to="/invoices/new"
          className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors"
        >
          + New Invoice
        </Link>
      </div>

      {/* Overdue alert */}
      {(stats?.overdue_count ?? 0) > 0 && (
        <div className="bg-[#FDF5F0] border border-[#E8D5C8] rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-[#8B3A3A] font-medium">
            {stats!.overdue_count} overdue invoice{stats!.overdue_count > 1 ? 's' : ''} — action required
          </span>
          <Link to="/invoices?status=overdue" className="text-xs text-[#8B3A3A] font-semibold hover:underline">
            View →
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Collected - hero card */}
        <div className="col-span-2 lg:col-span-1 bg-[#1A1714] rounded-2xl p-5 flex flex-col justify-between min-h-[120px]">
          <p className="text-[10px] text-white/40 uppercase tracking-[0.12em] font-medium">Collected · This Month</p>
          <div>
            <p className="text-2xl font-bold text-white mt-2 leading-none">
              {fmtAmount(stats?.paid_this_month ?? 0)}
            </p>
            <p className="text-[10px] text-white/30 mt-1.5">AED</p>
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-white border border-[#E5DFD6] rounded-2xl p-5 flex flex-col justify-between min-h-[120px]">
          <p className="text-[10px] text-[#A39890] uppercase tracking-[0.12em] font-medium">Outstanding</p>
          <div>
            <p className="text-2xl font-bold text-[#1A1714] mt-2 leading-none">
              {fmtAmount(stats?.total_outstanding ?? 0)}
            </p>
            <p className="text-[10px] text-[#A39890] mt-1.5">AED</p>
          </div>
        </div>

        {/* Total invoices */}
        <div className="bg-white border border-[#E5DFD6] rounded-2xl p-5 flex flex-col justify-between min-h-[120px]">
          <p className="text-[10px] text-[#A39890] uppercase tracking-[0.12em] font-medium">Total Invoices</p>
          <div>
            <p className="text-2xl font-bold text-[#1A1714] mt-2 leading-none">{total}</p>
            <p className="text-[10px] text-[#A39890] mt-1.5">{stats?.draft_count ?? 0} drafts</p>
          </div>
        </div>

        {/* Paid */}
        <div className="bg-white border border-[#E5DFD6] rounded-2xl p-5 flex flex-col justify-between min-h-[120px]">
          <p className="text-[10px] text-[#A39890] uppercase tracking-[0.12em] font-medium">Paid</p>
          <div>
            <p className="text-2xl font-bold text-[#3A6B4F] mt-2 leading-none">{stats?.paid_count ?? 0}</p>
            <p className="text-[10px] text-[#A39890] mt-1.5">invoices</p>
          </div>
        </div>

      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* Revenue bar chart */}
        <div className="lg:col-span-3 bg-white border border-[#E5DFD6] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-[#1A1714]">Revenue</h2>
              <p className="text-xs text-[#A39890] mt-0.5">Last 6 months · AED</p>
            </div>
          </div>
          {stats?.monthly_revenue && stats.monthly_revenue.length > 0 ? (
            <div className="px-1">
              <RevenueChart data={stats.monthly_revenue} />
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-[#C4BDB7]">
              No revenue data yet
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="lg:col-span-2 bg-white border border-[#E5DFD6] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#1A1714] mb-1">By Status</h2>
          <p className="text-xs text-[#A39890] mb-5">{total} total invoices</p>

          {total === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-[#C4BDB7]">No invoices yet</div>
          ) : (
            <div className="space-y-3.5">
              <StatusBar label="Paid"     count={stats?.paid_count ?? 0}           total={total} color="#3A6B4F" />
              <StatusBar label="Sent"     count={stats?.sent_count ?? 0}           total={total} color="#4A6B8B" />
              <StatusBar label="Partial"  count={stats?.partially_paid_count ?? 0} total={total} color="#8B7A3A" />
              <StatusBar label="Draft"    count={stats?.draft_count ?? 0}          total={total} color="#A39890" />
              <StatusBar label="Overdue"  count={stats?.overdue_count ?? 0}        total={total} color="#8B3A3A" />
            </div>
          )}
        </div>

      </div>

      {/* Recent invoices */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5DFD6] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1A1714]">Recent Invoices</h2>
          <Link to="/invoices" className="text-xs text-[#6B6259] hover:text-[#1A1714] transition-colors">
            View all →
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#A39890] mb-4">No invoices yet</p>
            <Link
              to="/invoices/new"
              className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors"
            >
              Create First Invoice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-[#F3F0EB]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#A39890] uppercase tracking-wider">Invoice</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#A39890] uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#A39890] uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#A39890] uppercase tracking-wider">Due</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#A39890] uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv, i) => (
                  <tr key={inv.id} className={`border-b border-[#F3F0EB] last:border-0 hover:bg-[#FAFAF9] transition-colors ${i % 2 === 0 ? '' : ''}`}>
                    <td className="px-5 py-3.5">
                      <Link to={`/invoices/${inv.id}`} className="text-sm font-semibold text-[#1A1714] hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#6B6259]">{inv.client_name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`badge-${inv.status}`}>{statusLabel(inv.status)}</span>
                    </td>
                    <td className={`px-5 py-3.5 text-sm ${inv.status === 'overdue' ? 'text-[#8B3A3A] font-medium' : 'text-[#A39890]'}`}>
                      {fmtDate(inv.due_date)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#1A1714]">
                      AED {fmtAmount(inv.total_aed)}
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
