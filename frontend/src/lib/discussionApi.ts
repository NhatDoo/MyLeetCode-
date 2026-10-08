import { apiRequest } from './api'
import type { CommunityDiscussion } from '../types'

export async function listDiscussions(problemId: string, accessToken: string): Promise<CommunityDiscussion[]> {
  return apiRequest<CommunityDiscussion[]>(`/api/problems/${problemId}/discussions`, {}, accessToken)
}

export async function createDiscussion(
  accessToken: string,
  problemId: string,
  discussion: Pick<CommunityDiscussion, 'title' | 'content'>,
): Promise<CommunityDiscussion> {
  return apiRequest<CommunityDiscussion>(`/api/problems/${problemId}/discussions`, {
    method: 'POST',
    body: JSON.stringify(discussion),
  }, accessToken)
}