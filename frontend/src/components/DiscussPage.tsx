import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createSolution, listSolutions } from '../lib/solutionApi'
import { createDiscussion, listDiscussions } from '../lib/discussionApi'
import { localize, type Locale } from '../lib/i18n'
import type { CommunityDiscussion, CommunitySolution, Problem } from '../types'

type DiscussPageProps = {
  problems: Problem[]
  initialProblemId: string
  accessToken: string
  locale: Locale
}

type DiscussionEntry = { solution: CommunitySolution; problemTitle: string }
type ThreadEntry = { discussion: CommunityDiscussion; problemTitle: string }

export function DiscussPage({ problems, initialProblemId, accessToken, locale }: DiscussPageProps) {
  const [problemId, setProblemId] = useState(initialProblemId || problems[0]?.id || '')
  const [solutions, setSolutions] = useState<DiscussionEntry[]>([])
  const [discussions, setDiscussions] = useState<ThreadEntry[]>([])
  const [view, setView] = useState<'discussions' | 'solutions'>('discussions')
  const [loadedKey, setLoadedKey] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'top'>('recent')
  const [isWriting, setIsWriting] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [title, setTitle] = useState('')
  const [explanation, setExplanation] = useState('')
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('JavaScript')
  const requestKey = `${view}:${problemId}`
  const isLoading = Boolean(problemId && loadedKey !== requestKey)

  useEffect(() => {
    if (!problemId) return
    let isMounted = true
    async function loadFeed() {
      try {
        const problemTitle = problems.find((problem) => problem.id === problemId)?.title ?? ''
        if (view === 'solutions') {
          const result = await listSolutions(problemId, accessToken)
          if (isMounted) setSolutions(result.map((solution) => ({ solution, problemTitle })))
        } else {
          const result = await listDiscussions(problemId, accessToken)
          if (isMounted) setDiscussions(result.map((discussion) => ({ discussion, problemTitle })))
        }
        if (isMounted) {
          setError('')
          setIsLocked(false)
        }
      } catch (loadError) {
        if (isMounted) {
          const acceptedRequired = loadError instanceof Error && loadError.message.includes('Accepted submission required')
          setIsLocked(view === 'solutions' && acceptedRequired)
          setError(acceptedRequired ? '' : loadError instanceof Error ? loadError.message : localize(locale, 'Could not load posts.', 'Không thể tải bài viết.'))
          if (view === 'solutions') setSolutions([])
          else setDiscussions([])
        }
      } finally {
        if (isMounted) setLoadedKey(requestKey)
      }
    }
    void loadFeed()
    return () => { isMounted = false }
  }, [accessToken, locale, problemId, problems, requestKey, view])

  const visibleSolutions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return [...solutions]
      .filter(({ solution, problemTitle }) => `${solution.title} ${solution.explanation} ${solution.user.email} ${problemTitle}`.toLowerCase().includes(normalizedQuery))
      .sort((first, second) => sort === 'top'
        ? second.solution.upvotes - first.solution.upvotes
        : new Date(second.solution.createdAt).getTime() - new Date(first.solution.createdAt).getTime())
  }, [query, solutions, sort])

  const visibleDiscussions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return discussions
      .filter(({ discussion, problemTitle }) => `${discussion.title} ${discussion.content} ${discussion.user.email} ${problemTitle}`.toLowerCase().includes(normalizedQuery))
      .sort((first, second) => new Date(second.discussion.createdAt).getTime() - new Date(first.discussion.createdAt).getTime())
  }, [discussions, query])

  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!problemId) return
    setError('')
    setIsPosting(true)
    try {
      if (view === 'discussions') {
        const created = await createDiscussion(accessToken, problemId, { title, content: explanation })
        setDiscussions((current) => [{ discussion: created, problemTitle: selectedProblem?.title ?? '' }, ...current])
      } else {
        const created = await createSolution(accessToken, problemId, { title, explanation, code, language })
        setSolutions((current) => [{ solution: created, problemTitle: selectedProblem?.title ?? '' }, ...current])
      }
      setTitle('')
      setExplanation('')
      setCode('')
      setIsWriting(false)
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : localize(locale, 'Could not publish your post.', 'Không thể đăng bài viết.'))
    } finally {
      setIsPosting(false)
    }
  }

  const selectedProblem = problems.find((problem) => problem.id === problemId)

  function selectProblem(nextProblemId: string) {
    if (nextProblemId === problemId) return
    setProblemId(nextProblemId)
    setError('')
    setIsLocked(false)
    setSolutions([])
    setDiscussions([])
    setLoadedKey('')
  }

  function selectView(nextView: 'discussions' | 'solutions') {
    setView(nextView)
    setIsLocked(false)
    setError('')
    setLoadedKey('')
  }

  return <main className="portal-main" id="discuss">
    <div className="portal-heading">
      <div><p className="eyebrow">{localize(locale, 'Community', 'Cộng đồng')}</p><h1>{localize(locale, 'Discuss', 'Thảo luận')}</h1><p>{localize(locale, 'Ask questions, share ideas, and compare solutions with the community.', 'Đặt câu hỏi, chia sẻ ý tưởng và trao đổi lời giải cùng cộng đồng.')}</p></div>
      <button className="portal-primary" type="button" onClick={() => setIsWriting((current) => !current)}>{isWriting ? localize(locale, 'Cancel', 'Hủy') : `+ ${view === 'solutions' ? localize(locale, 'Share solution', 'Chia sẻ lời giải') : localize(locale, 'Start discussion', 'Tạo thảo luận')}`}</button>
    </div>

    {isWriting && <form className="discuss-composer" onSubmit={(event) => void handlePost(event)}>
      <div className="portal-form-heading"><div><h2>{view === 'discussions' ? localize(locale, 'Start a discussion', 'Tạo thảo luận mới') : localize(locale, 'Share your solution', 'Chia sẻ lời giải')}</h2><p>{localize(locale, 'Your post will be attached to the selected problem.', 'Bài viết sẽ được gắn với bài tập đang chọn.')}</p></div><label>{localize(locale, 'Problem', 'Bài tập')}<select value={problemId} onChange={(event) => selectProblem(event.target.value)} required><option value="">{localize(locale, 'Choose a problem', 'Chọn bài tập')}</option>{problems.map((problem) => <option key={problem.id} value={problem.id}>{problem.title}</option>)}</select></label></div>
      <label>{localize(locale, 'Title', 'Tiêu đề')}<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder={localize(locale, 'A clear name for your approach', 'Đặt tên ngắn gọn cho hướng giải')} /></label>
      <label>{view === 'discussions' ? localize(locale, 'Discussion', 'Nội dung thảo luận') : localize(locale, 'Explanation', 'Giải thích')}<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={5} maxLength={10_000} required placeholder={view === 'discussions' ? localize(locale, 'What would you like to discuss?', 'Bạn muốn trao đổi điều gì?') : localize(locale, 'Walk through the key idea and complexity.', 'Trình bày ý tưởng chính và độ phức tạp.')} /></label>
      {view === 'solutions' && <div className="discuss-code-row"><label>{localize(locale, 'Language', 'Ngôn ngữ')}<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>JavaScript</option><option>Python</option><option>C++</option></select></label><label className="discuss-code-label">{localize(locale, 'Code', 'Mã nguồn')}<textarea value={code} onChange={(event) => setCode(event.target.value)} rows={8} required spellCheck="false" /></label></div>}
      <div className="composer-footer"><span>{selectedProblem?.title ?? localize(locale, 'Select a problem to continue', 'Chọn bài tập để tiếp tục')}</span><button className="portal-primary" type="submit" disabled={isPosting || !problemId}>{isPosting ? localize(locale, 'Publishing...', 'Đang đăng...') : view === 'discussions' ? localize(locale, 'Post discussion', 'Đăng thảo luận') : localize(locale, 'Publish solution', 'Đăng lời giải')}</button></div>
    </form>}

    <div className="discuss-toolbar"><label className="portal-select-label">{localize(locale, 'Problem', 'Bài tập')}<select value={problemId} onChange={(event) => selectProblem(event.target.value)}><option value="">{localize(locale, 'Choose a problem', 'Chọn bài tập')}</option>{problems.map((problem) => <option key={problem.id} value={problem.id}>{problem.title}</option>)}</select></label><label className="portal-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={localize(locale, 'Search posts', 'Tìm bài viết')} /></label><div className="portal-segmented" aria-label={localize(locale, 'Post type', 'Loại bài viết')}><button className={view === 'discussions' ? 'active' : ''} type="button" onClick={() => selectView('discussions')}>{localize(locale, 'Discussions', 'Thảo luận')}</button><button className={view === 'solutions' ? 'active' : ''} type="button" onClick={() => selectView('solutions')}>{localize(locale, 'Solutions', 'Lời giải')}</button></div>{view === 'solutions' && <div className="portal-segmented" aria-label={localize(locale, 'Sort solutions', 'Sắp xếp lời giải')}><button className={sort === 'recent' ? 'active' : ''} type="button" onClick={() => setSort('recent')}>{localize(locale, 'Recent', 'Mới nhất')}</button><button className={sort === 'top' ? 'active' : ''} type="button" onClick={() => setSort('top')}>{localize(locale, 'Top', 'Ủng hộ')}</button></div>}</div>
    {error && <p className="portal-error" role="alert">{error}</p>}
    {isLocked && !isLoading && <div className="portal-empty"><span className="portal-empty-mark">⌑</span><h2>{localize(locale, 'Solutions are locked', 'Lời giải đang bị khóa')}</h2><p>{localize(locale, 'Get an Accepted result for this problem to unlock community solutions.', 'Hãy đạt Accepted cho bài này để mở khóa lời giải cộng đồng.')}</p></div>}
    <section className="discussion-list" aria-live="polite">
      {isLoading && <div className="portal-empty">{localize(locale, 'Loading discussions...', 'Đang tải thảo luận...')}</div>}
      {!problemId && !isLoading && <div className="portal-empty"><h2>{localize(locale, 'Choose a problem', 'Chọn bài tập')}</h2></div>}
      {!isLoading && !isLocked && !error && view === 'discussions' && problemId && visibleDiscussions.length === 0 && <div className="portal-empty"><span className="portal-empty-mark">◎</span><h2>{localize(locale, 'No discussions yet', 'Chưa có thảo luận')}</h2><p>{localize(locale, 'Start a thread for this problem.', 'Hãy tạo chủ đề thảo luận đầu tiên cho bài này.')}</p></div>}
      {!isLoading && !isLocked && !error && view === 'solutions' && problemId && visibleSolutions.length === 0 && <div className="portal-empty"><span className="portal-empty-mark">◎</span><h2>{localize(locale, 'No solutions yet', 'Chưa có lời giải')}</h2><p>{localize(locale, 'Share your approach with the community.', 'Chia sẻ hướng giải của bạn với cộng đồng.')}</p></div>}
      {!isLoading && !isLocked && view === 'discussions' && visibleDiscussions.map(({ discussion, problemTitle }) => <article className="discussion-post" key={discussion.id}><div className="post-votes"><span>◌</span><small>{localize(locale, 'THREAD', 'CHỦ ĐỀ')}</small></div><div className="post-body"><div className="post-meta"><span className="post-tag">{localize(locale, 'Discussion', 'Thảo luận')}</span>{problemTitle && <span>{problemTitle}</span>}<span>{localize(locale, 'by', 'bởi')} {discussion.user.email}</span><time dateTime={discussion.createdAt}>{new Date(discussion.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</time></div><h2>{discussion.title}</h2><p>{discussion.content}</p></div></article>)}
      {!isLoading && !isLocked && view === 'solutions' && visibleSolutions.map(({ solution, problemTitle }) => <article className="discussion-post" key={solution.id}><div className="post-votes"><span>↑</span><strong>{solution.upvotes}</strong><small>{localize(locale, 'votes', 'ủng hộ')}</small></div><div className="post-body"><div className="post-meta"><span className="post-tag">{solution.language}</span>{problemTitle && <span>{problemTitle}</span>}<span>{localize(locale, 'by', 'bởi')} {solution.user.email}</span><time dateTime={solution.createdAt}>{new Date(solution.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</time></div><h2>{solution.title}</h2><p>{solution.explanation}</p><details className="post-code"><summary>{localize(locale, 'View code', 'Xem mã nguồn')}</summary><pre><code>{solution.code}</code></pre></details></div></article>)}
    </section>
  </main>
}