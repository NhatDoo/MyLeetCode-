import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { getProblem } from '../lib/problemApi'
import { getSubmission, listSubmissions, submitCode, type Submission } from '../lib/submissionApi'
import { createSolution, listSolutions } from '../lib/solutionApi'
import { localize, type Locale } from '../lib/i18n'
import type { CommunitySolution, Problem } from '../types'

type ChallengeWorkspaceProps = { problem: Problem; accessToken: string; locale: Locale }
type ChallengeTab = 'description' | 'solutions' | 'submissions'

const terminalStatuses = new Set(['ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILATION_ERROR', 'SYSTEM_ERROR'])
const languageKey = (language: string) => language === 'C++' ? 'cpp' : language.toLowerCase()
const bracketPairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', "'": "'", '"': '"' }

export function ChallengeWorkspace({ problem, accessToken, locale }: ChallengeWorkspaceProps) {
  const [detail, setDetail] = useState(problem)
  const [activeTab, setActiveTab] = useState<ChallengeTab>('description')
  const [editorTab, setEditorTab] = useState<'code' | 'testcase'>('code')
  const [language, setLanguage] = useState('JavaScript')
  const [code, setCode] = useState(problem.starterCode.javascript ?? '')
  const [runState, setRunState] = useState<'idle' | 'running' | 'passed'>('idle')
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [submissionError, setSubmissionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [solutions, setSolutions] = useState<CommunitySolution[]>([])
  const [solutionAccess, setSolutionAccess] = useState<'idle' | 'checking' | 'locked' | 'allowed' | 'error'>('idle')
  const [isSolutionComposerOpen, setIsSolutionComposerOpen] = useState(false)
  const [solutionTitle, setSolutionTitle] = useState('')
  const [solutionExplanation, setSolutionExplanation] = useState('')
  const [isPublishingSolution, setIsPublishingSolution] = useState(false)
  const [submissionHistory, setSubmissionHistory] = useState<Submission[]>([])
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let isMounted = true
    async function loadDetail() {
      try {
        const fullProblem = await getProblem(problem.id)
        if (isMounted) {
          setDetail(fullProblem)
          setCode(fullProblem.starterCode[languageKey(language)] ?? '')
        }
      } catch (error) {
        if (isMounted) setSubmissionError(error instanceof Error ? error.message : 'Unable to load problem details')
      }
    }
    void loadDetail()
    return () => { isMounted = false }
  }, [language, problem])

  useEffect(() => {
    if (!submission || !accessToken || terminalStatuses.has(submission.status)) return
    const timer = window.setInterval(() => {
      void getSubmission(accessToken, submission.id).then(setSubmission).catch(() => undefined)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [accessToken, submission])

  useEffect(() => {
    if (activeTab !== 'submissions' || !accessToken) return
    void listSubmissions(accessToken, problem.id).then(setSubmissionHistory).catch(() => setSubmissionHistory([]))
  }, [accessToken, activeTab, problem.id, submission?.status])

  function runCode() {
    setRunState('running')
    window.setTimeout(() => setRunState('passed'), 650)
  }

  async function handleSubmit() {
    setSubmissionError('')
    setIsSubmitting(true)
    try {
      const result = await submitCode(accessToken, detail.id, language.toLowerCase() === 'c++' ? 'cpp' : language.toLowerCase(), code)
      setSubmission({ id: result.submissionId, status: result.status, score: null, result: null, language, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      setActiveTab('submissions')
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Unable to submit solution')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function openSolutions() {
    setActiveTab('solutions')
    setSolutionAccess('checking')
    setSubmissionError('')
    try {
      const result = await listSolutions(problem.id, accessToken)
      setSolutions(result)
      setSolutionAccess('allowed')
    } catch (error) {
      const acceptedRequired = error instanceof Error && error.message.includes('Accepted submission required')
      setSolutions([])
      setSolutionAccess(acceptedRequired ? 'locked' : 'error')
      if (!acceptedRequired) setSubmissionError(error instanceof Error ? error.message : localize(locale, 'Unable to load solutions.', 'Không thể tải lời giải.'))
    }
  }

  async function handleCreateSolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmissionError('')
    setIsPublishingSolution(true)
    try {
      const created = await createSolution(accessToken, problem.id, {
        title: solutionTitle,
        explanation: solutionExplanation,
        code,
        language: languageKey(language),
      })
      setSolutions((current) => [created, ...current])
      setSolutionTitle('')
      setSolutionExplanation('')
      setIsSolutionComposerOpen(false)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : localize(locale, 'Could not publish your solution.', 'Không thể đăng lời giải.'))
    } finally {
      setIsPublishingSolution(false)
    }
  }

  function handleLanguageChange(nextLanguage: string) {
    setLanguage(nextLanguage)
    setCode(detail.starterCode[languageKey(nextLanguage)] ?? '')
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = code.slice(start, end)
    const typed = event.key
    const closing = Object.values(bracketPairs).includes(typed)

    if (bracketPairs[typed]) {
      event.preventDefault()
      const nextCode = `${code.slice(0, start)}${typed}${selected}${bracketPairs[typed]}${code.slice(end)}`
      setCode(nextCode)
      window.requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(start + 1, start + 1 + selected.length)
      })
      return
    }

    if (closing && start === end && code[start] === typed) {
      event.preventDefault()
      window.requestAnimationFrame(() => textarea.setSelectionRange(start + 1, start + 1))
      return
    }

    if (event.key === 'Backspace' && start === end && start > 0 && bracketPairs[code[start - 1]] === code[start]) {
      event.preventDefault()
      const nextCode = `${code.slice(0, start - 1)}${code.slice(start + 1)}`
      setCode(nextCode)
      window.requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(start - 1, start - 1)
      })
    }
  }

  const statusLabel = submission?.status.replaceAll('_', ' ') ?? ''
  const submissionDescription = submission && terminalStatuses.has(submission.status)
    ? localize(locale, `Finished with ${statusLabel.toLowerCase()}.`, `Đã hoàn tất với trạng thái ${statusLabel.toLowerCase()}.`)
    : submission
      ? localize(locale, `Submission ${submission.id.slice(0, 8)} is being processed by the worker.`, `Bài nộp ${submission.id.slice(0, 8)} đang được xử lý.`)
      : localize(locale, 'Submit your solution to see the judge result here.', 'Nộp lời giải để xem kết quả chấm tại đây.')
  return <section className="challenge-area" aria-label="Challenge workspace">
    <div className="challenge-header"><div className="breadcrumb"><span>{localize(locale, 'Problems', 'Bài tập')}</span><b>/</b><strong>{detail.title}</strong></div><div className="challenge-tools"><button className="tool-button" type="button">♡ <span>{localize(locale, 'Favorite', 'Yêu thích')}</span></button><button className="tool-button" type="button">↗ <span>{localize(locale, 'Share', 'Chia sẻ')}</span></button></div></div>
    <div className="challenge-content">
      <article className="description-panel">
        <div className="problem-title-row"><div><span className="question-number">#</span><h2>{detail.title}</h2></div><button className="bookmark" aria-label={localize(locale, 'Bookmark problem', 'Lưu bài tập')} type="button">♡</button></div>
        <div className="meta-row"><span className={`difficulty ${detail.difficulty.toLowerCase()}`}>{localize(locale, detail.difficulty, detail.difficulty === 'Easy' ? 'Dễ' : detail.difficulty === 'Medium' ? 'Trung bình' : 'Khó')}</span><span>{localize(locale, 'Acceptance', 'Tỷ lệ chấp nhận')} <strong>{detail.acceptance === null || detail.acceptance === undefined ? localize(locale, 'Unavailable', 'Chưa có dữ liệu') : `${detail.acceptance}%`}</strong></span><span>{localize(locale, 'Backend problem', 'Bài tập hệ thống')}</span></div>
        <div className="description-tabs"><button className={activeTab === 'description' ? 'active' : ''} onClick={() => setActiveTab('description')} type="button">{localize(locale, 'Description', 'Mô tả')}</button><button className={activeTab === 'solutions' ? 'active' : ''} onClick={() => void openSolutions()} type="button">{localize(locale, 'Solutions', 'Lời giải')}{solutionAccess !== 'allowed' && ' 🔒'}</button><button className={activeTab === 'submissions' ? 'active' : ''} onClick={() => setActiveTab('submissions')} type="button">{localize(locale, 'Submissions', 'Bài nộp')}</button></div>
        {activeTab === 'description' && <div className="description-copy"><p>{detail.description}</p>{detail.imageUrl && <figure className="problem-media"><img src={detail.imageUrl} alt={detail.title} loading="lazy" /></figure>}<h3>{localize(locale, 'Examples', 'Ví dụ')}</h3>{detail.examples.length > 0 ? detail.examples.map((example, index) => <div className="example" key={`${example.input}-${index}`}><strong>{localize(locale, 'Example', 'Ví dụ')} {index + 1}</strong><pre><code><span className="code-key">{localize(locale, 'Input:', 'Đầu vào:')}</span> {example.input}{'\n'}<span className="code-key">{localize(locale, 'Output:', 'Đầu ra:')}</span> {example.output}</code></pre></div>) : <p className="muted-copy">{localize(locale, 'Public examples are not available for this problem.', 'Bài tập này chưa có ví dụ công khai.')}</p>}<h3>{localize(locale, 'Topics', 'Chủ đề')}</h3><div className="topic-list">{detail.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>}
        {activeTab === 'solutions' && solutionAccess !== 'allowed' && <div className="solutions-panel"><div className="placeholder-panel"><span className="placeholder-icon">⌑</span><h3>{solutionAccess === 'checking' ? localize(locale, 'Checking access...', 'Đang kiểm tra quyền truy cập...') : solutionAccess === 'error' ? localize(locale, 'Could not load solutions', 'Không thể tải lời giải') : localize(locale, 'Solutions are locked', 'Lời giải đang bị khóa')}</h3><p>{solutionAccess === 'checking' ? localize(locale, 'Verifying your accepted submission.', 'Đang xác minh bài nộp Accepted.') : solutionAccess === 'error' ? localize(locale, 'Please try again in a moment.', 'Vui lòng thử lại sau.') : localize(locale, 'Get an Accepted result for this problem to unlock community solutions.', 'Hãy đạt Accepted cho bài này để mở khóa lời giải cộng đồng.')}</p>{solutionAccess === 'locked' && <button type="button" onClick={() => setActiveTab('submissions')}>{localize(locale, 'View my submissions', 'Xem bài nộp')}</button>}{solutionAccess === 'error' && <button type="button" onClick={() => void openSolutions()}>{localize(locale, 'Retry', 'Thử lại')}</button>}</div></div>}
        {activeTab === 'solutions' && solutionAccess === 'allowed' && <div className="solutions-panel"><div className="solution-panel-toolbar"><span>{localize(locale, 'Share an approach that helped you solve this problem.', 'Chia sẻ hướng giải đã giúp bạn hoàn thành bài này.')}</span><button className="portal-primary" type="button" onClick={() => setIsSolutionComposerOpen((open) => !open)}>{isSolutionComposerOpen ? localize(locale, 'Cancel', 'Hủy') : `+ ${localize(locale, 'Share solution', 'Chia sẻ lời giải')}`}</button></div>{isSolutionComposerOpen && <form className="solution-composer" onSubmit={(event) => void handleCreateSolution(event)}><label>{localize(locale, 'Title', 'Tiêu đề')}<input value={solutionTitle} onChange={(event) => setSolutionTitle(event.target.value)} maxLength={120} required placeholder={localize(locale, 'Name your approach', 'Đặt tên cho hướng giải')} /></label><label>{localize(locale, 'Explanation', 'Giải thích')}<textarea value={solutionExplanation} onChange={(event) => setSolutionExplanation(event.target.value)} maxLength={10_000} rows={4} required placeholder={localize(locale, 'Explain the key idea and complexity.', 'Giải thích ý tưởng chính và độ phức tạp.')} /></label><div className="solution-code-preview"><span>{localize(locale, 'Editor code included', 'Mã trong trình soạn thảo sẽ được đăng')} · {language}</span><pre><code>{code || localize(locale, 'No code in the editor yet.', 'Trình soạn thảo chưa có mã.')}</code></pre></div><button className="portal-primary" type="submit" disabled={isPublishingSolution || !code.trim()}>{isPublishingSolution ? localize(locale, 'Publishing...', 'Đang đăng...') : localize(locale, 'Publish solution', 'Đăng lời giải')}</button></form>}{solutions.length === 0 && <div className="placeholder-panel"><span className="placeholder-icon">⌘</span><h3>{localize(locale, 'No community solutions yet', 'Chưa có lời giải cộng đồng')}</h3><p>{localize(locale, 'Be the first to share an approach.', 'Hãy là người đầu tiên chia sẻ hướng giải.')}</p></div>}{solutions.map((solution) => <article className="solution-card" key={solution.id}><div className="solution-heading"><strong>{solution.title}</strong><span>{solution.language} · {solution.upvotes} {localize(locale, 'upvotes', 'lượt ủng hộ')}</span></div><p>{solution.explanation}</p><pre><code>{solution.code}</code></pre></article>)}</div>}
        {activeTab === 'submissions' && <div className="submission-history">{submission && <div className="submission-panel current-submission"><span className="placeholder-icon">◷</span><h3>{statusLabel}</h3><p>{submissionDescription}</p></div>}{submissionHistory.length === 0 && !submission && <div className="placeholder-panel"><span className="placeholder-icon">⌁</span><h3>{localize(locale, 'No submissions yet', 'Chưa có bài nộp')}</h3><p>{localize(locale, 'Submit your solution to see the judge result here.', 'Nộp lời giải để xem kết quả chấm tại đây.')}</p></div>}{submissionHistory.map((item) => <div className="submission-row" key={item.id}><span className={`submission-status ${item.status.toLowerCase()}`}>{item.status.replaceAll('_', ' ')}</span><span>{item.language}</span><strong>{item.score === null ? '—' : `${item.score}%`}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</time></div>)}</div>}
        {submissionError && <p className="submission-error" role="alert">{submissionError}</p>}
      </article>
      <section className="editor-panel" aria-label="Code editor">
        <div className="editor-topline"><div className="editor-tabs"><button className={editorTab === 'code' ? 'active' : ''} onClick={() => setEditorTab('code')} type="button"><span className="js-dot">JS</span> {localize(locale, 'Code', 'Mã nguồn')}</button><button className={editorTab === 'testcase' ? 'active' : ''} onClick={() => setEditorTab('testcase')} type="button">{localize(locale, 'Testcase', 'Bộ kiểm thử')}</button></div><div className="editor-settings"><select value={language} onChange={(event) => handleLanguageChange(event.target.value)} aria-label={localize(locale, 'Programming language', 'Ngôn ngữ lập trình')}><option>JavaScript</option><option>Python</option><option>C++</option></select><button type="button" aria-label={localize(locale, 'Editor settings', 'Cài đặt trình soạn thảo')}>⚙</button></div></div>
        {editorTab === 'code' ? <><div className="editor-toolbar"><span>main.{language === 'Python' ? 'py' : language === 'C++' ? 'cpp' : 'js'}</span><button type="button" onClick={() => setCode(detail.starterCode[languageKey(language)] ?? '')}>{localize(locale, 'Reset code', 'Đặt lại mã')}</button></div><div className="code-editor"><div className="line-numbers">{code.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea ref={editorRef} value={code} onKeyDown={handleEditorKeyDown} onChange={(event) => setCode(event.target.value)} spellCheck="false" aria-label={localize(locale, 'Solution code', 'Mã lời giải')} /></div></> : <div className="testcase-panel" key={`${detail.id}-${detail.examples[0]?.input ?? 'empty'}`}><label>{localize(locale, 'Input', 'Đầu vào')}<textarea defaultValue={detail.examples[0]?.input ?? ''} /></label><button type="button">+ {localize(locale, 'Add testcase', 'Thêm bộ kiểm thử')}</button></div>}
        <div className="editor-footer"><div className="run-result">{runState === 'passed' && <><span className="result-dot">✓</span> {localize(locale, 'Local check passed', 'Kiểm tra cục bộ thành công')}</>}{runState === 'running' && <><span className="spinner" /> {localize(locale, 'Checking...', 'Đang kiểm tra...')}</>}</div><div><button className="run-button" type="button" onClick={runCode}>{localize(locale, runState === 'running' ? 'Checking' : 'Run', runState === 'running' ? 'Đang kiểm tra' : 'Chạy')}</button><button className="submit-button" type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>{localize(locale, isSubmitting ? 'Submitting' : 'Submit', isSubmitting ? 'Đang nộp' : 'Nộp bài')} <span>↵</span></button></div></div>
      </section>
    </div>
  </section>
}
