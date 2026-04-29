export type ProblemImage = string

export const PROBLEM_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const
export type ProblemDifficulty = (typeof PROBLEM_DIFFICULTIES)[number]

export type ProblemTestCaseInput = {
    input: string
    expected: string
    isHidden: boolean
    image?: ProblemImage | null
}

export type CreateProblemInput = {
    title: string
    description: string
    difficulty: ProblemDifficulty
    image?: ProblemImage | null
    tags?: string[]
    topics?: string[]
    testcases: ProblemTestCaseInput[]
}

export type UpdateProblemInput = {
    title?: string
    description?: string
    difficulty?: ProblemDifficulty
    image?: ProblemImage | null
    tags?: string[]
    topics?: string[]
    testcases?: ProblemTestCaseInput[]
}
