import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'

const NAV = [
  { path: '/',         label: 'Overview',  labelAr: 'الرئيسية' },
  { path: '/invoices', label: 'Invoices',  labelAr: 'الفواتير' },
  { path: '/clients',  label: 'Clients',   labelAr: 'العملاء'  },
  { path: '/company',  label: 'Company',   labelAr: 'الشركة'   },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const [open, setOpen] = useState(false)

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 pt-6 pb-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#F8F5F0] border border-[#E5DFD6] flex-shrink-0">
          <img src="/android-chrome-192x192.png" alt="NORKA" className="w-full h-full object-contain" />
        </div>
        <div>
          <div className="text-[#1A1714] font-bold text-sm tracking-wide leading-tight">NORKA</div>
          <div className="text-[#A39890] text-[10px]">Invoice System</div>
        </div>
      </div>

      <div className="mx-6 border-t border-[#E5DFD6]" />

      {/* Nav */}
      <nav className="flex-1 px-3 pt-4 space-y-0.5">
        {NAV.map(({ path, label, labelAr }) => {
          const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setOpen(false)}
              className={`
                flex items-center justify-between px-3 py-2.5 rounded-lg text-sm
                transition-all duration-150
                ${active
                  ? 'bg-[#1A1714] text-white font-medium'
                  : 'text-[#6B6259] hover:bg-[#F3F0EB] hover:text-[#1A1714]'
                }
              `}
            >
              <span>{label}</span>
              <span className={`text-[10px] ${active ? 'text-white/50' : 'text-[#CEC8BE]'}`}>{labelAr}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-5 border-t border-[#E5DFD6] mt-auto">
        <button
          onClick={logout}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm
                     text-[#A39890] hover:bg-[#F3F0EB] hover:text-[#1A1714] transition-colors"
        >
          <span>Sign out</span>
          <span className="text-[10px] text-[#CEC8BE]">خروج</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F5F0]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-52 bg-white border-r border-[#E5DFD6] flex-shrink-0">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <>
          <div className="fixed inset-0 bg-[#1A1714]/20 z-40 md:hidden" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-56 bg-white border-r border-[#E5DFD6] flex flex-col shadow-xl md:hidden">
            {sidebar}
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-[#E5DFD6] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#F3F0EB] text-[#6B6259]"
          >
            <span className="text-xl leading-none">{open ? '✕' : '☰'}</span>
          </button>
          <span className="font-bold text-[#1A1714] text-sm tracking-wide">NORKA</span>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-5 md:p-8 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
