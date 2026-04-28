import { prisma } from '../../shared/db.js'
import { SubmissionStatus } from '../../generated/prisma/client.js'
import type { JudgeResult } from '../execution/judge.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateSubmissionInput {
    userId: string
    problemId: string
    language: string
    code: string
}

// ─── Repo ────────────────────────────────────────────────────────────────────

/**
 * Tạo submission mới với trạng thái PENDING.
 * Service layer gọi hàm này TRƯỚC khi publish vào queue.
 */
export async function createSubmission(input: CreateSubmissionInput) {
    return prisma.submission.create({
        data: {
            userId: input.userId,
            problemId: input.problemId,
            language: input.language,
            code: input.code,
            status: SubmissionStatus.PENDING,
        },
        select: {
            id: true,
            userId: true,
            problemId: true,
            language: true,
            status: true,
            createdAt: true,
        },
    })
}

/**
 * Chuyển submission sang RUNNING khi worker bắt đầu xử lý.
 */
export async function markSubmissionRunning(submissionId: string) {
    return prisma.submission.update({
        where: { id: submissionId },
        data: { status: SubmissionStatus.RUNNING },
    })
}

/**
 * Cập nhật kết quả cuối cùng sau khi judge xong.
 * Dùng transaction để đảm bảo submission + logs được ghi đồng thời.
 */
export async function saveSubmissionResult(
    submissionId: string,
    judgeResult: JudgeResult,
) {
    return prisma.$transaction(async (tx) => {
        // 1. Cập nhật submission
        await tx.submission.update({
            where: { id: submissionId },
            data: {
                status: judgeResult.status,
                score: judgeResult.score,
                result: judgeResult.detail as object,   // Json field
            },
        })

        // 2. Ghi ExecutionLog cho từng test case
        if (judgeResult.detail.length > 0) {
            await tx.executionLog.createMany({
                data: judgeResult.detail.map(d => ({
                    submissionId,
                    testcaseId: d.testCaseId,
                    status: d.passed ? 'PASSED' : judgeResult.status,
                    runtime: d.runtimeMs,
                    memory: 0,   // TODO: đo memory usage thực tế từ docker stats
                })),
            })
        }
    })
}

/**
 * Chuyển về RUNTIME_ERROR khi worker gặp lỗi không mong muốn.
 */
export async function markSubmissionFailed(submissionId: string, errorMessage: string) {
    return prisma.submission.update({
        where: { id: submissionId },
        data: {
            status: SubmissionStatus.RUNTIME_ERROR,
            result: { error: errorMessage },
        },
    })
}

/**
 * Lấy kết quả submission theo ID (dành cho polling hoặc API).
 */
export async function getSubmissionById(submissionId: string) {
    return prisma.submission.findUnique({
        where: { id: submissionId },
        select: {
            id: true,
            status: true,
            score: true,
            result: true,
            language: true,
            createdAt: true,
            updatedAt: true,
        },
    })
}

/**
 * Lấy test cases của một problem (bao gồm hidden).
 * Chỉ được gọi bởi worker — không expose ra API.
 */
export async function getTestCasesByProblemId(problemId: string) {
    return prisma.testCase.findMany({
        where: { problemId },
        select: {
            id: true,
            input: true,
            expected: true,
            isHidden: true,
        },
    })
}
