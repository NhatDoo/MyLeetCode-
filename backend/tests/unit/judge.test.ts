import { describe, it, expect } from 'vitest'
import { judge } from '../../src/modules/execution/judge.js'
import { SubmissionStatus } from '../../src/generated/prisma/client.js'
import type { ExecutionResult } from '../../src/modules/execution/executor.js'

function makeResult(overrides: Partial<ExecutionResult>): ExecutionResult {
    return {
        language: 'javascript',
        testResults: [],
        passedCount: 0,
        totalCount: 0,
        allPassed: false,
        totalRuntimeMs: 0,
        ...overrides,
    }
}

function makeTestResult(overrides: object = {}) {
    return {
        testCaseId: 'tc-1',
        passed: true,
        stdout: '5',
        stderr: '',
        expected: '5',
        exitCode: 0,
        timedOut: false,
        securityViolation: null,
        runtimeMs: 50,
        ...overrides,
    }
}

describe('judge()', () => {
    describe('Status determination', () => {
        it('returns ACCEPTED when every test passes', () => {
            const result = makeResult({
                testResults: [
                    makeTestResult({ testCaseId: 'tc-1', passed: true }),
                    makeTestResult({ testCaseId: 'tc-2', passed: true }),
                ],
                passedCount: 2,
                totalCount: 2,
                allPassed: true,
                totalRuntimeMs: 100,
            })

            expect(judge(result, new Set()).status).toBe(SubmissionStatus.ACCEPTED)
        })

        it('returns WRONG_ANSWER when output is incorrect', () => {
            const result = makeResult({
                testResults: [
                    makeTestResult({ testCaseId: 'tc-1', passed: true }),
                    makeTestResult({ testCaseId: 'tc-2', passed: false, stdout: '3', expected: '5', exitCode: 0 }),
                ],
                passedCount: 1,
                totalCount: 2,
            })

            expect(judge(result, new Set()).status).toBe(SubmissionStatus.WRONG_ANSWER)
        })

        it('returns TIME_LIMIT_EXCEEDED when any test times out', () => {
            const result = makeResult({
                testResults: [
                    makeTestResult({ testCaseId: 'tc-1', timedOut: true, passed: false, exitCode: 1 }),
                ],
                passedCount: 0,
                totalCount: 1,
            })

            expect(judge(result, new Set()).status).toBe(SubmissionStatus.TIME_LIMIT_EXCEEDED)
        })

        it('returns RUNTIME_ERROR when exit code is non-zero', () => {
            const result = makeResult({
                testResults: [
                    makeTestResult({ testCaseId: 'tc-1', passed: false, exitCode: 1, timedOut: false }),
                ],
                passedCount: 0,
                totalCount: 1,
            })

            expect(judge(result, new Set()).status).toBe(SubmissionStatus.RUNTIME_ERROR)
        })

        it('returns RUNTIME_ERROR when the runner reports a security violation', () => {
            const result = makeResult({
                testResults: [
                    makeTestResult({ testCaseId: 'tc-1', passed: false, securityViolation: '[Security] Output limit exceeded on stdout' }),
                ],
                passedCount: 0,
                totalCount: 1,
            })

            expect(judge(result, new Set()).status).toBe(SubmissionStatus.RUNTIME_ERROR)
        })
    })

    describe('Score calculation', () => {
        it('returns 100 for accepted submissions', () => {
            const result = makeResult({
                testResults: [makeTestResult({ testCaseId: 'tc-1' })],
                passedCount: 1,
                totalCount: 1,
                allPassed: true,
            })

            expect(judge(result, new Set()).score).toBe(100)
        })

        it('returns partial score when some tests fail', () => {
            const result = makeResult({
                testResults: [
                    makeTestResult({ testCaseId: 'tc-1', passed: true }),
                    makeTestResult({ testCaseId: 'tc-2', passed: false, exitCode: 0, stdout: 'x' }),
                ],
                passedCount: 1,
                totalCount: 2,
            })

            expect(judge(result, new Set()).score).toBe(50)
        })
    })

    describe('Hidden test masking', () => {
        it('hides stdout, stderr, and expected for hidden cases', () => {
            const result = makeResult({
                testResults: [
                    makeTestResult({ testCaseId: 'hidden-1', passed: true, stdout: 'secret', expected: 'secret' }),
                ],
                passedCount: 1,
                totalCount: 1,
                allPassed: true,
            })

            const verdict = judge(result, new Set(['hidden-1']))
            const detail = verdict.detail[0]

            expect(detail?.isHidden).toBe(true)
            expect(detail?.stdout).toBeNull()
            expect(detail?.stderr).toBeNull()
            expect(detail?.expected).toBeNull()
        })
    })
})
