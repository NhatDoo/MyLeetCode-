import { useMemo, useState } from 'react'
import { localize, type Locale } from '../lib/i18n'
import type { Problem } from '../types'

type StudyPlanPageProps = {
  problems: Problem[]
  userId: string
  locale: Locale
  onSelectProblem: (problem: Problem) => void
}

type PlanId = 'foundation' | 'interview' | 'algorithms'

const plans: { id: PlanId; title: [string, string]; description: [string, string]; difficulty: Problem['difficulty'] | 'All'; duration: number }[] = [
  { id: 'foundation', title: ['Core Foundations', 'Nền tảng cốt lõi'], description: ['Build confidence with essential patterns.', 'Làm quen các dạng bài và tư duy nền tảng.'], difficulty: 'Easy', duration: 7 },
  { id: 'interview', title: ['Interview Prep', 'Luyện phỏng vấn'], description: ['Practice the problems interviewers revisit.', 'Ôn luyện những dạng bài thường gặp khi phỏng vấn.'], difficulty: 'Medium', duration: 14 },
  { id: 'algorithms', title: ['Algorithm Mix', 'Tổng hợp thuật toán'], description: ['A balanced set across every difficulty.', 'Lộ trình đa dạng với đủ mọi mức độ.'], difficulty: 'All', duration: 21 },
]

export function StudyPlanPage({ problems, userId, locale, onSelectProblem }: StudyPlanPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('foundation')
  const progressKey = `myleetcode_study_${userId}_${selectedPlan}`
  const [completed, setCompleted] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(progressKey) ?? '[]') as string[] } catch { return [] }
  })
  const plan = plans.find((item) => item.id === selectedPlan) ?? plans[0]
  const planProblems = useMemo(() => {
    const matching = plan.difficulty === 'All' ? problems : problems.filter((problem) => problem.difficulty === plan.difficulty)
    return matching.slice(0, plan.duration)
  }, [plan, problems])

  function choosePlan(planId: PlanId) {
    setSelectedPlan(planId)
    try {
      const nextProgress = JSON.parse(localStorage.getItem(`myleetcode_study_${userId}_${planId}`) ?? '[]') as string[]
      setCompleted(nextProgress)
    } catch {
      setCompleted([])
    }
  }

  function toggleProblem(problemId: string) {
    const nextProgress = completed.includes(problemId)
      ? completed.filter((id) => id !== problemId)
      : [...completed, problemId]
    setCompleted(nextProgress)
    localStorage.setItem(progressKey, JSON.stringify(nextProgress))
  }

  const completion = planProblems.length === 0 ? 0 : Math.round(planProblems.filter((problem) => completed.includes(problem.id)).length / planProblems.length * 100)

  return <main className="portal-main study-main" id="study-plan">
    <div className="portal-heading"><div><p className="eyebrow">{localize(locale, 'Your learning path', 'Lộ trình của bạn')}</p><h1>{localize(locale, 'Study plans', 'Lộ trình học')}</h1><p>{localize(locale, 'Turn practice into a steady habit, one focused session at a time.', 'Duy trì thói quen luyện tập với từng phiên học tập trung.')}</p></div><div className="study-progress-summary"><strong>{completion}%</strong><span>{localize(locale, 'complete', 'hoàn thành')}</span><div className="study-progress-track"><span style={{ width: `${completion}%` }} /></div></div></div>
    <div className="plan-picker" role="tablist" aria-label={localize(locale, 'Choose a study plan', 'Chọn lộ trình học')}>
      {plans.map((item) => <button className={selectedPlan === item.id ? 'plan-option active' : 'plan-option'} key={item.id} role="tab" aria-selected={selectedPlan === item.id} type="button" onClick={() => choosePlan(item.id)}><span className="plan-number">0{plans.indexOf(item) + 1}</span><span className="plan-option-copy"><strong>{localize(locale, item.title[0], item.title[1])}</strong><small>{localize(locale, item.description[0], item.description[1])}</small></span><span className="plan-duration">{item.duration} {localize(locale, 'days', 'ngày')}</span></button>)}
    </div>
    <section className="plan-detail"><div className="plan-detail-heading"><div><p className="eyebrow">{localize(locale, 'Selected plan', 'Lộ trình đã chọn')}</p><h2>{localize(locale, plan.title[0], plan.title[1])}</h2><p>{localize(locale, plan.description[0], plan.description[1])}</p></div><span className="plan-count">{planProblems.filter((problem) => completed.includes(problem.id)).length} / {planProblems.length} {localize(locale, 'done', 'đã xong')}</span></div>
      {planProblems.length === 0 ? <div className="portal-empty"><span className="portal-empty-mark">⌁</span><h2>{localize(locale, 'No matching problems yet', 'Chưa có bài tập phù hợp')}</h2><p>{localize(locale, 'Add problems to the catalog to populate this plan.', 'Thêm bài tập vào danh mục để bắt đầu lộ trình.')}</p></div> : <ol className="plan-task-list">{planProblems.map((problem, index) => <li className={completed.includes(problem.id) ? 'plan-task completed' : 'plan-task'} key={problem.id}><span className="plan-day">{localize(locale, 'DAY', 'NGÀY')} {String(index + 1).padStart(2, '0')}</span><label className="plan-task-check"><input type="checkbox" checked={completed.includes(problem.id)} onChange={() => toggleProblem(problem.id)} /><span className="checkmark">✓</span></label><button className="plan-task-open" type="button" onClick={() => onSelectProblem(problem)}><strong>{problem.title}</strong><small>{problem.tags.slice(0, 2).join(' · ') || localize(locale, 'Problem solving', 'Giải thuật')}</small></button><span className={`difficulty ${problem.difficulty.toLowerCase()}`}>{localize(locale, problem.difficulty, problem.difficulty === 'Easy' ? 'Dễ' : problem.difficulty === 'Medium' ? 'Trung bình' : 'Khó')}</span><button className="plan-arrow" type="button" onClick={() => onSelectProblem(problem)} aria-label={`${localize(locale, 'Open', 'Mở')} ${problem.title}`}>→</button></li>)}</ol>}
    </section>
  </main>
}