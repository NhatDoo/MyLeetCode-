import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
    problem: { findUnique: vi.fn() },
}))
const discussionRepoMock = vi.hoisted(() => ({
    listDiscussions: vi.fn(),
    createDiscussion: vi.fn(),
}))

vi.mock('../../src/shared/db.js', () => ({
    prisma: prismaMock,
}))

vi.mock('../../src/modules/discussion/discussion.repo.js', () => discussionRepoMock)

import { createDiscussion, listDiscussions } from '../../src/modules/discussion/discussion.service.js'

describe('discussion.service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prismaMock.problem.findUnique.mockResolvedValue({ id: 'problem-1' })
        discussionRepoMock.listDiscussions.mockResolvedValue([])
        discussionRepoMock.createDiscussion.mockResolvedValue({ id: 'discussion-1' })
    })

    it('lists threads for an existing problem', async () => {
        await expect(listDiscussions('problem-1')).resolves.toEqual([])
        expect(discussionRepoMock.listDiscussions).toHaveBeenCalledWith('problem-1')
    })

    it('trims and stores the title and content with the author and problem', async () => {
        await createDiscussion({
            problemId: 'problem-1',
            userId: 'user-1',
            title: '  Need clarification  ',
            content: '  How should this edge case work?  ',
        })

        expect(discussionRepoMock.createDiscussion).toHaveBeenCalledWith({
            problemId: 'problem-1',
            userId: 'user-1',
            title: 'Need clarification',
            content: 'How should this edge case work?',
        })
    })

    it('rejects blank or oversized thread content', async () => {
        await expect(createDiscussion({
            problemId: 'problem-1', userId: 'user-1', title: '  ', content: 'body',
        })).rejects.toThrow('title is required')
        await expect(createDiscussion({
            problemId: 'problem-1', userId: 'user-1', title: 'Question', content: 'x'.repeat(10_001),
        })).rejects.toThrow('content exceeds maximum length')
        expect(discussionRepoMock.createDiscussion).not.toHaveBeenCalled()
    })
})