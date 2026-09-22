import { useMemo, useState } from 'react'
import type { Difficulty, Problem } from '../types'

type ProblemBrowserProps = { problems: Problem[]; activeId: string; onSelect: (problem: Problem) => void }

export function ProblemBrowser({ problems, activeId, onSelect }: ProblemBrowserProps) {
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState<'All' | Difficulty>('All')
  const filteredProblems = useMemo(() => problems.filter((problem) => problem.title.toLowerCase().includes(query.toLowerCase()) && (difficulty === 'All' || problem.difficulty === difficulty)), [difficulty, problems, query])

  return <aside className="problem-browser" id="problems">
    <div className="browser-heading"><div><p className="eyebrow">Practice room</p><h1>Problems</h1></div><button className="small-icon-button" aria-label="More problem options">•••</button></div>
    <div className="progress-card"><div className="progress-ring"><strong>API</strong></div><div><strong>Backend catalog</strong><p>Live problem data</p></div><span className="progress-arrow">→</span></div>
    <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search problems" /><kbd>/</kbd></label>
    <div className="filter-row" aria-label="Filter by difficulty">{(['All', 'Easy', 'Medium', 'Hard'] as const).map((item) => <button key={item} className={difficulty === item ? 'filter active' : 'filter'} onClick={() => setDifficulty(item)} type="button">{item}</button>)}</div>
    <div className="list-header"><span>{filteredProblems.length} problems</span><button type="button">Sort: <strong>Recommended</strong>⌄</button></div>
    <div className="problem-list">{filteredProblems.map((problem, index) => <button key={problem.id} className={activeId === problem.id ? 'problem-row selected' : 'problem-row'} onClick={() => onSelect(problem)} type="button"><span className="status">{index + 1}</span><span className="problem-copy"><strong>{problem.title}</strong><small>{problem.tags.slice(0, 2).join(' · ')}</small></span><span className={`difficulty ${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span></button>)}{filteredProblems.length === 0 && <p className="empty-state">No problems match your search.</p>}</div>
  </aside>
}
