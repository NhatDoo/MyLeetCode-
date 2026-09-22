import { useEffect, useState } from 'react'
import { AuthPage } from './components/AuthPage'
import { ChallengeWorkspace } from './components/ChallengeWorkspace'
import { ProblemBrowser } from './components/ProblemBrowser'
import { getCurrentUser, login, logout, refreshSession, register } from './lib/authApi'
import { listProblems } from './lib/problemApi'
import type { AuthUser, Problem } from './types'
import './App.css'

const ACCESS_TOKEN_KEY = 'myleetcode_access_token'

type AuthMode = 'login' | 'register'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [problemList, setProblemList] = useState<Problem[]>([])
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [isLoading, setIsLoading] = useState(true)
  const [problemError, setProblemError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      try {
        const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY)
        const accessToken = storedToken ?? await refreshSession()
        const currentUser = await getCurrentUser(accessToken)
        if (isMounted) {
          localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
          setUser(currentUser)
        }
      } catch {
        localStorage.removeItem(ACCESS_TOKEN_KEY)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void restoreSession()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    if (!user) return
    let isMounted = true
    async function loadProblems() {
      try {
        const backendProblems = await listProblems()
        if (isMounted) {
          setProblemList(backendProblems)
          setActiveProblem(backendProblems[0] ?? null)
        }
      } catch (error) {
        if (isMounted) setProblemError(error instanceof Error ? error.message : 'Unable to load problems')
      }
    }
    void loadProblems()
    return () => { isMounted = false }
  }, [user])

  async function handleAuth(email: string, password: string) {
    const accessToken = authMode === 'login' ? await login(email, password) : await register(email, password)
    const currentUser = await getCurrentUser(accessToken)
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    setUser(currentUser)
  }

  async function handleLogout() {
    try { await logout() } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      setUser(null)
      setAuthMode('login')
    }
  }

  if (isLoading) return <div className="auth-loading"><span className="brand-mark">M</span><span>Loading your workspace...</span></div>
  if (!user) return <AuthPage mode={authMode} onModeChange={setAuthMode} onSubmit={handleAuth} />

  const initials = user.email.slice(0, 2).toUpperCase()
  if (problemError) return <div className="empty-workspace"><span className="placeholder-icon">!</span><h2>Could not load problems</h2><p>{problemError}</p></div>
  if (!activeProblem) return <div className="empty-workspace"><span className="placeholder-icon">⌘</span><h2>No problems yet</h2><p>The backend is connected, but there are no problems in the database.</p></div>
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="MyLeetCode home"><span className="brand-mark">M</span><span>My<span>LeetCode</span></span></a>
      <nav className="topnav" aria-label="Primary navigation"><a className="active" href="#problems">Problems</a><a href="#study-plan">Study plan</a><a href="#discuss">Discuss</a></nav>
      <div className="top-actions"><button className="icon-button" aria-label="Toggle theme" title="Toggle theme">◐</button><button className="streak-button" type="button"><span>✦</span> 7 day streak</button><button className="avatar" onClick={() => void handleLogout()} aria-label={`Sign out ${user.email}`} title={`Sign out ${user.email}`}>{initials}</button></div>
    </header>
    <main className="workspace" id="top"><ProblemBrowser problems={problemList} activeId={activeProblem.id} onSelect={setActiveProblem} /><ChallengeWorkspace key={activeProblem.id} problem={activeProblem} accessToken={localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''} /></main>
  </div>
}

export default App
