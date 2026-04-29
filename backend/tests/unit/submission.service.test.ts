import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/modules/submission/submission.repo.js', () => ({
    createSubmission: vi.fn(),
    markSubmissionFailed: vi.fn(),
}))

vi.mock('../../src/shared/queue.js', () => ({
    publishJob: vi.fn(),
    QUEUES: { SUBMISSION: 'submission_queue' },
}))

import { submitCode } from '../../src/modules/submission/submission.service.js'
import { createSubmission, markSubmissionFailed } from '../../src/modules/submission/submission.repo.js'
import { publishJob } from '../../src/shared/queue.js'

const validRequest = {
    userId: 'user-123',
    problemId: 'prob-456',
    language: 'javascript',
    code: 'function solution(n) { return n; }',
}

const mockSubmission = {
    id: 'sub-789',
    userId: 'user-123',
    problemId: 'prob-456',
    language: 'javascript',
    status: 'PENDING',
    createdAt: new Date(),
}

describe('submitCode()', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(createSubmission).mockResolvedValue(mockSubmission as any)
        vi.mocked(markSubmissionFailed).mockResolvedValue(undefined as any)
        vi.mocked(publishJob).mockResolvedValue(true)
    })

    describe('Happy path', () => {
        it('returns submissionId and pending status', async () => {
            const result = await submitCode(validRequest)

            expect(result.submissionId).toBe('sub-789')
            expect(result.status).toBe('PENDING')
            expect(result.message).toContain('submissionId')
        })

        it('calls createSubmission with sanitized input', async () => {
            await submitCode(validRequest)

            expect(createSubmission).toHaveBeenCalledWith({
                userId: 'user-123',
                problemId: 'prob-456',
                language: 'javascript',
                code: validRequest.code,
            })
        })

        it('publishes a queue job after the submission is created', async () => {
            await submitCode(validRequest)

            expect(publishJob).toHaveBeenCalledWith(
                'submission_queue',
                expect.objectContaining({
                    submissionId: 'sub-789',
                    problemId: 'prob-456',
                    userId: 'user-123',
                    language: 'javascript',
                    code: validRequest.code,
                }),
            )
        })

        it('creates the submission before publishing the job', async () => {
            const callOrder: string[] = []
            vi.mocked(createSubmission).mockImplementation(async () => {
                callOrder.push('createSubmission')
                return mockSubmission as any
            })
            vi.mocked(publishJob).mockImplementation(async () => {
                callOrder.push('publishJob')
                return true
            })

            await submitCode(validRequest)

            expect(callOrder).toEqual(['createSubmission', 'publishJob'])
        })

        it('marks the submission failed and surfaces a 503-style error when queue publish fails', async () => {
            vi.mocked(publishJob).mockResolvedValue(false)

            await expect(submitCode(validRequest)).rejects.toThrow('Submission queue is temporarily unavailable')
            expect(markSubmissionFailed).toHaveBeenCalledWith(
                'sub-789',
                'Submission queue is temporarily unavailable. Please retry your submission.',
            )
        })
    })

    describe('Validation', () => {
        it('throws when userId is missing', async () => {
            await expect(submitCode({ ...validRequest, userId: '' }))
                .rejects.toThrow('userId is required')
        })

        it('throws when problemId is missing', async () => {
            await expect(submitCode({ ...validRequest, problemId: '' }))
                .rejects.toThrow('problemId is required')
        })

        it('throws when the language is unsupported', async () => {
            await expect(submitCode({ ...validRequest, language: 'cobol' }))
                .rejects.toThrow('Unsupported language')
        })

        it('throws when code is empty', async () => {
            await expect(submitCode({ ...validRequest, code: '   ' }))
                .rejects.toThrow('Code cannot be empty')
        })

        it('throws when code exceeds the character limit', async () => {
            const hugeCode = 'a'.repeat(65_000)
            await expect(submitCode({ ...validRequest, code: hugeCode }))
                .rejects.toThrow('exceeds maximum length')
        })

        it('throws when code matches a blocked RCE signature', async () => {
            await expect(submitCode({
                ...validRequest,
                code: 'const { exec } = require("child_process")',
            }))
                .rejects.toThrow('Blocked by submission security policy')
        })

        it('accepts each supported language', async () => {
            for (const language of ['javascript', 'python', 'cpp']) {
                vi.mocked(createSubmission).mockResolvedValue(mockSubmission as any)
                await expect(submitCode({ ...validRequest, language }))
                    .resolves.toBeDefined()
            }
        })
    })

    describe('DB error handling', () => {
        it('propagates errors from createSubmission', async () => {
            vi.mocked(createSubmission).mockRejectedValue(new Error('DB connection lost'))

            await expect(submitCode(validRequest))
                .rejects.toThrow('DB connection lost')

            expect(publishJob).not.toHaveBeenCalled()
        })
    })
})
