import { apiRequest } from './api'

export type NewProblem = {
  id: string
  title: string
}

export async function checkAdminAccess(accessToken: string): Promise<boolean> {
  const result = await apiRequest<{ allowed: boolean }>('/api/problems/admin/access', {}, accessToken)
  return result.allowed
}

export async function createProblem(accessToken: string, formData: FormData): Promise<NewProblem> {
  return apiRequest<NewProblem>('/api/problems', {
    method: 'POST',
    body: formData,
  }, accessToken)
}