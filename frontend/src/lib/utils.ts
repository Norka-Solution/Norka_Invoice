export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function fmtAmount(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: 'Draft', sent: 'Sent', paid: 'Paid',
    partially_paid: 'Partial', overdue: 'Overdue', cancelled: 'Cancelled',
  }
  return map[s] ?? s
}
