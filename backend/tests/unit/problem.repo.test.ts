import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
    $transaction: vi.fn(),
}))

vi.mock('../../src/shared/db.js', () => ({
    prisma: prismaMock,
}))

import { updateProblem } from '../../src/modules/problem/problem.repo.js'

describe('problem.repo updateProblem()', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deletes execution logs before replacing testcases', async () => {
        const tx = {
            executionLog: {
                deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
            },
            testCase: {
                deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
            },
            problem: {
                update: vi.fn().mockResolvedValue({ id: 'problem-1', testcases: [] }),
            },
        }

        prismaMock.$transaction.mockImplementation(async (callback) => callback(tx))

        await updateProblem('problem-1', {
            testcases: [
                { input: '1 2', expected: '3', isHidden: false },
            ],
        })

        expect(tx.executionLog.deleteMany).toHaveBeenCalledWith({
            where: { testcase: { problemId: 'problem-1' } },
        })
        expect(tx.testCase.deleteMany).toHaveBeenCalledWith({
            where: { problemId: 'problem-1' },
        })
        expect(tx.executionLog.deleteMany.mock.invocationCallOrder[0])
            .toBeLessThan(tx.testCase.deleteMany.mock.invocationCallOrder[0]!)
        expect(tx.problem.update).toHaveBeenCalledWith({
            where: { id: 'problem-1' },
            data: {
                testcases: {
                    create: [
                        { input: '1 2', expected: '3', isHidden: false },
                    ],
                },
            },
            include: { testcases: true },
        })
    })
})
