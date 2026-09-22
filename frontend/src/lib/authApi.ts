import type { AuthUser } from '../types'
import { apiRequest } from './api'

export async function login(email: string, password: string): Promise<string> {
  const result = await apiRequest<{ accessToken: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return result.accessToken
}

export async function register(email: string, password: string): Promise<string> {
  const result = await apiRequest<{ accessToken: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return result.accessToken
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  const result = await apiRequest<{ user: AuthUser }>('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return result.user
}

export async function refreshSession(): Promise<string> {
  const result = await apiRequest<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' })
  return result.accessToken
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' })
}
