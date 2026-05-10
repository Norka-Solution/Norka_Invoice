import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'

const NAV = [
  { path: '/',         label: 'Overview'  },
  { path: '/invoices', label: 'Invoices'  },
  { path: '/clients',  label: 'Clients'   },
  { path: '/company',  label: 'Company'   },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex flex-col">

      {/* ── Top Navbar ── */}
      <header className="bg-white border-b border-[#E5DFD6] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">

          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-md overflow-hidden border border-[#E5DFD6] bg-[#F8F5F0]">
              <img src="/android-chrome-192x192.png" alt="NORKA" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-[#1A1714] text-sm tracking-wide">NORKA</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ path, label }) => {
              const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
              return (
                <Link
                  key={path}
                  to={path}
                  className={`
                    px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-150
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
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button
              onClick={logout}
              className="hidden md:block text-xs text-[#A39890] hover:text-[#1A1714] transition-colors font-medium"
            >
              Sign out
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-md text-[#6B6259] hover:bg-[#F3F0EB]"
            >
              <span className="text-base leading-none">{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-[#E5DFD6] bg-white px-4 py-3 space-y-1">
            {NAV.map(({ path, label }) => {
              const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMenuOpen(false)}
                  className={`
                    block px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${active ? 'bg-[#1A1714] text-white' : 'text-[#6B6259] hover:bg-[#F3F0EB]'}
                  `}
                >
                  {label}
                </Link>
              )
            })}
            <div className="pt-2 border-t border-[#E5DFD6] mt-2">
              <button onClick={logout} className="block w-full text-left px-3 py-2 text-sm text-[#A39890] hover:text-[#1A1714]">
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Page Content ── */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-7">
          {children}
        </div>
      </main>

    </div>
  )
}
