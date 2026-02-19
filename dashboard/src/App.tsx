import { useState, useEffect } from 'react'
import { api } from './api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

const monthlyData = [
  { month: 'Sep', denied: 45000, recovered: 28000 },
  { month: 'Oct', denied: 52000, recovered: 35000 },
  { month: 'Nov', denied: 48000, recovered: 38000 },
  { month: 'Dec', denied: 61000, recovered: 42000 },
  { month: 'Jan', denied: 55000, recovered: 48000 },
  { month: 'Feb', denied: 42500, recovered: 38200 },
]

const denialReasons = [
  { reason: 'Medical Necessity', count: 42, success: 75 },
  { reason: 'Prior Auth Missing', count: 28, success: 65 },
  { reason: 'Coding Error', count: 18, success: 82 },
  { reason: 'Timely Filing', count: 8, success: 45 },
  { reason: 'Other', count: 4, success: 60 },
]

interface User { id: number; email: string; name: string }
interface Claim { id: string; patient: string; amount: number; payer: string; denialReason: string; deniedDate: string; deadline: string; status: string; patientEmail?: string; patientPhone?: string; serviceDate?: string; serviceCode?: string; diagnosisCode?: string; payerPhone?: string; payerEmail?: string; payerFax?: string; payerAppealsAddress?: string; payerAvgResponseDays?: number; payerCommittedResponseDays?: number }
interface Appeal { id: string; claimId: string; patient: string; amount: number; payer: string; submittedDate: string; status: string; recoveredAmount: number | null; decidedDate?: string; daysToDecision?: number }
interface Payer { id: number; name: string; phone: string; fax: string; email: string; appealsAddress: string; avgResponseDays: number; committedResponseDays: number; website?: string }

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activePage, setActivePage] = useState('dashboard')
  const [claims, setClaims] = useState<Claim[]>([])
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [payers, setPayers] = useState<Payer[]>([])
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [viewingClaim, setViewingClaim] = useState<Claim | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [appealLetter, setAppealLetter] = useState('')
  const [appealFilter, setAppealFilter] = useState('all')
  const [notification, setNotification] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimSearch, setClaimSearch] = useState('')
  const [claimPayerFilter, setClaimPayerFilter] = useState('')
  const [claimDateFilter, setClaimDateFilter] = useState('')
  const [appealSearch, setAppealSearch] = useState('')
  const [appealPayerFilter, setAppealPayerFilter] = useState('')
  const [viewingPayer, setViewingPayer] = useState<Payer | null>(null)
  const [showNewClaimModal, setShowNewClaimModal] = useState(false)
  const [claimStatusFilter, setClaimStatusFilter] = useState('')
  const [claimTimeFrame, setClaimTimeFrame] = useState('')
  const [appealTimeFrame, setAppealTimeFrame] = useState('')
  const [drillDownData, setDrillDownData] = useState<{title: string, items: any[]}|null>(null)
  const [newClaimLoading, setNewClaimLoading] = useState(false)
  const [newClaim, setNewClaim] = useState({ patient: '', amount: '', payer: '', denialReason: '', deniedDate: '', deadline: '', patientEmail: '', patientPhone: '', serviceDate: '', serviceCode: '', diagnosisCode: '' })

  useEffect(() => { const token = localStorage.getItem('token'); const savedUser = localStorage.getItem('user'); if (token && savedUser) { setUser(JSON.parse(savedUser)) } setCheckingAuth(false) }, [])
  useEffect(() => { if (user) { fetchData() } }, [user])

  const fetchData = async () => { try { const [claimsData, appealsData, payersData] = await Promise.all([api.getClaims(), api.getAppeals(), api.getPayers()]); setClaims(claimsData); setAppeals(appealsData); setPayers(payersData) } catch (error) { console.error('Failed to fetch data:', error) } finally { setLoading(false) } }

  const handleLogin = async (e: React.FormEvent) => { e.preventDefault(); setAuthError(''); setAuthLoading(true); try { const result = await api.login(authEmail, authPassword); if (result.error) { setAuthError(result.error) } else { localStorage.setItem('token', result.token); localStorage.setItem('user', JSON.stringify(result.user)); setUser(result.user); setAuthEmail(''); setAuthPassword('') } } catch (err) { setAuthError('Login failed. Please try again.') } finally { setAuthLoading(false) } }

  const handleRegister = async (e: React.FormEvent) => { e.preventDefault(); setAuthError(''); setAuthLoading(true); try { const result = await api.register(authEmail, authPassword, authName); if (result.error) { setAuthError(result.error) } else { localStorage.setItem('token', result.token); localStorage.setItem('user', JSON.stringify(result.user)); setUser(result.user); setAuthEmail(''); setAuthPassword(''); setAuthName('') } } catch (err) { setAuthError('Registration failed. Please try again.') } finally { setAuthLoading(false) } }

  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); setClaims([]); setAppeals([]); setLoading(true) }
  const showNotification = (message: string) => { setNotification(message); setTimeout(() => setNotification(null), 3000) }

  const generateAppeal = async (claim: Claim) => { setSelectedClaim(claim); setViewingClaim(null); setIsGenerating(true); setAppealLetter(''); try { const { letter } = await api.generateAppeal(claim); setAppealLetter(letter) } catch (error) { console.error('Failed to generate appeal:', error); setAppealLetter('Error generating appeal. Please try again.') } finally { setIsGenerating(false) } }

  const submitAppeal = async () => { if (!selectedClaim) return; try { const newAppeal = await api.createAppeal({ claimId: selectedClaim.id, patient: selectedClaim.patient, amount: selectedClaim.amount, payer: selectedClaim.payer }); setAppeals([newAppeal, ...appeals]); setClaims(claims.map(c => c.id === selectedClaim.id ? { ...c, status: 'appealed' } : c)); closeModal(); showNotification('Appeal ' + newAppeal.id + ' submitted successfully!') } catch (error) { console.error('Failed to submit appeal:', error); showNotification('Error submitting appeal. Please try again.') } }

  const closeModal = () => { setSelectedClaim(null); setAppealLetter('') }

  const resetNewClaimForm = () => { setNewClaim({ patient: '', amount: '', payer: '', denialReason: '', deniedDate: '', deadline: '', patientEmail: '', patientPhone: '', serviceDate: '', serviceCode: '', diagnosisCode: '' }) }

  const handleNewClaimSubmit = async () => { if (!newClaim.patient || !newClaim.amount || !newClaim.payer || !newClaim.denialReason || !newClaim.deniedDate || !newClaim.deadline) { showNotification('Please fill in all required fields.'); return } setNewClaimLoading(true); try { const created = await api.createClaim({ patient: newClaim.patient, amount: parseFloat(newClaim.amount), payer: newClaim.payer, denialReason: newClaim.denialReason, deniedDate: newClaim.deniedDate, deadline: newClaim.deadline, patientEmail: newClaim.patientEmail || undefined, patientPhone: newClaim.patientPhone || undefined, serviceDate: newClaim.serviceDate || undefined, serviceCode: newClaim.serviceCode || undefined, diagnosisCode: newClaim.diagnosisCode || undefined }); setClaims([created, ...claims]); setShowNewClaimModal(false); resetNewClaimForm(); showNotification('Claim ' + created.id + ' created successfully!') } catch (error) { console.error('Failed to create claim:', error); showNotification('Error creating claim. Please try again.') } finally { setNewClaimLoading(false) } }

  const getTimeFrameDate = (tf: string): Date | null => {
    const now = new Date()
    switch(tf) {
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case '14d': return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      case '21d': return new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case '60d': return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      case 'ytd': return new Date(now.getFullYear(), 0, 1)
      case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      case '2y': return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
      case '3y': return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate())
      default: return null
    }
  }

  const timeFrameOptions = [
    { value: '', label: 'All Time' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '14d', label: 'Last 2 Weeks' },
    { value: '21d', label: 'Last 3 Weeks' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '60d', label: 'Last 2 Months' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '6m', label: 'Last 6 Months' },
    { value: 'ytd', label: 'Year to Date' },
    { value: '1y', label: 'Last Year' },
    { value: '2y', label: 'Last 2 Years' },
    { value: '3y', label: 'Last 3 Years' },
  ]

  const claimStatuses = [...new Set(claims.map(c => c.status))]

  const filteredClaims = claims.filter(claim => { const matchesSearch = claimSearch === '' || claim.id.toLowerCase().includes(claimSearch.toLowerCase()) || claim.patient.toLowerCase().includes(claimSearch.toLowerCase()); const matchesPayer = claimPayerFilter === '' || claim.payer === claimPayerFilter; const matchesStatus = claimStatusFilter === '' || claim.status === claimStatusFilter; const tfDate = getTimeFrameDate(claimTimeFrame); const matchesTimeFrame = !tfDate || (claim.deniedDate && new Date(claim.deniedDate) >= tfDate); const matchesDate = claimDateFilter === '' || (claim.deniedDate && claim.deniedDate.startsWith(claimDateFilter)); return matchesSearch && matchesPayer && matchesStatus && matchesTimeFrame && matchesDate })

  const filteredAppeals = appeals.filter(appeal => { const matchesSearch = appealSearch === '' || appeal.id.toLowerCase().includes(appealSearch.toLowerCase()) || appeal.claimId.toLowerCase().includes(appealSearch.toLowerCase()) || appeal.patient.toLowerCase().includes(appealSearch.toLowerCase()); const matchesPayer = appealPayerFilter === '' || appeal.payer === appealPayerFilter; const matchesStatus = appealFilter === 'all' || appeal.status === appealFilter; const tfDate = getTimeFrameDate(appealTimeFrame); const matchesTimeFrame = !tfDate || (appeal.submittedDate && new Date(appeal.submittedDate) >= tfDate); return matchesSearch && matchesPayer && matchesStatus && matchesTimeFrame })

  const totalDenied = claims.reduce((sum, c) => sum + c.amount, 0)
  const approvedAppeals = appeals.filter(a => a.status === 'approved')
  const totalRecovered = approvedAppeals.reduce((sum, a) => sum + (a.recoveredAmount || 0), 0)
  const decidedAppeals = appeals.filter(a => a.status === 'approved' || a.status === 'denied')
  const successRate = decidedAppeals.length > 0 ? Math.round((approvedAppeals.length / decidedAppeals.length) * 100) : 0
  const appealStats = { total: appeals.length, pending: appeals.filter(a => a.status === 'pending').length, inReview: appeals.filter(a => a.status === 'in-review').length, approved: approvedAppeals.length, denied: appeals.filter(a => a.status === 'denied').length, totalRecovered }
  const uniquePayers = [...new Set(claims.map(c => c.payer))]
  const commonDenialReasons = ['Medical necessity', 'Prior auth missing', 'Coding error', 'Timely filing', 'Duplicate claim', 'Out of network', 'Benefit exclusion', 'Coordination of benefits', 'Incomplete documentation', 'Other']

  const getStatusStyle = (status: string) => { switch (status) { case 'approved': return 'bg-emerald-500/20 text-emerald-400'; case 'denied': return 'bg-red-500/20 text-red-400'; case 'in-review': return 'bg-yellow-500/20 text-yellow-400'; case 'pending': return 'bg-blue-500/20 text-blue-400'; case 'appealed': return 'bg-purple-500/20 text-purple-400'; case 'urgent': return 'bg-red-500/20 text-red-400'; case 'in-progress': return 'bg-blue-500/20 text-blue-400'; default: return 'bg-slate-600 text-slate-300' } }
  const formatDate = (dateString: string) => { if (!dateString) return '—'; const date = new Date(dateString); return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

  if (checkingAuth) { return (<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center"><div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div></div>) }

  if (!user) { return (<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4"><div className="bg-slate-800 rounded-lg p-8 w-full max-w-md"><h1 className="text-2xl font-bold text-emerald-400 mb-2 text-center">ClaimRx</h1><p className="text-slate-400 text-center mb-6">Medical Revenue Recovery System</p><div className="flex mb-6"><button onClick={() => { setAuthMode('login'); setAuthError('') }} className={'flex-1 py-2 text-center rounded-l-lg ' + (authMode === 'login' ? 'bg-emerald-600' : 'bg-slate-700')}>Login</button><button onClick={() => { setAuthMode('register'); setAuthError('') }} className={'flex-1 py-2 text-center rounded-r-lg ' + (authMode === 'register' ? 'bg-emerald-600' : 'bg-slate-700')}>Register</button></div><form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>{authMode === 'register' && (<div className="mb-4"><label className="block text-sm text-slate-400 mb-1">Name</label><input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="Your name" required /></div>)}<div className="mb-4"><label className="block text-sm text-slate-400 mb-1">Email</label><input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="you@example.com" required /></div><div className="mb-6"><label className="block text-sm text-slate-400 mb-1">Password</label><input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" required /></div>{authError && (<div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">{authError}</div>)}<button type="submit" disabled={authLoading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded font-medium disabled:opacity-50">{authLoading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}</button></form></div></div>) }

  if (loading) { return (<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-400">Loading ClaimRx...</p></div></div>) }

  const payerData = uniquePayers.map((name, i) => { const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']; const count = claims.filter(c => c.payer === name).length; return { name, value: Math.round((count / claims.length) * 100), color: colors[i % colors.length] } })

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {notification && (<div className="fixed top-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">{notification}</div>)}
      <div className="fixed left-0 top-0 h-full w-64 bg-slate-800 p-4">
        <h1 className="text-xl font-bold text-emerald-400 mb-2">ClaimRx</h1>
        <p className="text-sm text-slate-400 mb-6">Welcome, {user.name}</p>
        <nav className="space-y-2">
          {['dashboard', 'claims', 'appeals', 'analytics'].map((page) => (<button key={page} onClick={() => setActivePage(page)} className={'block w-full text-left px-4 py-2 rounded capitalize ' + (activePage === page ? 'bg-slate-700' : 'hover:bg-slate-700')}>{page}{page === 'appeals' && appealStats.pending > 0 && (<span className="ml-2 px-2 py-0.5 bg-blue-500 text-xs rounded-full">{appealStats.pending}</span>)}</button>))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 space-y-3">
          <div className="bg-slate-700/50 rounded-lg p-3 space-y-2"><div className="flex justify-between text-sm"><span className="text-slate-400">Claims</span><span>{claims.length}</span></div><div className="flex justify-between text-sm"><span className="text-slate-400">Appeals</span><span>{appeals.length}</span></div><div className="flex justify-between text-sm"><span className="text-slate-400">Recovered</span><span className="text-emerald-400">${totalRecovered.toLocaleString()}</span></div></div>
          <button onClick={handleLogout} className="w-full py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded">Sign Out</button>
        </div>
      </div>
      <div className="ml-64 p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold capitalize">{activePage}</h2>
          {activePage === 'claims' && (<button onClick={() => setShowNewClaimModal(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-medium flex items-center gap-2"><span className="text-lg leading-none">+</span> New Claim</button>)}
        </div>

        {activePage === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-slate-800 rounded-lg p-6 cursor-pointer hover:bg-slate-750 transition" onClick={() => { setActivePage('claims') }}><p className="text-slate-400 text-sm">Total Denied Claims</p><p className="text-3xl font-bold text-red-400">${totalDenied.toLocaleString()}</p><p className="text-sm text-slate-500 mt-1">{claims.length} claims</p></div>
              <div className="bg-slate-800 rounded-lg p-6 cursor-pointer hover:bg-slate-750 transition" onClick={() => { setActivePage('appeals'); setAppealFilter('approved') }}><p className="text-slate-400 text-sm">Total Recovered</p><p className="text-3xl font-bold text-emerald-400">${totalRecovered.toLocaleString()}</p><p className="text-sm text-slate-500 mt-1">{appealStats.approved} approved</p></div>
              <div className="bg-slate-800 rounded-lg p-6"><p className="text-slate-400 text-sm">Success Rate</p><p className="text-3xl font-bold text-blue-400">{successRate}%</p><p className="text-sm text-slate-500 mt-1">of decided appeals</p></div>
              <div className="bg-slate-800 rounded-lg p-6"><p className="text-slate-400 text-sm">Pending Appeals</p><p className="text-3xl font-bold text-yellow-400">{appealStats.pending + appealStats.inReview}</p><p className="text-sm text-slate-500 mt-1">awaiting decision</p></div>
            </div>
            <div className="grid grid-cols-5 gap-4">{payers.map(payer => { const payerAppeals = appeals.filter(a => a.payer === payer.name && a.daysToDecision != null); const avgDays = payerAppeals.length > 0 ? Math.round(payerAppeals.reduce((sum, a) => sum + (a.daysToDecision || 0), 0) / payerAppeals.length) : null; return (<div key={payer.id} className="bg-slate-800 rounded-lg p-4 cursor-pointer hover:bg-slate-750 transition" onClick={() => setViewingPayer(payer)}><p className="text-sm text-slate-400 mb-1">{payer.name}</p><div className="flex items-baseline gap-2">{avgDays != null ? (<><span className={'text-2xl font-bold ' + (avgDays <= payer.committedResponseDays ? 'text-emerald-400' : 'text-red-400')}>{avgDays}d</span><span className="text-slate-500 text-sm">avg to decision</span></>) : (<span className="text-slate-500">No decisions yet</span>)}</div></div>) })}
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-lg p-6"><h3 className="text-lg font-medium mb-4">Recent Claims</h3><div className="space-y-3">{claims.slice(0, 4).map(claim => (<div key={claim.id} className="flex justify-between items-center p-3 bg-slate-700/50 rounded cursor-pointer hover:bg-slate-700 transition" onClick={() => setViewingClaim(claim)}><div><p className="font-medium">{claim.patient}</p><p className="text-sm text-slate-400">{claim.payer} &bull; {claim.denialReason}</p></div><div className="text-right"><p className="text-red-400 font-medium">${claim.amount.toLocaleString()}</p><span className={'text-xs px-2 py-0.5 rounded ' + getStatusStyle(claim.status)}>{claim.status}</span></div></div>))}</div><button onClick={() => setActivePage('claims')} className="w-full mt-4 text-center text-sm text-emerald-400 hover:text-emerald-300">View all claims &rarr;</button></div>
              <div className="bg-slate-800 rounded-lg p-6"><h3 className="text-lg font-medium mb-4">Recent Appeals</h3><div className="space-y-3">{appeals.slice(0, 4).map(appeal => (<div key={appeal.id} className="flex justify-between items-center p-3 bg-slate-700/50 rounded"><div><p className="font-medium">{appeal.patient}</p><p className="text-sm text-slate-400">{appeal.payer} &bull; {formatDate(appeal.submittedDate)}</p></div><div className="text-right"><p className="font-medium">${appeal.amount.toLocaleString()}</p><span className={'text-xs px-2 py-0.5 rounded ' + getStatusStyle(appeal.status)}>{appeal.status}</span></div></div>))}</div><button onClick={() => setActivePage('appeals')} className="w-full mt-4 text-center text-sm text-emerald-400 hover:text-emerald-300">View all appeals &rarr;</button></div>
            </div>
          </div>
        )}

        {activePage === 'claims' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4 space-y-3"><div className="flex gap-3"><div className="flex-1"><input type="text" placeholder="Search by Claim ID or Patient Name..." value={claimSearch} onChange={(e) => setClaimSearch(e.target.value)} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm" /></div><select value={claimPayerFilter} onChange={(e) => setClaimPayerFilter(e.target.value)} className="px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"><option value="">All Payers</option>{uniquePayers.map(payer => (<option key={payer} value={payer}>{payer}</option>))}</select><select value={claimStatusFilter} onChange={(e) => setClaimStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"><option value="">All Statuses</option>{claimStatuses.map(s => (<option key={s} value={s}>{s}</option>))}</select><select value={claimTimeFrame} onChange={(e) => setClaimTimeFrame(e.target.value)} className="px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm">{timeFrameOptions.map(tf => (<option key={tf.value} value={tf.value}>{tf.label}</option>))}</select>{(claimSearch || claimPayerFilter || claimStatusFilter || claimTimeFrame || claimDateFilter) && (<button onClick={() => { setClaimSearch(''); setClaimPayerFilter(''); setClaimStatusFilter(''); setClaimTimeFrame(''); setClaimDateFilter('') }} className="px-3 py-2 text-slate-400 hover:text-white text-sm">Clear</button>)}</div>{(claimSearch || claimPayerFilter || claimStatusFilter || claimTimeFrame || claimDateFilter) && (<p className="text-sm text-slate-400">Showing {filteredClaims.length} of {claims.length} claims</p>)}</div>
            <div className="bg-slate-800 rounded-lg overflow-hidden"><table className="w-full"><thead className="bg-slate-700"><tr><th className="text-left p-4 font-medium text-sm">Claim ID</th><th className="text-left p-4 font-medium text-sm">Patient</th><th className="text-left p-4 font-medium text-sm">Amount</th><th className="text-left p-4 font-medium text-sm">Payer</th><th className="text-left p-4 font-medium text-sm">Denied Date</th><th className="text-left p-4 font-medium text-sm">Entered</th><th className="text-left p-4 font-medium text-sm">Denial Reason</th><th className="text-left p-4 font-medium text-sm">Status</th><th className="text-left p-4 font-medium text-sm">Action</th></tr></thead><tbody>{filteredClaims.map((claim) => (<tr key={claim.id} className="border-t border-slate-700 hover:bg-slate-750 cursor-pointer" onClick={() => setViewingClaim(claim)}><td className="p-4 font-mono text-sm">{claim.id}</td><td className="p-4 text-sm">{claim.patient}</td><td className="p-4 text-red-400 text-sm">${claim.amount.toLocaleString()}</td><td className="p-4 text-sm">{claim.payer}</td><td className="p-4 text-slate-400 text-sm">{formatDate(claim.deniedDate)}</td><td className="p-4 text-slate-400 text-sm">{formatDate(claim.serviceDate || '')}</td><td className="p-4 text-slate-400 text-sm">{claim.denialReason}</td><td className="p-4"><span className={'px-2 py-1 rounded text-xs font-medium ' + getStatusStyle(claim.status)}>{claim.status}</span></td><td className="p-4">{claim.status === 'appealed' ? (<span className="text-slate-500 text-sm">Appeal submitted</span>) : (<button onClick={(e) => { e.stopPropagation(); generateAppeal(claim) }} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-sm">Generate Appeal</button>)}</td></tr>))}</tbody></table>{filteredClaims.length === 0 && (<div className="p-8 text-center text-slate-400">No claims found</div>)}</div>
          </div>
        )}

        {activePage === 'appeals' && (
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-4">{[{ key: 'all', label: 'Total Appeals', value: appealStats.total, color: 'emerald' }, { key: 'pending', label: 'Pending', value: appealStats.pending, color: 'blue' }, { key: 'in-review', label: 'In Review', value: appealStats.inReview, color: 'yellow' }, { key: 'approved', label: 'Approved', value: appealStats.approved, color: 'emerald' }, { key: 'denied', label: 'Denied', value: appealStats.denied, color: 'red' }].map(stat => (<div key={stat.key} onClick={() => setAppealFilter(stat.key)} className={'bg-slate-800 rounded-lg p-4 cursor-pointer transition ' + (appealFilter === stat.key ? 'ring-2 ring-emerald-400' : 'hover:bg-slate-750')}><p className="text-slate-400 text-sm">{stat.label}</p><p className="text-2xl font-bold">{stat.value}</p></div>))}</div>
            <div className="bg-slate-800 rounded-lg p-4 space-y-3"><div className="flex gap-3"><div className="flex-1"><input type="text" placeholder="Search by Appeal ID, Claim ID, or Patient Name..." value={appealSearch} onChange={(e) => setAppealSearch(e.target.value)} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm" /></div><select value={appealPayerFilter} onChange={(e) => setAppealPayerFilter(e.target.value)} className="px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"><option value="">All Payers</option>{uniquePayers.map(payer => (<option key={payer} value={payer}>{payer}</option>))}</select><select value={appealTimeFrame} onChange={(e) => setAppealTimeFrame(e.target.value)} className="px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm">{timeFrameOptions.map(tf => (<option key={tf.value} value={tf.value}>{tf.label}</option>))}</select>{(appealSearch || appealPayerFilter || appealTimeFrame || appealFilter !== 'all') && (<button onClick={() => { setAppealSearch(''); setAppealPayerFilter(''); setAppealTimeFrame(''); setAppealFilter('all') }} className="px-3 py-2 text-slate-400 hover:text-white text-sm">Clear All</button>)}</div>{(appealSearch || appealPayerFilter || appealTimeFrame || appealFilter !== 'all') && (<p className="text-sm text-slate-400">Showing {filteredAppeals.length} of {appeals.length} appeals</p>)}</div>
            <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-600/5 border border-emerald-500/30 rounded-lg p-4 flex justify-between items-center"><div><p className="text-emerald-400 font-medium">Total Recovered from Appeals</p><p className="text-sm text-slate-400">From {appealStats.approved} approved appeals</p></div><p className="text-3xl font-bold text-emerald-400">${appealStats.totalRecovered.toLocaleString()}</p></div>
            <div className="bg-slate-800 rounded-lg overflow-hidden"><table className="w-full"><thead className="bg-slate-700"><tr><th className="text-left p-4 font-medium">Appeal ID</th><th className="text-left p-4 font-medium">Patient</th><th className="text-left p-4 font-medium">Payer</th><th className="text-left p-4 font-medium">Amount</th><th className="text-left p-4 font-medium">Submitted</th><th className="text-left p-4 font-medium">Decided</th><th className="text-left p-4 font-medium">Days</th><th className="text-left p-4 font-medium">Status</th><th className="text-left p-4 font-medium">Recovered</th></tr></thead><tbody>{filteredAppeals.map((appeal) => (<tr key={appeal.id} className="border-t border-slate-700 hover:bg-slate-750 cursor-pointer" onClick={() => { const claim = claims.find(c => c.id === appeal.claimId); if (claim) setViewingClaim(claim) }}><td className="p-4 font-mono text-sm">{appeal.id}</td><td className="p-4">{appeal.patient}</td><td className="p-4">{appeal.payer}</td><td className="p-4">${appeal.amount.toLocaleString()}</td><td className="p-4 text-slate-400">{formatDate(appeal.submittedDate)}</td><td className="p-4 text-slate-400">{appeal.decidedDate ? formatDate(appeal.decidedDate) : '—'}</td><td className="p-4">{appeal.daysToDecision != null ? (<span className={appeal.daysToDecision <= 20 ? 'text-emerald-400 font-medium' : appeal.daysToDecision <= 30 ? 'text-yellow-400 font-medium' : 'text-red-400 font-medium'}>{appeal.daysToDecision}d</span>) : (<span className="text-slate-500">—</span>)}</td><td className="p-4"><span className={'px-2 py-1 rounded text-xs font-medium ' + getStatusStyle(appeal.status)}>{appeal.status}</span></td><td className="p-4">{appeal.status === 'approved' ? (<span className="text-emerald-400 font-medium">${appeal.recoveredAmount?.toLocaleString()}</span>) : appeal.status === 'denied' ? (<span className="text-red-400">$0</span>) : (<span className="text-slate-500">—</span>)}</td></tr>))}</tbody></table>{filteredAppeals.length === 0 && (<div className="p-8 text-center text-slate-400">No appeals found</div>)}</div>
          </div>
        )}

        {activePage === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 cursor-pointer hover:bg-slate-750 transition" onClick={() => setDrillDownData({title: 'All Appeals', items: appeals})}><p className="text-slate-400 text-sm">Total Appeals</p><p className="text-2xl font-bold">{appeals.length}</p></div>
              <div className="bg-slate-800 rounded-lg p-4 cursor-pointer hover:bg-slate-750 transition" onClick={() => setDrillDownData({title: 'Approved Appeals', items: appeals.filter(a => a.status === 'approved')})}><p className="text-slate-400 text-sm">Won Appeals</p><p className="text-2xl font-bold text-emerald-400">{appealStats.approved}</p></div>
              <div className="bg-slate-800 rounded-lg p-4"><p className="text-slate-400 text-sm">Win Rate</p><p className="text-2xl font-bold text-blue-400">{successRate}%</p></div>
              <div className="bg-slate-800 rounded-lg p-4"><p className="text-slate-400 text-sm">Avg Recovery</p><p className="text-2xl font-bold text-emerald-400">${appealStats.approved > 0 ? Math.round(appealStats.totalRecovered / appealStats.approved).toLocaleString() : 0}</p></div>
            </div>
            <div className="bg-slate-800 rounded-lg p-6"><h3 className="text-lg font-medium mb-4">Avg Days to Decision by Payer</h3><ResponsiveContainer width="100%" height={280}><BarChart data={payers.map(p => { const pa = appeals.filter(a => a.payer === p.name && a.daysToDecision != null); const avg = pa.length > 0 ? Math.round(pa.reduce((s, a) => s + (a.daysToDecision || 0), 0) / pa.length) : 0; return { name: p.name, avgDays: avg, committed: p.committedResponseDays, appeals: pa.length } })} onClick={(data: any) => { if (data && data.activePayload) { const pName = data.activePayload[0].payload.name; setDrillDownData({title: pName + ' Appeals', items: appeals.filter(a => a.payer === pName)}) } }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="name" stroke="#94a3b8" /><YAxis stroke="#94a3b8" tickFormatter={(v) => v + 'd'} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} formatter={(value: any, name: any) => [value + ' days', name === 'avgDays' ? 'Avg Response' : 'Committed']} /><Bar dataKey="avgDays" fill="#10b981" name="avgDays" radius={[4, 4, 0, 0]} /><Bar dataKey="committed" fill="#334155" name="committed" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer><p className="text-xs text-slate-500 mt-2 text-center">Click any bar to see that payer's appeals</p></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-lg p-6"><h3 className="text-lg font-medium mb-4">Denied vs Recovered (6 Months)</h3><ResponsiveContainer width="100%" height={250}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="month" stroke="#94a3b8" /><YAxis stroke="#94a3b8" tickFormatter={(v) => '$' + v/1000 + 'k'} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} /><Bar dataKey="denied" fill="#ef4444" name="Denied" radius={[4, 4, 0, 0]} /><Bar dataKey="recovered" fill="#10b981" name="Recovered" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              <div className="bg-slate-800 rounded-lg p-6"><h3 className="text-lg font-medium mb-4">Recovery Rate Trend</h3><ResponsiveContainer width="100%" height={250}><LineChart data={monthlyData.map(d => ({ ...d, rate: Math.round((d.recovered / d.denied) * 100) }))}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="month" stroke="#94a3b8" /><YAxis stroke="#94a3b8" tickFormatter={(v) => v + '%'} domain={[0, 100]} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} /><Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} /></LineChart></ResponsiveContainer></div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-lg p-6"><h3 className="text-lg font-medium mb-4">Denials by Payer</h3><div className="flex items-center"><ResponsiveContainer width="60%" height={200}><PieChart><Pie data={payerData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" onClick={(data) => { if (data && data.name) { setDrillDownData({title: data.name + ' Claims', items: claims.filter(c => c.payer === data.name)}) } }}>{payerData.map((entry, index) => (<Cell key={'cell-' + index} fill={entry.color} className="cursor-pointer" />))}</Pie><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} /></PieChart></ResponsiveContainer><div className="space-y-2">{payerData.map((payer) => (<div key={payer.name} className="flex items-center gap-2 text-sm cursor-pointer hover:text-white" onClick={() => setDrillDownData({title: payer.name + ' Claims', items: claims.filter(c => c.payer === payer.name)})}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: payer.color }}></div><span className="text-slate-300">{payer.name}</span><span className="text-slate-500">{payer.value}%</span></div>))}</div></div><p className="text-xs text-slate-500 mt-2 text-center">Click any segment or label to see claims</p></div>
              <div className="bg-slate-800 rounded-lg p-6"><h3 className="text-lg font-medium mb-4">Appeal Success by Denial Reason</h3><div className="space-y-3">{denialReasons.map((item) => (<div key={item.reason} className="cursor-pointer" onClick={() => setDrillDownData({title: item.reason + ' Claims', items: claims.filter(c => c.denialReason.toLowerCase().includes(item.reason.toLowerCase().split(' ')[0]))})}><div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{item.reason}</span><span className="text-slate-400">{item.success}% success</span></div><div className="h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: item.success + '%' }}></div></div></div>))}</div><p className="text-xs text-slate-500 mt-2 text-center">Click any reason to see related claims</p></div>
            </div>
          </div>
        )}
      </div>

      {viewingClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center"><div><h3 className="text-lg font-semibold">Claim Details &mdash; {viewingClaim.id}</h3><span className={'text-xs px-2 py-0.5 rounded ' + getStatusStyle(viewingClaim.status)}>{viewingClaim.status}</span></div><button onClick={() => setViewingClaim(null)} className="text-slate-400 hover:text-white text-2xl">&times;</button></div>
            <div className="p-4 overflow-y-auto flex-1 space-y-6">
              <div><h4 className="text-sm font-medium text-slate-400 mb-3">Claim Information</h4><div className="grid grid-cols-2 gap-4 bg-slate-700/50 rounded-lg p-4"><div><p className="text-xs text-slate-500">Amount</p><p className="text-lg font-bold text-red-400">${viewingClaim.amount.toLocaleString()}</p></div><div><p className="text-xs text-slate-500">Denial Reason</p><p className="font-medium">{viewingClaim.denialReason}</p></div><div><p className="text-xs text-slate-500">Denied Date</p><p>{formatDate(viewingClaim.deniedDate)}</p></div><div><p className="text-xs text-slate-500">Appeal Deadline</p><p>{formatDate(viewingClaim.deadline)}</p></div><div><p className="text-xs text-slate-500">Service Date</p><p>{formatDate(viewingClaim.serviceDate || '')}</p></div><div><p className="text-xs text-slate-500">Service Code</p><p>{viewingClaim.serviceCode || '—'}</p></div><div><p className="text-xs text-slate-500">Diagnosis Code</p><p>{viewingClaim.diagnosisCode || '—'}</p></div></div></div>
              <div><h4 className="text-sm font-medium text-slate-400 mb-3">Patient Information</h4><div className="bg-slate-700/50 rounded-lg p-4"><p className="font-medium text-lg mb-2">{viewingClaim.patient}</p><div className="flex gap-4">{viewingClaim.patientPhone && (<a href={'tel:' + viewingClaim.patientPhone} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300"><span>&#x1F4DE;</span><span>{viewingClaim.patientPhone}</span></a>)}{viewingClaim.patientEmail && (<a href={'mailto:' + viewingClaim.patientEmail} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300"><span>&#x2709;&#xFE0F;</span><span>{viewingClaim.patientEmail}</span></a>)}</div></div></div>
              <div><h4 className="text-sm font-medium text-slate-400 mb-3">Insurance Information</h4><div className="bg-slate-700/50 rounded-lg p-4"><div className="flex justify-between items-start mb-3"><p className="font-medium text-lg">{viewingClaim.payer}</p>{viewingClaim.payerAvgResponseDays && (<div className="text-right"><p className="text-xs text-slate-500">Avg Response</p><p className={'font-bold ' + ((viewingClaim.payerAvgResponseDays || 0) <= (viewingClaim.payerCommittedResponseDays || 30) ? 'text-emerald-400' : 'text-red-400')}>{viewingClaim.payerAvgResponseDays} days</p></div>)}</div><div className="grid grid-cols-2 gap-4">{viewingClaim.payerPhone && (<a href={'tel:' + viewingClaim.payerPhone} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-center justify-center"><span>&#x1F4DE;</span><span>Call Payer</span></a>)}{viewingClaim.payerFax && (<div className="flex items-center gap-2 px-4 py-2 bg-slate-600 rounded"><span>&#x1F4E0;</span><span>Fax: {viewingClaim.payerFax}</span></div>)}</div>{viewingClaim.payerAppealsAddress && (<div className="mt-3 text-sm text-slate-400"><p className="text-xs text-slate-500 mb-1">Appeals Address</p><p>{viewingClaim.payerAppealsAddress}</p></div>)}</div></div>
            </div>
            <div className="p-4 border-t border-slate-700 flex gap-3 justify-end"><button onClick={() => setViewingClaim(null)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Close</button>{viewingClaim.status !== 'appealed' && (<button onClick={() => generateAppeal(viewingClaim)} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Generate Appeal</button>)}</div>
          </div>
        </div>
      )}

      {viewingPayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg max-w-md w-full">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center"><h3 className="text-lg font-semibold">{viewingPayer.name}</h3><button onClick={() => setViewingPayer(null)} className="text-slate-400 hover:text-white text-2xl">&times;</button></div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center bg-slate-700/50 rounded-lg p-4"><div><p className="text-sm text-slate-400">Average Response Time</p><p className={'text-2xl font-bold ' + (viewingPayer.avgResponseDays <= viewingPayer.committedResponseDays ? 'text-emerald-400' : 'text-red-400')}>{viewingPayer.avgResponseDays} days</p></div><div className="text-right"><p className="text-sm text-slate-400">Committed</p><p className="text-2xl font-bold text-slate-300">{viewingPayer.committedResponseDays} days</p></div></div>
              <div className="space-y-3"><a href={'tel:' + viewingPayer.phone} className="flex items-center gap-3 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded w-full justify-center"><span>&#x1F4DE;</span><span>Call: {viewingPayer.phone}</span></a><div className="flex items-center gap-3 px-4 py-3 bg-slate-700 rounded"><span>&#x1F4E0;</span><span>Fax: {viewingPayer.fax}</span></div><a href={'mailto:' + viewingPayer.email} className="flex items-center gap-3 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded w-full"><span>&#x2709;&#xFE0F;</span><span>{viewingPayer.email}</span></a>{viewingPayer.website && (<a href={viewingPayer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded w-full justify-center"><span>&#x1F310;</span><span>{viewingPayer.website}</span></a>)}</div>
              {viewingPayer.appealsAddress && (<div className="text-sm text-slate-400 bg-slate-700/50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Appeals Address</p><p>{viewingPayer.appealsAddress}</p></div>)}
            </div>
            <div className="p-4 border-t border-slate-700"><button onClick={() => setViewingPayer(null)} className="w-full px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Close</button></div>
          </div>
        </div>
      )}

      {selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center"><div><h3 className="text-lg font-semibold">Appeal for {selectedClaim.id}</h3><p className="text-sm text-slate-400">{selectedClaim.patient} &bull; {selectedClaim.payer} &bull; ${selectedClaim.amount.toLocaleString()}</p></div><button onClick={closeModal} className="text-slate-400 hover:text-white text-2xl">&times;</button></div>
            <div className="p-4 overflow-y-auto flex-1">{isGenerating ? (<div className="flex flex-col items-center justify-center py-12"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-slate-400">Generating appeal letter with AI...</p></div>) : (<div className="bg-slate-900 rounded p-4 font-mono text-sm whitespace-pre-wrap">{appealLetter}</div>)}</div>
            {!isGenerating && appealLetter && (<div className="p-4 border-t border-slate-700 flex gap-3 justify-end"><button onClick={closeModal} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Cancel</button><button onClick={() => { navigator.clipboard.writeText(appealLetter); showNotification('Copied!') }} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500">Copy to Clipboard</button><button onClick={submitAppeal} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Submit Appeal</button></div>)}
          </div>
        </div>
      )}

      {drillDownData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center"><div><h3 className="text-lg font-semibold">{drillDownData.title}</h3><p className="text-sm text-slate-400">{drillDownData.items.length} items</p></div><button onClick={() => setDrillDownData(null)} className="text-slate-400 hover:text-white text-2xl">×</button></div>
            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full"><thead className="bg-slate-700"><tr><th className="text-left p-3 font-medium text-sm">ID</th><th className="text-left p-3 font-medium text-sm">Patient</th><th className="text-left p-3 font-medium text-sm">Payer</th><th className="text-left p-3 font-medium text-sm">Amount</th><th className="text-left p-3 font-medium text-sm">Status</th>{drillDownData.items[0]?.daysToDecision !== undefined && <th className="text-left p-3 font-medium text-sm">Days</th>}{drillDownData.items[0]?.denialReason !== undefined && <th className="text-left p-3 font-medium text-sm">Reason</th>}</tr></thead>
              <tbody>{drillDownData.items.map((item: any) => (<tr key={item.id} className="border-t border-slate-700 hover:bg-slate-750 cursor-pointer" onClick={() => { if (item.denialReason) { setDrillDownData(null); setViewingClaim(item) } }}><td className="p-3 font-mono text-sm">{item.id}</td><td className="p-3">{item.patient}</td><td className="p-3">{item.payer}</td><td className="p-3">${item.amount?.toLocaleString()}</td><td className="p-3"><span className={'px-2 py-1 rounded text-xs font-medium ' + getStatusStyle(item.status)}>{item.status}</span></td>{item.daysToDecision !== undefined && <td className="p-3">{item.daysToDecision != null ? (<span className={item.daysToDecision <= 20 ? 'text-emerald-400' : item.daysToDecision <= 30 ? 'text-yellow-400' : 'text-red-400'}>{item.daysToDecision}d</span>) : '—'}</td>}{item.denialReason !== undefined && <td className="p-3 text-slate-400 text-sm">{item.denialReason}</td>}</tr>))}</tbody></table>
            </div>
            <div className="p-4 border-t border-slate-700"><button onClick={() => setDrillDownData(null)} className="w-full px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Close</button></div>
          </div>
        </div>
      )}

      {showNewClaimModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center"><div><h3 className="text-lg font-semibold">Submit New Denied Claim</h3><p className="text-sm text-slate-400">Enter the claim details from the denial notice</p></div><button onClick={() => { setShowNewClaimModal(false); resetNewClaimForm() }} className="text-slate-400 hover:text-white text-2xl">&times;</button></div>
            <div className="p-4 overflow-y-auto flex-1 space-y-5">
              <div><h4 className="text-sm font-medium text-emerald-400 mb-3">Required Information</h4><div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">Patient Name *</label><input type="text" value={newClaim.patient} onChange={(e) => setNewClaim({ ...newClaim, patient: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="e.g. John Smith" /></div>
                <div><label className="block text-sm text-slate-400 mb-1">Denied Amount *</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" value={newClaim.amount} onChange={(e) => setNewClaim({ ...newClaim, amount: e.target.value })} className="w-full pl-7 pr-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="0.00" min="0" step="0.01" /></div></div>
                <div><label className="block text-sm text-slate-400 mb-1">Payer *</label><select value={newClaim.payer} onChange={(e) => setNewClaim({ ...newClaim, payer: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none"><option value="">Select payer...</option>{payers.map(p => (<option key={p.id} value={p.name}>{p.name}</option>))}</select></div>
                <div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">Denial Reason *</label><select value={newClaim.denialReason} onChange={(e) => setNewClaim({ ...newClaim, denialReason: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none"><option value="">Select reason...</option>{commonDenialReasons.map(reason => (<option key={reason} value={reason}>{reason}</option>))}</select></div>
                <div><label className="block text-sm text-slate-400 mb-1">Denied Date *</label><input type="date" value={newClaim.deniedDate} onChange={(e) => setNewClaim({ ...newClaim, deniedDate: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-slate-400 mb-1">Appeal Deadline *</label><input type="date" value={newClaim.deadline} onChange={(e) => setNewClaim({ ...newClaim, deadline: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" /></div>
              </div></div>
              <div><h4 className="text-sm font-medium text-slate-400 mb-3">Optional Details</h4><div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-slate-400 mb-1">Patient Email</label><input type="email" value={newClaim.patientEmail} onChange={(e) => setNewClaim({ ...newClaim, patientEmail: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="patient@email.com" /></div>
                <div><label className="block text-sm text-slate-400 mb-1">Patient Phone</label><input type="tel" value={newClaim.patientPhone} onChange={(e) => setNewClaim({ ...newClaim, patientPhone: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="(555) 123-4567" /></div>
                <div><label className="block text-sm text-slate-400 mb-1">Service Date</label><input type="date" value={newClaim.serviceDate} onChange={(e) => setNewClaim({ ...newClaim, serviceDate: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-slate-400 mb-1">Service Code (CPT)</label><input type="text" value={newClaim.serviceCode} onChange={(e) => setNewClaim({ ...newClaim, serviceCode: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="e.g. 99213" /></div>
                <div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">Diagnosis Code (ICD-10)</label><input type="text" value={newClaim.diagnosisCode} onChange={(e) => setNewClaim({ ...newClaim, diagnosisCode: e.target.value })} className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="e.g. M54.5" /></div>
              </div></div>
            </div>
            <div className="p-4 border-t border-slate-700 flex gap-3 justify-end"><button onClick={() => { setShowNewClaimModal(false); resetNewClaimForm() }} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Cancel</button><button onClick={handleNewClaimSubmit} disabled={newClaimLoading} className="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-medium disabled:opacity-50">{newClaimLoading ? 'Creating...' : 'Create Claim'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

