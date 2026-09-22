export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type Problem = {
  id: string
  title: string
  difficulty: Difficulty
  acceptance?: number | null
  starterCode: Record<string, string>
  tags: string[]
  description: string
  examples: { input: string; output: string }[]
}

export type CommunitySolution = {
  id: string
  title: string
  explanation: string
  code: string
  language: string
  upvotes: number
  createdAt: string
  updatedAt: string
  user: { id: string; email: string }
}

export type AuthUser = {
  id: string
  email: string
  createdAt: string
  updatedAt: string
}
