import { apiRequest } from './api'
import type { Problem } from '../types'

type ProblemSummaryResponse = {
  id: string
  title: string
  difficulty: string
  image: string | null
  tags: string[]
  topics: string[]
}

type ProblemDetailResponse = ProblemSummaryResponse & {
  description: string
  testcases: { id: string; input: string; expected: string; isHidden: boolean }[]
}

function normalizeProblem(problem: ProblemSummaryResponse | ProblemDetailResponse): Problem {
  const detail = 'description' in problem ? problem : undefined
  const difficulty = problem.difficulty.toLowerCase() as Problem['difficulty']
  return {
    id: problem.id,
    title: problem.title,
    difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1) as Problem['difficulty'],
    tags: problem.tags.length > 0 ? problem.tags : problem.topics,
    description: detail?.description ?? 'Open this problem to see its full description.',
    examples: detail?.testcases?.filter((testcase) => !testcase.isHidden).map((testcase) => ({ input: testcase.input, output: testcase.expected })) ?? [],
  }
}

export async function listProblems(): Promise<Problem[]> {
  const result = await apiRequest<ProblemSummaryResponse[]>('/api/problems')
  return result.map(normalizeProblem)
}

export async function getProblem(id: string): Promise<Problem> {
  const result = await apiRequest<ProblemDetailResponse>(`/api/problems/${id}`)
  return normalizeProblem(result)
}
