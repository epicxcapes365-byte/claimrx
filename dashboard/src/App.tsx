import { useState, useEffect } from 'react'
import { api } from './api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

// Analytics data (static for now)
const monthlyData = [
  { month: 'Sep', denied: 45000, recovered: 28000 },
  { month: 'Oct', denied: 52000, recovered: 35000 },
  { month: 'Nov', denied: 48000, recovered: 38000 },
  { month: 'Dec', denied: 61000, recovered: 42000 },
  { month: 'Jan', denied: 55000, recovered: 48000 },
  { month: 'Feb', denied: 42500, recovered: 38200 },
]

const payerData = [
  { name: 'Blue Cross', value: 35, color: '#3b82f6' },
  { name: 'Aetna', value: 25, color: '#8b5cf6' },
  { name: 'UnitedHealth', value: 20, color: '#10b981' },
  { name: 'Cigna', value: 12, color: '#f59e0b' },
  { name: 'Medicare', value: 8, color: '#ef4444' },
]

const denialReasons = [
  { reason: 'Medical Necessity', count: 42, success: 75 },
  { reason: 'Prior Auth Missing', count: 28, success: 65 },
  { reason: 'Coding Error', count: 18, success: 82 },
  { reason: 'Timely Filing', count: 8, success: 45 },
  { reason: 'Other', count: 4, success: 60 },
]

interface User {
  id: number
  email: string
  name: string
}

interface Claim {
  id: string
  patient: string
  amount: number
  payer: string
  denialReason: string
  deniedDate: string
  deadline: string
  status: string
}

interface Appeal {
  id: string
  claimId: string
  patient: string
  amount: number
  payer: string
  submittedDate: string
  status: string
  recoveredAmount: number | null
}

