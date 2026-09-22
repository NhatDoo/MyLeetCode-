import { useEffect, useState } from 'react'
import { getProblem } from '../lib/problemApi'
import { getSubmission, submitCode, type Submission } from '../lib/submissionApi'
import type { Problem } from '../types'

type ChallengeWorkspaceProps = { problem: Problem; accessToken: string }
type ChallengeTab = 'description' | 'solutions' | 'submissions'

const terminalStatuses = new Set(['ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILATION_ERROR', 'SYSTEM_ERROR'])
const defaultCode = `function solution(input) {
  // Write your solution here
}`

export function ChallengeWorkspace({ problem, accessToken }: ChallengeWorkspaceProps) {
  const [detail, setDetail] = useState(problem)
  const [activeTab, setActiveTab] = useState<ChallengeTab>('description')
  const [editorTab, setEditorTab] = useState<'code' | 'testcase'>('code')
  const [language, setLanguage] = useState('JavaScript')
  const [code, setCode] = useState(defaultCode)
  const [runState, setRunState] = useState<'idle' | 'running' | 'passed'>('idle')
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [submissionError, setSubmissionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function loadDetail() {
      try {
        const fullProblem = await getProblem(problem.id)
        if (isMounted) setDetail(fullProblem)
      } catch (error) {
        if (isMounted) setSubmissionError(error instanceof Error ? error.message : 'Unable to load problem details')
      }
    }
    void loadDetail()
    return () => { isMounted = false }
  }, [problem])

  useEffect(() => {
    if (!submission || !accessToken || terminalStatuses.has(submission.status)) return
    const timer = window.setInterval(() => {
      void getSubmission(accessToken, submission.id).then(setSubmission).catch(() => undefined)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [accessToken, submission])

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

  const statusLabel = submission?.status.replaceAll('_', ' ') ?? ''
  const submissionDescription = submission && terminalStatuses.has(submission.status)
    ? `Finished with ${statusLabel.toLowerCase()}.`
    : submission
      ? `Submission ${submission.id.slice(0, 8)} is being processed by the worker.`
      : 'Submit your solution to see the judge result here.'
  return <section className="challenge-area" aria-label="Challenge workspace">
    <div className="challenge-header"><div className="breadcrumb"><span>Problems</span><b>/</b><strong>{detail.title}</strong></div><div className="challenge-tools"><button className="tool-button" type="button">♡ <span>Favorite</span></button><button className="tool-button" type="button">↗ <span>Share</span></button></div></div>
    <div className="challenge-content">
      <article className="description-panel">
        <div className="problem-title-row"><div><span className="question-number">#</span><h2>{detail.title}</h2></div><button className="bookmark" aria-label="Bookmark problem" type="button">♡</button></div>
        <div className="meta-row"><span className={`difficulty ${detail.difficulty.toLowerCase()}`}>{detail.difficulty}</span><span>Acceptance <strong>{detail.acceptance ?? 'Unavailable'}</strong></span><span>Backend problem</span></div>
        <div className="description-tabs"><button className={activeTab === 'description' ? 'active' : ''} onClick={() => setActiveTab('description')} type="button">Description</button><button className={activeTab === 'solutions' ? 'active' : ''} onClick={() => setActiveTab('solutions')} type="button">Solutions</button><button className={activeTab === 'submissions' ? 'active' : ''} onClick={() => setActiveTab('submissions')} type="button">Submissions</button></div>
        {activeTab === 'description' && <div className="description-copy"><p>{detail.description}</p><h3>Examples</h3>{detail.examples.length > 0 ? detail.examples.map((example, index) => <div className="example" key={`${example.input}-${index}`}><strong>Example {index + 1}</strong><pre><code><span className="code-key">Input:</span> {example.input}{'\n'}<span className="code-key">Output:</span> {example.output}</code></pre></div>) : <p className="muted-copy">Public examples are not available for this problem.</p>}<h3>Topics</h3><div className="topic-list">{detail.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>}
        {activeTab === 'solutions' && <div className="placeholder-panel"><span className="placeholder-icon">⌘</span><h3>Community solutions</h3><p>Solution discussions will be available soon.</p></div>}
        {activeTab === 'submissions' && <div className="submission-panel"><span className="placeholder-icon">{submission ? '◷' : '⌁'}</span><h3>{submission ? statusLabel : 'No submissions yet'}</h3><p>{submissionDescription}</p>{submission && submission.score !== null && <strong className="submission-score">Score {submission.score}</strong>}</div>}
        {submissionError && <p className="submission-error" role="alert">{submissionError}</p>}
      </article>
      <section className="editor-panel" aria-label="Code editor">
        <div className="editor-topline"><div className="editor-tabs"><button className={editorTab === 'code' ? 'active' : ''} onClick={() => setEditorTab('code')} type="button"><span className="js-dot">JS</span> Code</button><button className={editorTab === 'testcase' ? 'active' : ''} onClick={() => setEditorTab('testcase')} type="button">Testcase</button></div><div className="editor-settings"><select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Programming language"><option>JavaScript</option><option>Python</option><option>C++</option></select><button type="button" aria-label="Editor settings">⚙</button></div></div>
        {editorTab === 'code' ? <><div className="editor-toolbar"><span>main.{language === 'Python' ? 'py' : language === 'C++' ? 'cpp' : 'js'}</span><button type="button" onClick={() => setCode(defaultCode)}>Reset code</button></div><div className="code-editor"><div className="line-numbers">{code.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck="false" aria-label="Solution code" /></div></> : <div className="testcase-panel" key={`${detail.id}-${detail.examples[0]?.input ?? 'empty'}`}><label>Input<textarea defaultValue={detail.examples[0]?.input ?? ''} /></label><button type="button">+ Add testcase</button></div>}
        <div className="editor-footer"><div className="run-result">{runState === 'passed' && <><span className="result-dot">✓</span> Local check passed</>}{runState === 'running' && <><span className="spinner" /> Checking...</>}</div><div><button className="run-button" type="button" onClick={runCode}>{runState === 'running' ? 'Checking' : 'Run'}</button><button className="submit-button" type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>{isSubmitting ? 'Submitting' : 'Submit'} <span>↵</span></button></div></div>
      </section>
    </div>
  </section>
}
