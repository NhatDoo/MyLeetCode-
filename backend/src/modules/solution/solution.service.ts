import * as solutionRepo from './solution.repo.js'
import { prisma } from '../../shared/db.js'
import { SUPPORTED_LANGUAGES } from '../submission/submission.security.js'

export type CreateSolutionRequest = {
    problemId: string
    userId: string
    title: unknown
    explanation: unknown
    code: unknown
    language: unknown
}

export async function listSolutions(problemId: string) {
    const problem = await prisma.problem.findUnique({ where: { id: problemId }, select: { id: true } })
    if (!problem) throw new Error('Problem not found')
    return solutionRepo.listSolutions(problemId)
}

export async function createSolution(input: CreateSolutionRequest) {
    const problem = await prisma.problem.findUnique({ where: { id: input.problemId }, select: { id: true } })
    if (!problem) throw new Error('Problem not found')

    const title = readText(input.title, 'title', 120)
    const explanation = readText(input.explanation, 'explanation', 10_000)
    const code = readText(input.code, 'code', 64_000)
    const language = readLanguage(input.language)

    return solutionRepo.createSolution({
        problemId: input.problemId,
        userId: input.userId,
        title,
        explanation,
        code,
        language,
    })
}

function readText(value: unknown, fieldName: string, maxLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${fieldName} is required`)
    const normalized = value.trim()
    if (normalized.length > maxLength) throw new Error(`${fieldName} exceeds maximum length of ${maxLength}`)
    return normalized
}

function readLanguage(value: unknown): string {
    if (typeof value !== 'string' || !SUPPORTED_LANGUAGES.includes(value as typeof SUPPORTED_LANGUAGES[number])) {
        throw new Error(`language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`)
    }
    return value
}