function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // App state
  const [activePage, setActivePage] = useState('dashboard')
  const [claims, setClaims] = useState<Claim[]>([])
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [appealLetter, setAppealLetter] = useState('')
  const [appealFilter, setAppealFilter] = useState('all')
  const [notification, setNotification] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setCheckingAuth(false)
  }, [])

  // Fetch data when user is logged in
  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  // Close sidebar on page change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [activePage])

  const fetchData = async () => {
    try {
      const [claimsData, appealsData] = await Promise.all([
        api.getClaims(),
        api.getAppeals()
      ])
      setClaims(claimsData)
      setAppeals(appealsData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      const result = await api.login(authEmail, authPassword)
      if (result.error) {
        setAuthError(result.error)
      } else {
        localStorage.setItem('token', result.token)
        localStorage.setItem('user', JSON.stringify(result.user))
        setUser(result.user)
        setAuthEmail('')
        setAuthPassword('')
      }
    } catch (err) {
      setAuthError('Login failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      const result = await api.register(authEmail, authPassword, authName)
      if (result.error) {
        setAuthError(result.error)
      } else {
        localStorage.setItem('token', result.token)
        localStorage.setItem('user', JSON.stringify(result.user))
        setUser(result.user)
        setAuthEmail('')
        setAuthPassword('')
        setAuthName('')
      }
    } catch (err) {
      setAuthError('Registration failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setAuthLoading(true)
    try {
      const result = await api.forgotPassword(authEmail)
      if (result.error) {
        setAuthError(result.error)
      } else {
        setAuthSuccess('Password reset link sent! Check your email.')
        setAuthEmail('')
      }
    } catch (err) {
      setAuthError('Failed to send reset email. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setClaims([])
    setAppeals([])
    setLoading(true)
  }

  const showNotification = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000)
  }

  const generateAppeal = async (claim: Claim) => {
    setSelectedClaim(claim)
    setIsGenerating(true)
    setAppealLetter('')
    try {
      const { letter } = await api.generateAppeal(claim)
      setAppealLetter(letter)
    } catch (error) {
      console.error('Failed to generate appeal:', error)
      setAppealLetter('Error generating appeal. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const submitAppeal = async () => {
    if (!selectedClaim) return
    try {
      const newAppeal = await api.createAppeal({
        claimId: selectedClaim.id,
        patient: selectedClaim.patient,
        amount: selectedClaim.amount,
        payer: selectedClaim.payer
      })
      setAppeals([newAppeal, ...appeals])
      setClaims(claims.map(c =>
        c.id === selectedClaim.id
          ? { ...c, status: 'appealed' }
          : c
      ))
      closeModal()
      showNotification(`Appeal ${newAppeal.id} submitted successfully!`)
    } catch (error) {
      console.error('Failed to submit appeal:', error)
      showNotification('Error submitting appeal. Please try again.')
    }
  }

  const closeModal = () => {
    setSelectedClaim(null)
    setAppealLetter('')
  }

  const filteredAppeals = appealFilter === 'all'
    ? appeals
    : appeals.filter(a => a.status === appealFilter)

  const totalDenied = claims.reduce((sum, c) => sum + c.amount, 0)
  const approvedAppeals = appeals.filter(a => a.status === 'approved')
  const totalRecovered = approvedAppeals.reduce((sum, a) => sum + (a.recoveredAmount || 0), 0)
  const decidedAppeals = appeals.filter(a => a.status === 'approved' || a.status === 'denied')
  const successRate = decidedAppeals.length > 0
    ? Math.round((approvedAppeals.length / decidedAppeals.length) * 100)
    : 0

  const appealStats = {
    total: appeals.length,
    pending: appeals.filter(a => a.status === 'pending').length,
    inReview: appeals.filter(a => a.status === 'in-review').length,
    approved: approvedAppeals.length,
    denied: appeals.filter(a => a.status === 'denied').length,
    totalRecovered
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500/20 text-emerald-400'
      case 'denied': return 'bg-red-500/20 text-red-400'
      case 'in-review': return 'bg-yellow-500/20 text-yellow-400'
      case 'pending': return 'bg-blue-500/20 text-blue-400'
      case 'appealed': return 'bg-purple-500/20 text-purple-400'
      case 'urgent': return 'bg-red-500/20 text-red-400'
      case 'in-progress': return 'bg-blue-500/20 text-blue-400'
      default: return 'bg-slate-600 text-slate-300'
    }
  }

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // ============ AUTH SCREEN ============
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg p-6 sm:p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-emerald-400 mb-2 text-center">ClaimRx</h1>
          <p className="text-slate-400 text-center mb-6">Medical Revenue Recovery System</p>

          {authMode !== 'forgot' ? (
            <>
              <div className="flex mb-6">
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess('') }}
                  className={`flex-1 py-2 text-center rounded-l-lg ${authMode === 'login' ? 'bg-emerald-600' : 'bg-slate-700'}`}
                >
                  Login
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess('') }}
                  className={`flex-1 py-2 text-center rounded-r-lg ${authMode === 'register' ? 'bg-emerald-600' : 'bg-slate-700'}`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
                {authMode === 'register' && (
                  <div className="mb-4">
                    <label className="block text-sm text-slate-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-base"
                      placeholder="Your name"
                      required
                    />
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-base"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-base"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {authMode === 'login' && (
                  <div className="mb-4 text-right">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccess('') }}
                      className="text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {authError && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded font-medium disabled:opacity-50 text-base"
                >
                  {authLoading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-center mb-2">Reset Password</h2>
                <p className="text-sm text-slate-400 text-center">Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={handleForgotPassword}>
                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-base"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {authError && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
                    {authError}
                  </div>
                )}

                {authSuccess && (
                  <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded text-emerald-400 text-sm">
                    {authSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded font-medium disabled:opacity-50 text-base mb-4"
                >
                  {authLoading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess('') }}
                  className="w-full text-center text-sm text-slate-400 hover:text-white"
                >
                  ← Back to login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    )
  }

  // Show loading while fetching data
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading ClaimRx...</p>
        </div>
      </div>
    )
  }

  // ============ MAIN APP ============
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          {notification}
        </div>
      )}

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-slate-800 border-b border-slate-700 z-40 flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white p-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <h1 className="text-lg font-bold text-emerald-400">ClaimRx</h1>
        <div className="w-6"></div>
      </div>

      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-slate-800 p-4 z-50 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="hidden lg:block">
          <h1 className="text-xl font-bold text-emerald-400 mb-2">ClaimRx</h1>
        </div>
        <div className="lg:hidden h-4"></div>
        <p className="text-sm text-slate-400 mb-6 mt-2 lg:mt-0">Welcome, {user.name}</p>

        <nav className="space-y-2">
          {['dashboard', 'claims', 'appeals', 'analytics'].map((page) => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`block w-full text-left px-4 py-3 lg:py-2 rounded capitalize ${
                activePage === page ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
            >
              {page}
              {page === 'appeals' && appealStats.pending > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-500 text-xs rounded-full">
                  {appealStats.pending}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 space-y-3">
          <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Claims</span>
              <span>{claims.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Appeals</span>
              <span>{appeals.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Recovered</span>
              <span className="text-emerald-400">${totalRecovered.toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 capitalize">{activePage}</h2>

        {/* ============ DASHBOARD ============ */}
        {activePage === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <p className="text-slate-400 text-xs sm:text-sm">Total Denied</p>
                <p className="text-xl sm:text-3xl font-bold text-red-400">${totalDenied.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">{claims.length} claims</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <p className="text-slate-400 text-xs sm:text-sm">Recovered</p>
                <p className="text-xl sm:text-3xl font-bold text-emerald-400">${totalRecovered.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">{appealStats.approved} approved</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <p className="text-slate-400 text-xs sm:text-sm">Success Rate</p>
                <p className="text-xl sm:text-3xl font-bold text-blue-400">{successRate}%</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">of decided appeals</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <p className="text-slate-400 text-xs sm:text-sm">Pending</p>
                <p className="text-xl sm:text-3xl font-bold text-yellow-400">{appealStats.pending + appealStats.inReview}</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">awaiting decision</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <h3 className="text-lg font-medium mb-4">Recent Claims</h3>
                <div className="space-y-3">
                  {claims.slice(0, 4).map(claim => (
                    <div key={claim.id} className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="font-medium truncate">{claim.patient}</p>
                        <p className="text-sm text-slate-400 truncate">{claim.payer} • {claim.denialReason}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-red-400 font-medium">${claim.amount.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusStyle(claim.status)}`}>
                          {claim.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setActivePage('claims')} className="w-full mt-4 text-center text-sm text-emerald-400 hover:text-emerald-300">
                  View all claims →
                </button>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <h3 className="text-lg font-medium mb-4">Recent Appeals</h3>
                <div className="space-y-3">
                  {appeals.slice(0, 4).map(appeal => (
                    <div key={appeal.id} className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="font-medium truncate">{appeal.patient}</p>
                        <p className="text-sm text-slate-400 truncate">{appeal.payer} • {appeal.submittedDate}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium">${appeal.amount.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusStyle(appeal.status)}`}>
                          {appeal.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setActivePage('appeals')} className="w-full mt-4 text-center text-sm text-emerald-400 hover:text-emerald-300">
                  View all appeals →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ CLAIMS ============ */}
        {activePage === 'claims' && (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="text-left p-4 font-medium">Claim ID</th>
                    <th className="text-left p-4 font-medium">Patient</th>
                    <th className="text-left p-4 font-medium">Amount</th>
                    <th className="text-left p-4 font-medium">Payer</th>
                    <th className="text-left p-4 font-medium">Denial Reason</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="border-t border-slate-700 hover:bg-slate-750">
                      <td className="p-4 font-mono text-sm">{claim.id}</td>
                      <td className="p-4">{claim.patient}</td>
                      <td className="p-4 text-red-400">${claim.amount.toLocaleString()}</td>
                      <td className="p-4">{claim.payer}</td>
                      <td className="p-4 text-slate-400">{claim.denialReason}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(claim.status)}`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {claim.status === 'appealed' ? (
                          <span className="text-slate-500 text-sm">Appeal submitted</span>
                        ) : (
                          <button onClick={() => generateAppeal(claim)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-sm">
                            Generate Appeal
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-700">
              {claims.map((claim) => (
                <div key={claim.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{claim.patient}</p>
                      <p className="text-xs font-mono text-slate-400">{claim.id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(claim.status)}`}>
                      {claim.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{claim.payer}</span>
                    <span className="text-red-400 font-medium">${claim.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{claim.denialReason}</span>
                    {claim.status !== 'appealed' ? (
                      <button onClick={() => generateAppeal(claim)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm">
                        Appeal
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Appealed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ APPEALS ============ */}
        {activePage === 'appeals' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
              {[
                { key: 'all', label: 'Total', value: appealStats.total, color: 'emerald' },
                { key: 'pending', label: 'Pending', value: appealStats.pending, color: 'blue' },
                { key: 'in-review', label: 'Review', value: appealStats.inReview, color: 'yellow' },
                { key: 'approved', label: 'Approved', value: appealStats.approved, color: 'emerald' },
                { key: 'denied', label: 'Denied', value: appealStats.denied, color: 'red' },
              ].map(stat => (
                <div
                  key={stat.key}
                  onClick={() => setAppealFilter(stat.key)}
                  className={`bg-slate-800 rounded-lg p-3 sm:p-4 cursor-pointer transition ${appealFilter === stat.key ? 'ring-2 ring-emerald-400' : 'hover:bg-slate-750'}`}
                >
                  <p className="text-slate-400 text-xs sm:text-sm">{stat.label}</p>
                  <p className="text-lg sm:text-2xl font-bold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-600/5 border border-emerald-500/30 rounded-lg p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <p className="text-emerald-400 font-medium">Total Recovered</p>
                <p className="text-sm text-slate-400">From {appealStats.approved} approved appeals</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400">${appealStats.totalRecovered.toLocaleString()}</p>
            </div>

            <div className="bg-slate-800 rounded-lg overflow-hidden">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="text-left p-4 font-medium">Appeal ID</th>
                      <th className="text-left p-4 font-medium">Claim ID</th>
                      <th className="text-left p-4 font-medium">Patient</th>
                      <th className="text-left p-4 font-medium">Payer</th>
                      <th className="text-left p-4 font-medium">Amount</th>
                      <th className="text-left p-4 font-medium">Submitted</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Recovered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppeals.map((appeal) => (
                      <tr key={appeal.id} className="border-t border-slate-700 hover:bg-slate-750">
                        <td className="p-4 font-mono text-sm">{appeal.id}</td>
                        <td className="p-4 font-mono text-sm text-slate-400">{appeal.claimId}</td>
                        <td className="p-4">{appeal.patient}</td>
                        <td className="p-4">{appeal.payer}</td>
                        <td className="p-4">${appeal.amount.toLocaleString()}</td>
                        <td className="p-4 text-slate-400">{appeal.submittedDate}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(appeal.status)}`}>
                            {appeal.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {appeal.status === 'approved' ? (
                            <span className="text-emerald-400 font-medium">${appeal.recoveredAmount?.toLocaleString()}</span>
                          ) : appeal.status === 'denied' ? (
                            <span className="text-red-400">$0</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-700">
                {filteredAppeals.map((appeal) => (
                  <div key={appeal.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{appeal.patient}</p>
                        <p className="text-xs font-mono text-slate-400">{appeal.id} → {appeal.claimId}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(appeal.status)}`}>
                        {appeal.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{appeal.payer} • {appeal.submittedDate}</span>
                      <span className="font-medium">${appeal.amount.toLocaleString()}</span>
                    </div>
                    {appeal.status === 'approved' && (
                      <div className="text-right">
                        <span className="text-emerald-400 text-sm font-medium">Recovered: ${appeal.recoveredAmount?.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {filteredAppeals.length === 0 && (
                <div className="p-8 text-center text-slate-400">No appeals found</div>
              )}
            </div>
          </div>
        )}

        {/* ============ ANALYTICS ============ */}
        {activePage === 'analytics' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-slate-400 text-xs sm:text-sm">Total Appeals</p>
                <p className="text-xl sm:text-2xl font-bold">{appeals.length}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-slate-400 text-xs sm:text-sm">Won Appeals</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-400">{appealStats.approved}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-slate-400 text-xs sm:text-sm">Win Rate</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-400">{successRate}%</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-slate-400 text-xs sm:text-sm">Avg Recovery</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                  ${appealStats.approved > 0 ? Math.round(appealStats.totalRecovered / appealStats.approved).toLocaleString() : 0}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-medium mb-4">Denied vs Recovered (6 Months)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    <Bar dataKey="denied" fill="#ef4444" name="Denied" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recovered" fill="#10b981" name="Recovered" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-medium mb-4">Recovery Rate Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyData.map(d => ({ ...d, rate: Math.round((d.recovered / d.denied) * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-medium mb-4">Denials by Payer</h3>
                <div className="flex flex-col sm:flex-row items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={payerData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                        {payerData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4 sm:mt-0">
                    {payerData.map((payer) => (
                      <div key={payer.name} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: payer.color }}></div>
                        <span className="text-slate-300">{payer.name}</span>
                        <span className="text-slate-500">{payer.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-medium mb-4">Appeal Success by Denial Reason</h3>
                <div className="space-y-3">
                  {denialReasons.map((item) => (
                    <div key={item.reason}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{item.reason}</span>
                        <span className="text-slate-400">{item.success}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.success}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ APPEAL MODAL ============ */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-slate-800 rounded-t-lg sm:rounded-lg w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <div className="min-w-0 flex-1 mr-3">
                <h3 className="text-lg font-semibold truncate">Appeal for {selectedClaim.id}</h3>
                <p className="text-sm text-slate-400 truncate">{selectedClaim.patient} • {selectedClaim.payer} • ${selectedClaim.amount.toLocaleString()}</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-white text-2xl flex-shrink-0">×</button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-400">Generating appeal letter with AI...</p>
                </div>
              ) : (
                <div className="bg-slate-900 rounded p-4 font-mono text-sm whitespace-pre-wrap">{appealLetter}</div>
              )}
            </div>

            {!isGenerating && appealLetter && (
              <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button onClick={closeModal} className="px-4 py-2.5 rounded bg-slate-700 hover:bg-slate-600 order-3 sm:order-1">Cancel</button>
                <button onClick={() => { navigator.clipboard.writeText(appealLetter); showNotification('Copied!') }} className="px-4 py-2.5 rounded bg-blue-600 hover:bg-blue-500 order-2">Copy to Clipboard</button>
                <button onClick={submitAppeal} className="px-4 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 order-1 sm:order-3">Submit Appeal</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
