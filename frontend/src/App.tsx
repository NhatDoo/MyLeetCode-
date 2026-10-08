import { useEffect, useState } from 'react'
import { AuthPage } from './components/AuthPage'
import { AdminPage } from './components/AdminPage'
import { ChallengeWorkspace } from './components/ChallengeWorkspace'
import { DiscussPage } from './components/DiscussPage'
import { ProblemBrowser } from './components/ProblemBrowser'
import { StudyPlanPage } from './components/StudyPlanPage'
import { getCurrentUser, login, logout, refreshSession, register } from './lib/authApi'
import { checkAdminAccess } from './lib/adminApi'
import { localize, type Locale } from './lib/i18n'
import { listProblems } from './lib/problemApi'
import type { AuthUser, Problem } from './types'
import './App.css'
import './Portal.css'

const ACCESS_TOKEN_KEY = 'myleetcode_access_token'
const LOCALE_KEY = 'myleetcode_locale'

type AuthMode = 'login' | 'register'
type Section = 'problems' | 'study-plan' | 'discuss' | 'admin'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [problemList, setProblemList] = useState<Problem[]>([])
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [isLoading, setIsLoading] = useState(true)
  const [problemError, setProblemError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [section, setSection] = useState<Section>('problems')
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem(LOCALE_KEY) === 'vi' ? 'vi' : 'en')

  function changeLocale(nextLocale: Locale) {
    localStorage.setItem(LOCALE_KEY, nextLocale)
    setLocale(nextLocale)
  }

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

  useEffect(() => {
    if (!user) return
    let isMounted = true
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''
    void checkAdminAccess(accessToken).then((allowed) => {
      if (isMounted) setIsAdmin(allowed)
    }).catch(() => {
      if (isMounted) setIsAdmin(false)
    })
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
      setIsAdmin(false)
      setSection('problems')
      setAuthMode('login')
    }
  }

  if (isLoading) return <div className="auth-loading"><span className="brand-mark">M</span><span>{localize(locale, 'Loading your workspace...', 'Đang tải không gian làm việc...')}</span></div>
  if (!user) return <AuthPage mode={authMode} onModeChange={setAuthMode} onSubmit={handleAuth} locale={locale} onLocaleChange={changeLocale} />

  const initials = user.email.slice(0, 2).toUpperCase()
  if (problemError) return <div className="empty-workspace"><span className="placeholder-icon">!</span><h2>{localize(locale, 'Could not load problems', 'Không thể tải bài tập')}</h2><p>{problemError}</p></div>
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="MyLeetCode home"><span className="brand-mark">M</span><span>My<span>LeetCode</span></span></a>
      <nav className="topnav" aria-label={localize(locale, 'Primary navigation', 'Điều hướng chính')}><button className={section === 'problems' ? 'active' : ''} type="button" onClick={() => setSection('problems')}>{localize(locale, 'Problems', 'Bài tập')}</button><button className={section === 'study-plan' ? 'active' : ''} type="button" onClick={() => setSection('study-plan')}>{localize(locale, 'Study plan', 'Lộ trình')}</button><button className={section === 'discuss' ? 'active' : ''} type="button" onClick={() => setSection('discuss')}>{localize(locale, 'Discuss', 'Thảo luận')}</button>{isAdmin && <button className={section === 'admin' ? 'active' : ''} type="button" onClick={() => setSection('admin')}>{localize(locale, 'Admin', 'Quản trị')}</button>}</nav>
      <div className="top-actions"><label className="language-select"><span className="sr-only">{localize(locale, 'Language', 'Ngôn ngữ')}</span><select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} aria-label={localize(locale, 'Language', 'Ngôn ngữ')}><option value="en">EN</option><option value="vi">VI</option></select></label><button className="streak-button" type="button"><span>✦</span> {localize(locale, '7 day streak', 'Chuỗi 7 ngày')}</button><button className="avatar" onClick={() => void handleLogout()} aria-label={`${localize(locale, 'Sign out', 'Đăng xuất')} ${user.email}`} title={`${localize(locale, 'Sign out', 'Đăng xuất')} ${user.email}`}>{initials}</button></div>
    </header>
    {section === 'problems' && (activeProblem ? <main className="workspace" id="top"><ProblemBrowser problems={problemList} activeId={activeProblem.id} onSelect={setActiveProblem} locale={locale} /><ChallengeWorkspace key={activeProblem.id} problem={activeProblem} accessToken={localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''} locale={locale} /></main> : <div className="empty-workspace"><span className="placeholder-icon">⌘</span><h2>{localize(locale, 'No problems yet', 'Chưa có bài tập')}</h2><p>{localize(locale, 'The backend is connected, but there are no problems in the database.', 'Backend đã kết nối nhưng cơ sở dữ liệu chưa có bài tập.')}</p></div>)}
    {section === 'discuss' && <DiscussPage problems={problemList} initialProblemId={activeProblem?.id ?? ''} accessToken={localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''} locale={locale} />}
    {section === 'study-plan' && <StudyPlanPage problems={problemList} userId={user.id} locale={locale} onSelectProblem={(problem) => { setActiveProblem(problem); setSection('problems') }} />}
    {section === 'admin' && isAdmin && <AdminPage accessToken={localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''} locale={locale} onProblemCreated={async () => { setProblemList(await listProblems()) }} onOpenProblem={(problemId) => { const createdProblem = problemList.find((problem) => problem.id === problemId); if (createdProblem) { setActiveProblem(createdProblem); setSection('problems') } }} />}
  </div>
}

export default App
