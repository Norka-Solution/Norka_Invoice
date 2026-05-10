import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dashboardApi, invoicesApi } from '../api/client'
import type { DashboardStats, Invoice, MonthlyRevenue, PaginatedResponse, RecentPayment } from '../types'
import { fmtAmount, fmtDate, statusLabel } from '../lib/utils'

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
  cheque:        'Cheque',
  other:         'Other',
}

/* ── Donut chart ─────────────────────────────────────────── */
interface Seg { count: number; color: string; label: string }

function Donut({ total, segs }: { total: number; segs: Seg[] }) {
  const cx = 58, cy = 58, r = 44, sw = 12
  const C = 2 * Math.PI * r
  let cum = 0

  if (!total) return (
    <svg width="116" height="116" viewBox="0 0 116 116">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5DFD6" strokeWidth={sw} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#CEC8BE" fontFamily="system-ui">—</text>
    </svg>
  )

  return (
    <svg width="116" height="116" viewBox="0 0 116 116">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EDE8E3" strokeWidth={sw} />
      {segs.map((s, i) => {
        if (!s.count) return null
        const pct  = s.count / total
        const dash = pct * C
        const angle = cum * 360 - 90
        cum += pct
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={sw}
            strokeDasharray={`${dash} ${C - dash}`}
            transform={`rotate(${angle},${cx},${cy})`}
            strokeLinecap="butt"
          />
        )
      })}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize="20" fontWeight="700" fill="#1A1714" fontFamily="system-ui, -apple-system">
        {total}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" fill="#A39890" fontFamily="system-ui, -apple-system" letterSpacing="0.08em">
        TOTAL
      </text>
    </svg>
  )
}

