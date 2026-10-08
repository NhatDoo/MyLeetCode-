import { useState, type FormEvent } from 'react'
import { localize, type Locale } from '../lib/i18n'

type AuthMode = 'login' | 'register'

type AuthPageProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onSubmit: (email: string, password: string) => Promise<void>
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function AuthPage({ mode, onModeChange, onSubmit, locale, onLocaleChange }: AuthPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (mode === 'register' && password !== confirmPassword) {
      setError(localize(locale, 'Passwords do not match', 'Mật khẩu xác nhận không khớp'))
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit(email, password)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : localize(locale, 'Unable to continue', 'Không thể tiếp tục'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <a className="brand auth-brand" href="#top"><span className="brand-mark">M</span><span>My<span>LeetCode</span></span></a>
        <div className="showcase-copy"><p className="eyebrow">{localize(locale, 'Build your edge', 'Rèn tư duy sắc bén')}</p><h1>{localize(locale, 'Practice with', 'Luyện tập')}<br /><em>{localize(locale, 'purpose.', 'mục tiêu.')}</em></h1><p>{localize(locale, 'Sharpen your problem-solving skills one thoughtful solution at a time.', 'Nâng cao kỹ năng giải quyết vấn đề qua từng lời giải chỉn chu.')}</p></div>
        <div className="showcase-note"><span>✦</span><p><strong>{localize(locale, 'One workspace', 'Một không gian')}</strong><br />{localize(locale, 'for every challenge', 'cho mọi thử thách')}</p></div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <label className="language-select auth-language"><span className="sr-only">{localize(locale, 'Language', 'Ngôn ngữ')}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)} aria-label={localize(locale, 'Language', 'Ngôn ngữ')}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
          <div className="auth-heading"><p className="eyebrow">{localize(locale, 'Welcome back', 'Chào mừng trở lại')}</p><h2>{localize(locale, mode === 'login' ? 'Sign in to solve' : 'Create your account', mode === 'login' ? 'Đăng nhập để luyện tập' : 'Tạo tài khoản')}</h2><p>{localize(locale, mode === 'login' ? 'Pick up where you left off.' : 'Your next breakthrough starts here.', mode === 'login' ? 'Tiếp tục hành trình bạn đang dang dở.' : 'Bắt đầu chinh phục thử thách tiếp theo.')}</p></div>
          <div className="auth-switch"><button className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')} type="button">{localize(locale, 'Sign in', 'Đăng nhập')}</button><button className={mode === 'register' ? 'active' : ''} onClick={() => onModeChange('register')} type="button">{localize(locale, 'Register', 'Đăng ký')}</button></div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>{localize(locale, 'Email address', 'Địa chỉ email')}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            <label>{localize(locale, 'Password', 'Mật khẩu')}<div className="password-field"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={localize(locale, 'At least 8 characters', 'Ít nhất 8 ký tự')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /><span>⌁</span></div></label>
            {mode === 'register' && <label>{localize(locale, 'Confirm password', 'Xác nhận mật khẩu')}<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={localize(locale, 'Repeat your password', 'Nhập lại mật khẩu')} autoComplete="new-password" minLength={8} required /></label>}
            {mode === 'login' && <button className="forgot-button" type="button">{localize(locale, 'Forgot password?', 'Quên mật khẩu?')}</button>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>{localize(locale, isSubmitting ? 'Connecting...' : mode === 'login' ? 'Continue to workspace' : 'Create account', isSubmitting ? 'Đang kết nối...' : mode === 'login' ? 'Vào không gian luyện tập' : 'Tạo tài khoản')} <span>→</span></button>
          </form>
          <p className="auth-legal">{localize(locale, 'By continuing, you agree to our', 'Khi tiếp tục, bạn đồng ý với')} <a href="#terms">{localize(locale, 'Terms of Service', 'Điều khoản dịch vụ')}</a> {localize(locale, 'and', 'và')} <a href="#privacy">{localize(locale, 'Privacy Policy', 'Chính sách quyền riêng tư')}</a>.</p>
        </div>
      </section>
    </main>
  )
}
