import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/modules/submission/submission.repo.js', () => ({
    getTestCasesByProblemId: vi.fn(),
    markSubmissionRunning: vi.fn(),
    markSubmissionFailed: vi.fn(),
    saveSubmissionResult: vi.fn(),
}))

vi.mock('../../src/modules/execution/executor.js', () => ({
    executeCode: vi.fn(),
}))

vi.mock('../../src/modules/execution/judge.js', () => ({
    judge: vi.fn(),
}))

vi.mock('../../src/shared/queue.js', () => ({
    consumeQueue: vi.fn(),
    QUEUES: { SUBMISSION: 'submission_queue' },
}))

import { startSubmissionWorker } from '../../src/modules/submission/submission.worker.js'
import {
    getTestCasesByProblemId,
    markSubmissionRunning,
    markSubmissionFailed,
    saveSubmissionResult,
} from '../../src/modules/submission/submission.repo.js'
import { executeCode } from '../../src/modules/execution/executor.js'
import { judge } from '../../src/modules/execution/judge.js'
import { consumeQueue } from '../../src/shared/queue.js'

async function getRegisteredHandler() {
    await startSubmissionWorker()
    return vi.mocked(consumeQueue).mock.calls[0]![1] as Function
}

const basePayload = {
    submissionId: 'sub-001',
    problemId: 'prob-001',
    userId: 'user-001',
    language: 'javascript',
    code: 'function solution(n) { return n; }',
}

const mockTestCases = [
    { id: 'tc-1', input: '5', expected: '5', isHidden: false },
    { id: 'tc-2', input: '10', expected: '10', isHidden: true },
]

const mockExecutionResult = {
    language: 'javascript',
    testResults: [
        { testCaseId: 'tc-1', passed: true, stdout: '5', stderr: '', expected: '5', exitCode: 0, timedOut: false, securityViolation: null, runtimeMs: 50 },
        { testCaseId: 'tc-2', passed: true, stdout: '10', stderr: '', expected: '10', exitCode: 0, timedOut: false, securityViolation: null, runtimeMs: 60 },
    ],
    passedCount: 2,
    totalCount: 2,
    allPassed: true,
    totalRuntimeMs: 110,
}

const mockJudgeResult = {
    status: 'ACCEPTED',
    score: 100,
    passedCount: 2,
    totalCount: 2,
    totalRuntimeMs: 110,
    detail: [],
}

describe('startSubmissionWorker()', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getTestCasesByProblemId).mockResolvedValue(mockTestCases as any)
        vi.mocked(markSubmissionRunning).mockResolvedValue(undefined as any)
        vi.mocked(markSubmissionFailed).mockResolvedValue(undefined as any)
        vi.mocked(saveSubmissionResult).mockResolvedValue(undefined as any)
        vi.mocked(executeCode).mockResolvedValue(mockExecutionResult as any)
        vi.mocked(judge).mockReturnValue(mockJudgeResult as any)
        vi.mocked(consumeQueue).mockResolvedValue(undefined as any)
    })

    it('registers a submission consumer with prefetch=1', async () => {
        await startSubmissionWorker()

        expect(consumeQueue).toHaveBeenCalledWith(
            'submission_queue',
            expect.any(Function),
            { prefetch: 1 },
        )
    })
})

describe('handleSubmissionJob()', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getTestCasesByProblemId).mockResolvedValue(mockTestCases as any)
        vi.mocked(markSubmissionRunning).mockResolvedValue(undefined as any)
        vi.mocked(markSubmissionFailed).mockResolvedValue(undefined as any)
        vi.mocked(saveSubmissionResult).mockResolvedValue(undefined as any)
        vi.mocked(executeCode).mockResolvedValue(mockExecutionResult as any)
        vi.mocked(judge).mockReturnValue(mockJudgeResult as any)
        vi.mocked(consumeQueue).mockResolvedValue(undefined as any)
    })

    async function runHandler(payload = basePayload) {
        const handler = await getRegisteredHandler()
        await handler(payload, {})
    }

    it('marks the submission as RUNNING before execution', async () => {
        const callOrder: string[] = []
        vi.mocked(markSubmissionRunning).mockImplementation(async () => {
            callOrder.push('markRunning')
            return undefined as any
        })
        vi.mocked(executeCode).mockImplementation(async () => {
            callOrder.push('executeCode')
            return mockExecutionResult as any
        })

        await runHandler()

        expect(callOrder[0]).toBe('markRunning')
    })

    it('executes the code with the right language and source', async () => {
        await runHandler()

        expect(executeCode).toHaveBeenCalledWith(
            'javascript',
            basePayload.code,
            mockTestCases,
        )
    })

    it('passes hidden test ids into the judge', async () => {
        await runHandler()

        expect(judge).toHaveBeenCalledWith(
            mockExecutionResult,
            new Set(['tc-2']),
        )
    })

    it('persists the judge result on success', async () => {
        await runHandler()

        expect(saveSubmissionResult).toHaveBeenCalledWith(
            'sub-001',
            mockJudgeResult,
        )
    })

    it('does not mark the submission as failed when execution succeeds', async () => {
        await runHandler()

        expect(markSubmissionFailed).not.toHaveBeenCalled()
    })

    it('marks the submission as failed when there are no test cases', async () => {
        vi.mocked(getTestCasesByProblemId).mockResolvedValue([])

        await runHandler()

        expect(markSubmissionFailed).toHaveBeenCalledWith(
            'sub-001',
            expect.stringContaining('No test cases'),
        )
        expect(executeCode).not.toHaveBeenCalled()
    })

    it('sanitizes infrastructure errors before persisting them', async () => {
        vi.mocked(executeCode).mockRejectedValue(new Error('Docker daemon not running'))

        await runHandler()

        expect(markSubmissionFailed).toHaveBeenCalledWith(
            'sub-001',
            'Execution failed inside the sandbox infrastructure',
        )
        expect(saveSubmissionResult).not.toHaveBeenCalled()
    })

    it('keeps explicit security failures readable', async () => {
        vi.mocked(executeCode).mockRejectedValue(new Error('[Security] Output limit exceeded on stdout'))

        await runHandler()

        expect(markSubmissionFailed).toHaveBeenCalledWith(
            'sub-001',
            'Output limit exceeded on stdout',
        )
    })

    it('keeps the right submission id when reporting failures', async () => {
        vi.mocked(executeCode).mockRejectedValue(new Error('Crash'))

        await runHandler({ ...basePayload, submissionId: 'sub-specific' })

        expect(markSubmissionFailed).toHaveBeenCalledWith(
            'sub-specific',
            expect.any(String),
        )
    })

    it('passes an empty hidden id set when all tests are public', async () => {
        vi.mocked(getTestCasesByProblemId).mockResolvedValue([
            { id: 'tc-1', input: '1', expected: '1', isHidden: false },
            { id: 'tc-2', input: '2', expected: '2', isHidden: false },
        ] as any)

        await runHandler()

        expect(judge).toHaveBeenCalledWith(
            expect.anything(),
            new Set([]),
        )
    })
})