/* ── Horizontal revenue bars ─────────────────────────────── */
function RevBars({ data }: { data: MonthlyRevenue[] }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.amount), 1)
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const isLast = i === data.length - 1
        const pct = (d.amount / max) * 100
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-7 text-[10px] text-[#A39890] text-right shrink-0 font-medium">{d.month}</span>
            <div className="flex-1 h-[5px] bg-[#EDE8E3] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct || 0.5}%`, backgroundColor: isLast ? '#1A1714' : '#B0A89E' }}
              />
            </div>
            <span className={`text-xs w-16 text-right shrink-0 tabular-nums ${isLast ? 'text-[#1A1714] font-semibold' : 'text-[#A39890]'}`}>
              {d.amount > 0 ? `${(d.amount / 1000).toFixed(1)}k` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Main ────────────────────────────────────────────────── */
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

  const recentInvoices = recent?.results?.slice(0, 7) ?? []
  const total = stats?.total_invoices ?? 0

  const segs: Seg[] = [
    { count: stats?.paid_count            ?? 0, color: '#3A6B4F', label: 'Paid'    },
    { count: stats?.sent_count            ?? 0, color: '#4A6B8B', label: 'Sent'    },
    { count: stats?.partially_paid_count  ?? 0, color: '#8B7A3A', label: 'Partial' },
    { count: stats?.overdue_count         ?? 0, color: '#8B3A3A', label: 'Overdue' },
    { count: stats?.draft_count           ?? 0, color: '#CEC8BE', label: 'Draft'   },
  ]

  const now = new Date()
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="space-y-0">

      {/* ── Header ── */}
      <div className="flex items-start justify-between pb-7">
        <div>
          <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-[0.14em] mb-1">Overview</p>
          <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">{monthYear}</h1>
        </div>
        <Link
          to="/invoices/new"
          className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors"
        >
          + New Invoice
        </Link>
      </div>

      {/* ── Overdue alert ── */}
      {(stats?.overdue_count ?? 0) > 0 && (
        <div className="mb-6 flex items-center justify-between bg-[#FDF5F0] border border-[#E8D5C8] rounded-xl px-4 py-3">
          <span className="text-sm text-[#8B3A3A] font-medium">
            {stats!.overdue_count} overdue invoice{stats!.overdue_count > 1 ? 's' : ''} — action required
          </span>
          <Link to="/invoices?status=overdue" className="text-xs text-[#8B3A3A] font-semibold hover:underline">
            View →
          </Link>
        </div>
      )}

      {/* ── Hero metrics — no boxes, just numbers ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-t border-b border-[#E5DFD6] divide-x divide-[#E5DFD6]">
        {[
          { label: 'Collected · ' + now.toLocaleDateString('en-US', { month: 'short' }),
            value: 'AED ' + fmtAmount(stats?.paid_this_month ?? 0),
            accent: false, green: false },
          { label: 'Total Collected',
            value: 'AED ' + fmtAmount(stats?.total_collected ?? 0),
            accent: false, green: true },
          { label: 'Outstanding',
            value: 'AED ' + fmtAmount(stats?.total_outstanding ?? 0),
            accent: (stats?.total_outstanding ?? 0) > 0, green: false },
          { label: 'Total Invoices',
            value: String(total),
            accent: false, green: false },
        ].map((m, i) => (
          <div key={i} className="px-5 py-6 first:pl-0 last:pr-0 md:first:pl-0">
            <p className="text-[10px] font-medium text-[#A39890] uppercase tracking-[0.1em] mb-2">{m.label}</p>
            <p className={`text-2xl font-bold tracking-tight ${m.green ? 'text-[#3A6B4F]' : m.accent ? 'text-[#8B3A3A]' : 'text-[#1A1714]'}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Status mix bar ── */}
      {total > 0 && (
        <div className="py-6 border-b border-[#E5DFD6]">
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
            {segs.map((s, i) => s.count > 0 && (
              <div key={i} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
            {segs.map((s, i) => s.count > 0 && (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-[#6B6259]">{s.label}</span>
                <span className="text-xs font-semibold text-[#1A1714]">{s.count}</span>
                <span className="text-[10px] text-[#A39890]">· {Math.round((s.count / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Revenue + Donut ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-10 py-8 border-b border-[#E5DFD6]">

        {/* Revenue bars */}
        <div className="md:col-span-3">
          <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-[0.12em] mb-5">
            Revenue · Last 6 Months · AED
          </p>
          {stats?.monthly_revenue?.length
            ? <RevBars data={stats.monthly_revenue} />
            : <p className="text-xs text-[#CEC8BE] py-4">No revenue data yet</p>
          }
        </div>

        {/* Donut + legend */}
        <div className="md:col-span-2">
          <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-[0.12em] mb-5">
            Invoice Mix
          </p>
          <div className="flex items-center gap-6">
            <Donut total={total} segs={segs} />
            <div className="space-y-2.5 flex-1 min-w-0">
              {segs.map((s, i) => {
                const pct = total ? Math.round((s.count / total) * 100) : 0
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-[#6B6259] truncate">{s.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#1A1714] tabular-nums shrink-0">
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ── Recent payments ── */}
      {(stats?.recent_payments?.length ?? 0) > 0 && (
        <div className="py-7 border-b border-[#E5DFD6]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-[0.12em]">Recent Payments</p>
            <Link to="/payments" className="text-xs text-[#6B6259] hover:text-[#1A1714] transition-colors font-medium">
              View all →
            </Link>
          </div>
          <div className="space-y-0">
            {stats!.recent_payments.map((p: RecentPayment) => (
              <Link
                key={p.id}
                to={`/invoices/${p.invoice_id}`}
                className="flex items-center justify-between py-3 border-b border-[#F3F0EB] last:border-0 hover:bg-white/60 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-sm font-semibold text-[#1A1714] shrink-0">{p.invoice_number}</span>
                  <span className="text-sm text-[#A39890] truncate hidden sm:block">{p.client_name}</span>
                  <span className="text-xs text-[#CEC8BE] shrink-0 hidden md:block">{METHOD_LABEL[p.method] ?? p.method}</span>
                </div>
                <div className="flex items-center gap-5 shrink-0 ml-3">
                  <span className="text-xs text-[#A39890] hidden md:block tabular-nums">{fmtDate(p.payment_date)}</span>
                  <span className="text-sm font-bold text-[#3A6B4F] tabular-nums">AED {fmtAmount(p.amount)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent invoices — list style, no table ── */}
      <div className="pt-7">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-[0.12em]">Recent Invoices</p>
          <Link to="/invoices" className="text-xs text-[#6B6259] hover:text-[#1A1714] transition-colors font-medium">
            View all →
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-[#A39890] mb-4">No invoices yet</p>
            <Link
              to="/invoices/new"
              className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors"
            >
              Create First Invoice
            </Link>
          </div>
        ) : (
          <div className="space-y-0">
            {recentInvoices.map(inv => (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className="flex items-center justify-between py-3 border-b border-[#F3F0EB] last:border-0 hover:bg-white/60 -mx-2 px-2 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`badge-${inv.status} shrink-0`}>{statusLabel(inv.status)}</span>
                  <span className="text-sm font-semibold text-[#1A1714] shrink-0">{inv.invoice_number}</span>
                  <span className="text-sm text-[#A39890] truncate hidden sm:block">{inv.client_name}</span>
                </div>
                <div className="flex items-center gap-5 shrink-0 ml-3">
                  <span className={`text-xs tabular-nums hidden md:block ${inv.status === 'overdue' ? 'text-[#8B3A3A] font-medium' : 'text-[#A39890]'}`}>
                    {fmtDate(inv.due_date)}
                  </span>
                  <span className="text-sm font-semibold text-[#1A1714] tabular-nums">
                    AED {fmtAmount(inv.total_aed)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
