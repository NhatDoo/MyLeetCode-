import { apiRequest } from './api'
import type { CommunitySolution } from '../types'

export async function listSolutions(problemId: string): Promise<CommunitySolution[]> {
  return apiRequest<CommunitySolution[]>(`/api/problems/${problemId}/solutions`)
}

export async function createSolution(
  accessToken: string,
  problemId: string,
  solution: Pick<CommunitySolution, 'title' | 'explanation' | 'code' | 'language'>,
): Promise<CommunitySolution> {
  return apiRequest<CommunitySolution>(`/api/problems/${problemId}/solutions`, {
    method: 'POST',
    body: JSON.stringify(solution),
  }, accessToken)
}