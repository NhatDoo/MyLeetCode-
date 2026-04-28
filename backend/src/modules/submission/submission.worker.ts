import { consumeQueue, QUEUES, type SubmissionJobPayload } from '../../shared/queue.js'
import { executeCode } from '../execution/executor.js'
import { judge } from '../execution/judge.js'
import { sanitizeExecutionFailureMessage } from './submission.security.js'
import {
    getTestCasesByProblemId,
    markSubmissionRunning,
    markSubmissionFailed,
    saveSubmissionResult,
} from './submission.repo.js'

// ─── Worker Bootstrap ────────────────────────────────────────────────────────

/**
 * Khởi động worker — đăng ký consumer vào RabbitMQ.
 * Gọi hàm này sau khi connectQueue() thành công.
 *
 * prefetch=1: mỗi worker chỉ xử lý 1 job tại một thời điểm
 * → đảm bảo không overload Docker host (Rule 8)
 */
export async function startSubmissionWorker(): Promise<void> {
    await consumeQueue<SubmissionJobPayload>(
        QUEUES.SUBMISSION,
        handleSubmissionJob,
        { prefetch: 1 },
    )

    console.log('[Worker] Submission worker is running...')
}

// ─── Job Handler ─────────────────────────────────────────────────────────────

/**
 * Xử lý một submission job từ queue.
 *
 * Luồng:
 *   PENDING → RUNNING → (execute + judge) → ACCEPTED | WA | TLE | RE
 *
 * Nếu worker lỗi bất ngờ → mark RUNTIME_ERROR, không requeue
 * để tránh vòng lặp vô hạn.
 */
async function handleSubmissionJob(payload: SubmissionJobPayload): Promise<void> {
    const { submissionId, problemId, language, code } = payload

    console.log(`[Worker] Processing submissionId=${submissionId} lang=${language}`)

    // Bước 1: Chuyển sang RUNNING
    await markSubmissionRunning(submissionId)

    // Bước 2: Lấy test cases (bao gồm hidden) — chỉ worker được phép làm việc này
    const testCases = await getTestCasesByProblemId(problemId)

    if (testCases.length === 0) {
        console.warn(`[Worker] No test cases found for problemId=${problemId}`)
        await markSubmissionFailed(submissionId, 'No test cases configured for this problem')
        return
    }

    // Bước 3: Thực thi code trong Docker sandbox
    let executionResult
    try {
        executionResult = await executeCode(language, code, testCases)
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[Worker] Execution error for submissionId=${submissionId}:`, message)
        await markSubmissionFailed(submissionId, sanitizeExecutionFailureMessage(message))
        return
    }

    // Bước 4: Judge kết quả
    const hiddenIds = new Set(
        testCases.filter(tc => tc.isHidden).map(tc => tc.id)
    )
    const judgeResult = judge(executionResult, hiddenIds)

    // Bước 5: Ghi kết quả vào DB (submission + execution logs) bằng transaction
    await saveSubmissionResult(submissionId, judgeResult)

    console.log(
        `[Worker] Done submissionId=${submissionId} ` +
        `status=${judgeResult.status} ` +
        `score=${judgeResult.score} ` +
        `passed=${judgeResult.passedCount}/${judgeResult.totalCount} ` +
        `time=${judgeResult.totalRuntimeMs}ms`
    )
}
