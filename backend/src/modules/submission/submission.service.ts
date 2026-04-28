import { createSubmission } from './submission.repo.js'
import { publishJob, QUEUES, type SubmissionJobPayload } from '../../shared/queue.js'
import { validateSubmissionPayload } from './submission.security.js'

export interface SubmitCodeRequest {
    userId: string
    problemId: string
    language: string
    code: string
}

export interface SubmitCodeResponse {
    submissionId: string
    status: string
    message: string
}

export async function submitCode(req: SubmitCodeRequest): Promise<SubmitCodeResponse> {
    const safeRequest = validateSubmissionPayload(req)

    const submission = await createSubmission({
        userId: safeRequest.userId,
        problemId: safeRequest.problemId,
        language: safeRequest.language,
        code: safeRequest.code,
    })

    const payload: SubmissionJobPayload = {
        submissionId: submission.id,
        problemId: safeRequest.problemId,
        userId: safeRequest.userId,
        language: safeRequest.language,
        code: safeRequest.code,
    }

    const published = publishJob(QUEUES.SUBMISSION, payload)

    if (!published) {
        console.warn(`[SubmissionService] Queue buffer full for submissionId=${submission.id}`)
    }

    console.log(`[SubmissionService] Submitted submissionId=${submission.id} lang=${safeRequest.language}`)

    return {
        submissionId: submission.id,
        status: 'PENDING',
        message: 'Submission received. Use submissionId to poll for result.',
    }
}
