import { useState, type FormEvent } from 'react'

type AuthMode = 'login' | 'register'

type AuthPageProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onSubmit: (email: string, password: string) => Promise<void>
}

export function AuthPage({ mode, onModeChange, onSubmit }: AuthPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit(email, password)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to continue')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <a className="brand auth-brand" href="#top"><span className="brand-mark">M</span><span>My<span>LeetCode</span></span></a>
        <div className="showcase-copy"><p className="eyebrow">Build your edge</p><h1>Practice with<br /><em>purpose.</em></h1><p>Sharpen your problem-solving skills one thoughtful solution at a time.</p></div>
        <div className="showcase-note"><span>✦</span><p><strong>One workspace</strong><br />for every challenge</p></div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-heading"><p className="eyebrow">Welcome back</p><h2>{mode === 'login' ? 'Sign in to solve' : 'Create your account'}</h2><p>{mode === 'login' ? 'Pick up where you left off.' : 'Your next breakthrough starts here.'}</p></div>
          <div className="auth-switch"><button className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')} type="button">Sign in</button><button className={mode === 'register' ? 'active' : ''} onClick={() => onModeChange('register')} type="button">Register</button></div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            <label>Password<div className="password-field"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /><span>⌁</span></div></label>
            {mode === 'register' && <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" autoComplete="new-password" minLength={8} required /></label>}
            {mode === 'login' && <button className="forgot-button" type="button">Forgot password?</button>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Connecting...' : mode === 'login' ? 'Continue to workspace' : 'Create account'} <span>→</span></button>
          </form>
          <p className="auth-legal">By continuing, you agree to our <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</p>
        </div>
      </section>
    </main>
  )
}
