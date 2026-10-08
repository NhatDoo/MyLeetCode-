import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
    submission: { findFirst: vi.fn() },
}))

vi.mock('../../src/shared/db.js', () => ({
    prisma: prismaMock,
}))

import { hasAcceptedSubmission } from '../../src/modules/submission/submission.repo.js'

describe('submission.repo hasAcceptedSubmission()', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('checks for an accepted submission by this user for this problem', async () => {
        prismaMock.submission.findFirst.mockResolvedValue({ id: 'submission-1' })

        await expect(hasAcceptedSubmission('user-1', 'problem-1')).resolves.toBe(true)
        expect(prismaMock.submission.findFirst).toHaveBeenCalledWith({
            where: { userId: 'user-1', problemId: 'problem-1', status: 'ACCEPTED' },
            select: { id: true },
        })
    })

    it('returns false when the user has no accepted submission', async () => {
        prismaMock.submission.findFirst.mockResolvedValue(null)

        await expect(hasAcceptedSubmission('user-1', 'problem-1')).resolves.toBe(false)
    })
})