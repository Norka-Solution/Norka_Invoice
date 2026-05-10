import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'

const NAV = [
  { path: '/',         label: 'Overview'  },
  { path: '/invoices', label: 'Invoices'  },
  { path: '/clients',  label: 'Clients'   },
]

function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="px-4 h-14 flex items-center border-b border-[#E5DFD6] flex-shrink-0">
        <Link to="/" onClick={onClose} className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#E5DFD6] bg-[#F8F5F0] flex-shrink-0">
            <img src="/android-chrome-192x192.png" alt="NORKA" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-[#1A1714] text-sm tracking-wide">NORKA</span>
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {NAV.map(({ path, label }) => {
            const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className={`
                  flex items-center px-3 h-9 rounded-lg text-sm font-medium transition-all duration-100 select-none
                  ${active
                    ? 'bg-[#1A1714] text-white'
                    : 'text-[#6B6259] hover:bg-[#F3F0EB] hover:text-[#1A1714]'
                  }
                `}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom: Settings + Sign out */}
      <div className="px-2 pb-4 space-y-0.5 border-t border-[#E5DFD6] pt-3 flex-shrink-0">
        <Link
          to="/company"
          onClick={onClose}
          className={`
            flex items-center px-3 h-9 rounded-lg text-sm font-medium transition-all duration-100 select-none
            ${location.pathname.startsWith('/company')
              ? 'bg-[#1A1714] text-white'
              : 'text-[#A39890] hover:bg-[#F3F0EB] hover:text-[#1A1714]'
            }
          `}
        >
          Settings
        </Link>
        <button
          onClick={logout}
          className="flex items-center w-full px-3 h-9 rounded-lg text-sm font-medium text-[#A39890] hover:bg-[#F3F0EB] hover:text-[#1A1714] transition-colors"
        >
          Sign out
        </button>
      </div>

    </div>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F8F5F0]">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/25 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-[220px] bg-white border-r border-[#E5DFD6] z-50
        transition-transform duration-200 ease-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Content */}
      <div className="flex-1 md:ml-[220px] flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#E5DFD6] h-12 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#6B6259] hover:bg-[#F3F0EB] text-base"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
          <span className="font-bold text-[#1A1714] text-sm">NORKA</span>
        </header>

        {/* Page */}
        <main className="flex-1 py-8">
          <div className="max-w-5xl mx-auto px-6 md:px-10">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
