import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Layout        from './components/Layout'
import AiAssistant   from './components/AiAssistant'
import Login         from './pages/Login'
import Dashboard     from './pages/Dashboard'
import Invoices      from './pages/Invoices'
import InvoiceDetail from './pages/InvoiceDetail'
import InvoiceForm   from './pages/InvoiceForm'
import Clients       from './pages/Clients'
import Payments      from './pages/Payments'
import CompanyPage   from './pages/Company'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

function Guard({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('access_token')
    ? <Layout>{children}</Layout>
    : <Navigate to="/login" replace />
}

function AppWithAI() {
  const location = useLocation()
  const isLoggedIn = !!localStorage.getItem('access_token')
  const isLogin = location.pathname === '/login'

  return (
    <>
      <Routes>
        <Route path="/login"              element={<Login />} />
        <Route path="/"                   element={<Guard><Dashboard /></Guard>} />
        <Route path="/invoices"           element={<Guard><Invoices /></Guard>} />
        <Route path="/invoices/new"       element={<Guard><InvoiceForm /></Guard>} />
        <Route path="/invoices/:id"       element={<Guard><InvoiceDetail /></Guard>} />
        <Route path="/invoices/:id/edit"  element={<Guard><InvoiceForm /></Guard>} />
        <Route path="/payments"           element={<Guard><Payments /></Guard>} />
        <Route path="/clients"            element={<Guard><Clients /></Guard>} />
        <Route path="/company"            element={<Guard><CompanyPage /></Guard>} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>

      {/* AI Assistant — shown on all pages except login */}
      {isLoggedIn && !isLogin && <AiAssistant />}
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppWithAI />
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </QueryClientProvider>
  )
}
