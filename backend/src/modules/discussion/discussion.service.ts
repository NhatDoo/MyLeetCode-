import { prisma } from '../../shared/db.js'
import * as discussionRepo from './discussion.repo.js'

export type CreateDiscussionRequest = {
    problemId: string
    userId: string
    title: unknown
    content: unknown
}

export async function listDiscussions(problemId: string) {
    const problem = await prisma.problem.findUnique({ where: { id: problemId }, select: { id: true } })
    if (!problem) throw new Error('Problem not found')
    return discussionRepo.listDiscussions(problemId)
}

export async function createDiscussion(input: CreateDiscussionRequest) {
    const title = readText(input.title, 'title', 160)
    const content = readText(input.content, 'content', 10_000)
    const problem = await prisma.problem.findUnique({ where: { id: input.problemId }, select: { id: true } })
    if (!problem) throw new Error('Problem not found')

    return discussionRepo.createDiscussion({
        problemId: input.problemId,
        userId: input.userId,
        title,
        content,
    })
}

function readText(value: unknown, fieldName: string, maxLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${fieldName} is required`)
    const normalized = value.trim()
    if (normalized.length > maxLength) throw new Error(`${fieldName} exceeds maximum length of ${maxLength}`)
    return normalized
}