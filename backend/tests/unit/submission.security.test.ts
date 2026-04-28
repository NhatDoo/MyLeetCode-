import { describe, expect, it, beforeEach } from 'vitest'
import {
    SUBMISSION_SECURITY_POLICY,
    SubmissionSecurityError,
    consumeSubmissionRateLimitToken,
    detectSubmissionThreat,
    resetSubmissionRateLimits,
    validateSubmissionPayload,
} from '../../src/modules/submission/submission.security.js'

describe('submission.security', () => {
    beforeEach(() => {
        resetSubmissionRateLimits()
    })

    describe('validateSubmissionPayload()', () => {
        it('accepts a normal algorithm submission', () => {
            const payload = validateSubmissionPayload({
                userId: 'user-1',
                problemId: 'prob-1',
                language: 'javascript',
                code: 'function twoSum(nums, target) { return [0, 1]; }',
            })

            expect(payload.language).toBe('javascript')
        })

        it('blocks javascript child_process usage as RCE', () => {
            expect(() => validateSubmissionPayload({
                userId: 'user-1',
                problemId: 'prob-1',
                language: 'javascript',
                code: 'const { exec } = require("child_process")',
            })).toThrowError(SubmissionSecurityError)
        })

        it('blocks python environment access as data leak', () => {
            expect(() => validateSubmissionPayload({
                userId: 'user-1',
                problemId: 'prob-1',
                language: 'python',
                code: 'import os\nprint(os.environ)',
            })).toThrow('DATA_LEAK')
        })

        it('blocks code that exceeds the maximum line count', () => {
            const manyLines = new Array(SUBMISSION_SECURITY_POLICY.maxCodeLines + 1).fill('pass').join('\n')

            expect(() => validateSubmissionPayload({
                userId: 'user-1',
                problemId: 'prob-1',
                language: 'python',
                code: manyLines,
            })).toThrow('maximum length')
        })
    })

    describe('detectSubmissionThreat()', () => {
        it('returns sandbox escape threat for host path probing', () => {
            const threat = detectSubmissionThreat('cpp', 'std::string probe = "/proc/1/cgroup";')

            expect(threat?.category).toBe('SANDBOX_ESCAPE')
        })
    })

    describe('consumeSubmissionRateLimitToken()', () => {
        it('allows requests up to the configured limit', () => {
            const key = '127.0.0.1:user-1'

            for (let attempt = 0; attempt < SUBMISSION_SECURITY_POLICY.maxSubmissionsPerWindow; attempt += 1) {
                expect(consumeSubmissionRateLimitToken(key, attempt * 1000).allowed).toBe(true)
            }
        })

        it('blocks the first request over the limit', () => {
            const key = '127.0.0.1:user-1'
            const now = 10_000

            for (let attempt = 0; attempt < SUBMISSION_SECURITY_POLICY.maxSubmissionsPerWindow; attempt += 1) {
                consumeSubmissionRateLimitToken(key, now + attempt)
            }

            const decision = consumeSubmissionRateLimitToken(key, now + 99)

            expect(decision.allowed).toBe(false)
            expect(decision.retryAfterSeconds).toBeGreaterThan(0)
        })
    })
})
