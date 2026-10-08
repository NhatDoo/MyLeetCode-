import { prisma } from '../../shared/db.js'

export type CreateDiscussionInput = {
    problemId: string
    userId: string
    title: string
    content: string
}

const discussionSelect = {
    id: true,
    title: true,
    content: true,
    createdAt: true,
    updatedAt: true,
    user: { select: { id: true, email: true } },
} as const

export function listDiscussions(problemId: string) {
    return prisma.problemDiscussion.findMany({
        where: { problemId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: discussionSelect,
    })
}

export function createDiscussion(input: CreateDiscussionInput) {
    return prisma.problemDiscussion.create({
        data: input,
        select: discussionSelect,
    })
}