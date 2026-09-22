import { apiRequest } from './api'

export type SubmissionStatus = 'PENDING' | 'RUNNING' | 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR' | 'SYSTEM_ERROR'

export type Submission = {
  id: string
  status: SubmissionStatus
  score: number | null
  result: unknown
  language: string
  createdAt: string
  updatedAt: string
}

export async function submitCode(accessToken: string, problemId: string, language: string, code: string) {
  return apiRequest<{ submissionId: string; status: SubmissionStatus; message: string }>('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ problemId, language, code }),
  }, accessToken)
}

export async function getSubmission(accessToken: string, submissionId: string) {
  return apiRequest<Submission>(`/api/submissions/${submissionId}`, {}, accessToken)
}
