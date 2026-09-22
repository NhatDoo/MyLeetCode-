export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type Problem = {
  id: string
  title: string
  difficulty: Difficulty
  acceptance?: string | null
  tags: string[]
  description: string
  examples: { input: string; output: string }[]
}

export type AuthUser = {
  id: string
  email: string
  createdAt: string
  updatedAt: string
}
