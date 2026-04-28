import { type ExecutionResult, type TestCaseResult } from './executor.js'
import { SubmissionStatus } from '../../generated/prisma/client.js'

export interface JudgeResult {
    status: SubmissionStatus
    score: number
    passedCount: number
    totalCount: number
    totalRuntimeMs: number
    detail: TestCaseDetail[]
}

export interface TestCaseDetail {
    testCaseId: string
    passed: boolean
    isHidden: boolean
    stdout: string | null
    stderr: string | null
    expected: string | null
    runtimeMs: number
    timedOut: boolean
}

export function judge(
    executionResult: ExecutionResult,
    hiddenTestCaseIds: Set<string>,
): JudgeResult {
    const { testResults, totalCount, totalRuntimeMs } = executionResult
    const status = determineStatus(testResults)
    const passedCount = testResults.filter((result) => result.passed).length
    const score = status === SubmissionStatus.ACCEPTED
        ? 100
        : Math.floor((passedCount / totalCount) * 100)

    const detail: TestCaseDetail[] = testResults.map((result) => {
        const isHidden = hiddenTestCaseIds.has(result.testCaseId)
        return {
            testCaseId: result.testCaseId,
            passed: result.passed,
            isHidden,
            stdout: isHidden ? null : result.stdout,
            stderr: isHidden ? null : result.stderr,
            expected: isHidden ? null : result.expected,
            runtimeMs: result.runtimeMs,
            timedOut: result.timedOut,
        }
    })

    console.log(`[Judge] status=${status} score=${score} passed=${passedCount}/${totalCount}`)

    return {
        status,
        score,
        passedCount,
        totalCount,
        totalRuntimeMs,
        detail,
    }
}

function determineStatus(results: TestCaseResult[]): SubmissionStatus {
    let hasWrongAnswer = false
    let hasTLE = false
    let hasRuntimeError = false

    for (const result of results) {
        if (result.timedOut) {
            hasTLE = true
            continue
        }

        if (result.securityViolation) {
            hasRuntimeError = true
            continue
        }

        if (result.exitCode !== 0) {
            hasRuntimeError = true
            continue
        }

        if (!result.passed) {
            hasWrongAnswer = true
        }
    }

    if (hasRuntimeError) return SubmissionStatus.RUNTIME_ERROR
    if (hasTLE) return SubmissionStatus.TIME_LIMIT_EXCEEDED
    if (hasWrongAnswer) return SubmissionStatus.WRONG_ANSWER

    return SubmissionStatus.ACCEPTED
}
