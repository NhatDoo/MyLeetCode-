import { useMemo, useState } from 'react'
import { localize, type Locale } from '../lib/i18n'
import type { Difficulty, Problem } from '../types'

type ProblemBrowserProps = { problems: Problem[]; activeId: string; onSelect: (problem: Problem) => void; locale: Locale }

export function ProblemBrowser({ problems, activeId, onSelect, locale }: ProblemBrowserProps) {
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState<'All' | Difficulty>('All')
  const filteredProblems = useMemo(() => problems.filter((problem) => problem.title.toLowerCase().includes(query.toLowerCase()) && (difficulty === 'All' || problem.difficulty === difficulty)), [difficulty, problems, query])

  return <aside className="problem-browser" id="problems">
    <div className="browser-heading"><div><p className="eyebrow">{localize(locale, 'Practice room', 'Không gian luyện tập')}</p><h1>{localize(locale, 'Problems', 'Bài tập')}</h1></div><button className="small-icon-button" aria-label={localize(locale, 'More problem options', 'Tùy chọn bài tập khác')}>•••</button></div>
    <div className="progress-card"><div className="progress-ring"><strong>API</strong></div><div><strong>{localize(locale, 'Problem catalog', 'Danh mục bài tập')}</strong><p>{localize(locale, 'Live problem data', 'Dữ liệu trực tiếp')}</p></div><span className="progress-arrow">→</span></div>
    <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={localize(locale, 'Search problems', 'Tìm bài tập')} /><kbd>/</kbd></label>
    <div className="filter-row" aria-label={localize(locale, 'Filter by difficulty', 'Lọc theo độ khó')}>{(['All', 'Easy', 'Medium', 'Hard'] as const).map((item) => <button key={item} className={difficulty === item ? 'filter active' : 'filter'} onClick={() => setDifficulty(item)} type="button">{localize(locale, item, item === 'All' ? 'Tất cả' : item === 'Easy' ? 'Dễ' : item === 'Medium' ? 'Trung bình' : 'Khó')}</button>)}</div>
    <div className="list-header"><span>{filteredProblems.length} {localize(locale, 'problems', 'bài tập')}</span><button type="button">{localize(locale, 'Sort:', 'Sắp xếp:')} <strong>{localize(locale, 'Recommended', 'Đề xuất')}</strong>⌄</button></div>
    <div className="problem-list">{filteredProblems.map((problem, index) => <button key={problem.id} className={activeId === problem.id ? 'problem-row selected' : 'problem-row'} onClick={() => onSelect(problem)} type="button"><span className="status">{index + 1}</span><span className="problem-copy"><strong>{problem.title}</strong><small>{problem.tags.slice(0, 2).join(' · ')}</small></span><span className={`difficulty ${problem.difficulty.toLowerCase()}`}>{localize(locale, problem.difficulty, problem.difficulty === 'Easy' ? 'Dễ' : problem.difficulty === 'Medium' ? 'Trung bình' : 'Khó')}</span></button>)}{filteredProblems.length === 0 && <p className="empty-state">{localize(locale, 'No problems match your search.', 'Không tìm thấy bài tập phù hợp.')}</p>}</div>
  </aside>
}
