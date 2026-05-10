import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login(username, password)
      localStorage.setItem('access_token',  data.access)
      localStorage.setItem('refresh_token', data.refresh)
      navigate('/')
    } catch {
      toast.error('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1A1714] rounded-xl mb-5">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <h1 className="text-xl font-bold text-[#1A1714] tracking-wide">NORKA Solution</h1>
          <p className="text-sm text-[#A39890] mt-1">Invoice Management</p>
        </div>

        {/* Card */}
        <div className="card p-7 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-1"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#CEC8BE] mt-6">
          NORKA Solution · Abu Dhabi, UAE
        </p>
      </div>
    </div>
  )
}
