import { prisma } from '../../shared/db.js'

export type CreateSolutionInput = {
    problemId: string
    userId: string
    title: string
    explanation: string
    code: string
    language: string
}

export async function listSolutions(problemId: string) {
    return prisma.communitySolution.findMany({
        where: { problemId },
        orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
        select: {
            id: true,
            title: true,
            explanation: true,
            code: true,
            language: true,
            upvotes: true,
            createdAt: true,
            updatedAt: true,
            user: { select: { id: true, email: true } },
        },
    })
}

export async function createSolution(input: CreateSolutionInput) {
    return prisma.communitySolution.create({
        data: input,
        select: {
            id: true,
            title: true,
            explanation: true,
            code: true,
            language: true,
            upvotes: true,
            createdAt: true,
            updatedAt: true,
            user: { select: { id: true, email: true } },
        },
    })
}
