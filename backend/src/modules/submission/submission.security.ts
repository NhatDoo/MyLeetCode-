import type { NextFunction, Request, Response } from 'express'
import {
    InMemorySubmissionRateLimitStore,
    RedisSubmissionRateLimitStore,
    type SubmissionRateLimitStore,
} from './submission.rate-limit.js'

export const SUPPORTED_LANGUAGES = ['javascript', 'python', 'cpp'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const SUBMISSION_SECURITY_POLICY = {
    maxCodeLength: 64_000,
    maxCodeLines: 1_200,
    maxRequestBodyBytes: 72_000,
    rateLimitWindowMs: 60_000,
    maxSubmissionsPerWindow: 10,
} as const

type ThreatCategory = 'RCE' | 'SANDBOX_ESCAPE' | 'DATA_LEAK'

interface ThreatSignature {
    category: ThreatCategory
    reason: string
    pattern: RegExp
}

export interface SubmissionRequestBodyShape {
    problemId: string
    language: SupportedLanguage
    code: string
}

export interface SubmissionPayloadShape extends SubmissionRequestBodyShape {
    userId: string
}

const GENERIC_DANGEROUS_PATH_PATTERN = /(?:\/proc\/|\/sys\/|\/dev\/|\/etc\/|\/var\/run\/docker\.sock|\\windows\\system32\\|[a-z]:\\)/i
let submissionRateLimitStore: SubmissionRateLimitStore = createSubmissionRateLimitStore()

const THREAT_SIGNATURES: Record<SupportedLanguage, ThreatSignature[]> = {
    javascript: [
        {
            category: 'RCE',
            reason: 'process creation is not allowed in submissions',
            pattern: /\b(?:require\s*\(\s*['"]child_process['"]\s*\)|from\s+['"]child_process['"]|import\s+['"]child_process['"]|\b(?:exec|execFile|spawn|fork)\s*\()/i,
        },
        {
            category: 'RCE',
            reason: 'network access is blocked in the judge sandbox',
            pattern: /\b(?:require\s*\(\s*['"](?:http|https|net|tls|dgram)['"]\s*\)|from\s+['"](?:http|https|net|tls|dgram)['"]|fetch\s*\()/i,
        },
        {
            category: 'DATA_LEAK',
            reason: 'environment and filesystem access are not allowed',
            pattern: /\b(?:process\.env|require\s*\(\s*['"]fs(?:\/promises)?['"]\s*\)|from\s+['"]fs(?:\/promises)?['"]|fs\.(?:readFile|writeFile|readdir|createReadStream|createWriteStream))\b/i,
        },
        {
            category: 'SANDBOX_ESCAPE',
            reason: 'host and container internals cannot be inspected',
            pattern: /\b(?:process\.binding|module\.require)\b|\/proc\/|\/sys\/|docker\.sock/i,
        },
    ],
    python: [
        {
            category: 'RCE',
            reason: 'spawning shell commands is not allowed',
            pattern: /\b(?:import\s+subprocess|from\s+subprocess\s+import|os\.system\s*\(|subprocess\.(?:Popen|run|call|check_call|check_output)\s*\()/i,
        },
        {
            category: 'RCE',
            reason: 'network access is blocked in the judge sandbox',
            pattern: /\b(?:import\s+socket|from\s+socket\s+import|import\s+requests|from\s+requests\s+import|urllib\.)/i,
        },
        {
            category: 'DATA_LEAK',
            reason: 'environment and host file reads are not allowed',
            pattern: /\b(?:os\.environ|os\.getenv|pathlib\.Path\s*\(|open\s*\(\s*['"](?:\/|\.\.\/))/i,
        },
        {
            category: 'SANDBOX_ESCAPE',
            reason: 'sandbox escape primitives are blocked',
            pattern: /\b(?:import\s+ctypes|from\s+ctypes\s+import|ptrace|mount\s*\(|unshare\s*\(|setns\s*\()/i,
        },
    ],
    cpp: [
        {
            category: 'RCE',
            reason: 'process creation is not allowed in submissions',
            pattern: /\b(?:system|popen|fork|execl|execle|execlp|execv|execve|execvp)\s*\(/i,
        },
        {
            category: 'RCE',
            reason: 'network access is blocked in the judge sandbox',
            pattern: /\b(?:socket|connect|bind|listen|accept)\s*\(/i,
        },
        {
            category: 'DATA_LEAK',
            reason: 'host file reads are not allowed',
            pattern: /\b(?:ifstream|fstream)\b[\s\S]{0,120}["'](?:\/|[a-z]:\\)/i,
        },
        {
            category: 'SANDBOX_ESCAPE',
            reason: 'sandbox escape primitives are blocked',
            pattern: /\b(?:ptrace|mount|unshare|setns|clone)\s*\(/i,
        },
    ],
}

export class SubmissionSecurityError extends Error {
    readonly statusCode: number
    readonly code: string

    constructor(message: string, statusCode = 400, code = 'SUBMISSION_SECURITY_VIOLATION') {
        super(message)
        this.name = 'SubmissionSecurityError'
        this.statusCode = statusCode
        this.code = code
    }
}

export class SubmissionProcessingError extends Error {
    readonly statusCode: number
    readonly code: string

    constructor(message: string, statusCode = 500, code = 'SUBMISSION_PROCESSING_ERROR') {
        super(message)
        this.name = 'SubmissionProcessingError'
        this.statusCode = statusCode
        this.code = code
    }
}

export function isSubmissionSecurityError(error: unknown): error is SubmissionSecurityError {
    return error instanceof SubmissionSecurityError
}

export function isSubmissionProcessingError(error: unknown): error is SubmissionProcessingError {
    return error instanceof SubmissionProcessingError
}

export async function submissionSecurityMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        ensureJsonRequest(req)

        let decision: { allowed: boolean, retryAfterSeconds: number }
        try {
            decision = await consumeSubmissionRateLimitToken(buildSubmissionRateLimitKey(req))
        } catch (error) {
            console.error('[SubmissionSecurity] Rate limiter unavailable:', error)
            throw new SubmissionProcessingError(
                'Submission rate limiter is temporarily unavailable. Please retry.',
                503,
                'SUBMISSION_RATE_LIMITER_UNAVAILABLE',
            )
        }

        if (!decision.allowed) {
            res.setHeader('Retry-After', String(decision.retryAfterSeconds))
            throw new SubmissionSecurityError(
                `Too many submissions. Please retry in ${decision.retryAfterSeconds} seconds.`,
                429,
                'SUBMISSION_RATE_LIMITED',
            )
        }

        req.body = validateSubmissionRequestBody(req.body)
        next()
    } catch (error) {
        next(error)
    }
}

export function applySecurityHeaders(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    next()
}

export function validateSubmissionPayload(raw: unknown): SubmissionPayloadShape {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new SubmissionSecurityError('Submission payload must be a JSON object', 400, 'INVALID_SUBMISSION_PAYLOAD')
    }

    const payload = raw as Record<string, unknown>
    const userId = readRequiredString(payload.userId, 'userId')
    const requestBody = validateSubmissionRequestBody(payload)

    return {
        userId,
        ...requestBody,
    }
}

export function validateSubmissionRequestBody(raw: unknown): SubmissionRequestBodyShape {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new SubmissionSecurityError('Submission payload must be a JSON object', 400, 'INVALID_SUBMISSION_PAYLOAD')
    }

    const payload = raw as Record<string, unknown>
    const problemId = readRequiredString(payload.problemId, 'problemId')
    const language = readRequiredLanguage(payload.language)
    const code = readRequiredCode(payload.code)
    const codeLines = code.split(/\r\n|\r|\n/).length
    if (codeLines > SUBMISSION_SECURITY_POLICY.maxCodeLines) {
        throw new SubmissionSecurityError(
            `Code exceeds maximum length of ${SUBMISSION_SECURITY_POLICY.maxCodeLines} lines`,
            400,
            'SUBMISSION_TOO_LARGE',
        )
    }

    const threat = detectSubmissionThreat(language, code)
    if (threat) {
        throw new SubmissionSecurityError(
            `Blocked by submission security policy (${threat.category}): ${threat.reason}`,
            400,
            'SUBMISSION_BLOCKED',
        )
    }

    return {
        problemId,
        language,
        code,
    }
}

export function detectSubmissionThreat(language: SupportedLanguage, code: string): ThreatSignature | null {
    const signatures = THREAT_SIGNATURES[language]
    for (const signature of signatures) {
        if (matchesThreatPattern(signature.pattern, code)) {
            return signature
        }
    }

    if (matchesThreatPattern(GENERIC_DANGEROUS_PATH_PATTERN, code)) {
        return {
            category: 'SANDBOX_ESCAPE',
            reason: 'host-level paths are not allowed in submissions',
            pattern: GENERIC_DANGEROUS_PATH_PATTERN,
        }
    }

    return null
}

export async function consumeSubmissionRateLimitToken(
    key: string,
    now = Date.now(),
): Promise<{ allowed: boolean, retryAfterSeconds: number }> {
    return submissionRateLimitStore.consume(key, now)
}

export async function resetSubmissionRateLimits(): Promise<void> {
    await submissionRateLimitStore.reset?.()
}

export function setSubmissionRateLimitStoreForTests(store: SubmissionRateLimitStore | null): void {
    submissionRateLimitStore = store ?? createSubmissionRateLimitStore()
}

export function sanitizeExecutionFailureMessage(message: string): string {
    if (message.startsWith('[Security]')) {
        return message.replace(/^\[Security\]\s*/, '')
    }

    if (message.startsWith('[Validation]')) {
        return message.replace(/^\[Validation\]\s*/, '')
    }

    return 'Execution failed inside the sandbox infrastructure'
}

export function apiErrorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
    if (isBodyTooLargeError(error)) {
        res.status(413).json({
            error: `Request body too large. Maximum size is ${SUBMISSION_SECURITY_POLICY.maxRequestBodyBytes} bytes.`,
        })
        return
    }

    if (isMalformedJsonError(error)) {
        res.status(400).json({ error: 'Malformed JSON request body' })
        return
    }

    if (isSubmissionSecurityError(error)) {
        res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
        })
        return
    }

    if (isSubmissionProcessingError(error)) {
        res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
        })
        return
    }

    console.error('[HTTP] Unhandled error:', error)
    res.status(500).json({ error: 'Internal server error' })
}

function ensureJsonRequest(req: Request): void {
    if (!req.is(['application/json', 'application/*+json'])) {
        throw new SubmissionSecurityError(
            'Content-Type must be application/json',
            415,
            'UNSUPPORTED_MEDIA_TYPE',
        )
    }
}

function buildSubmissionRateLimitKey(req: Request): string {
    const clientIp = extractClientIp(req)
    const userId = typeof req.auth?.userId === 'string' && req.auth.userId.trim().length > 0
        ? req.auth.userId.trim()
        : 'anonymous'

    return `${clientIp}:${userId}`
}

function extractClientIp(req: Request): string {
    const forwardedFor = req.get('x-forwarded-for')
    if (forwardedFor) {
        const forwardedIp = forwardedFor.split(',')[0]?.trim()
        if (forwardedIp) {
            return forwardedIp
        }
    }

    return req.ip || req.socket.remoteAddress || 'unknown'
}

function readRequiredString(value: unknown, fieldName: string): string {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (!normalized) {
        throw new SubmissionSecurityError(`${fieldName} is required`, 400, 'INVALID_SUBMISSION_PAYLOAD')
    }
    return normalized
}

function readRequiredLanguage(value: unknown): SupportedLanguage {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (!SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
        throw new SubmissionSecurityError(
            `Unsupported language: ${value}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
            400,
            'UNSUPPORTED_LANGUAGE',
        )
    }
    return normalized as SupportedLanguage
}

function readRequiredCode(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new SubmissionSecurityError('Code cannot be empty', 400, 'INVALID_SUBMISSION_PAYLOAD')
    }

    if (value.length > SUBMISSION_SECURITY_POLICY.maxCodeLength) {
        throw new SubmissionSecurityError(
            `Code exceeds maximum length of ${SUBMISSION_SECURITY_POLICY.maxCodeLength} characters`,
            400,
            'SUBMISSION_TOO_LARGE',
        )
    }

    return value
}

function matchesThreatPattern(pattern: RegExp, code: string): boolean {
    if (!pattern.flags.includes('g')) {
        return pattern.test(code)
    }

    const safePattern = new RegExp(pattern.source, pattern.flags.replace(/g/g, ''))
    return safePattern.test(code)
}

function isBodyTooLargeError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false
    }

    const typedError = error as { type?: string, status?: number }
    return typedError.type === 'entity.too.large' || typedError.status === 413
}

function isMalformedJsonError(error: unknown): boolean {
    if (!(error instanceof SyntaxError)) {
        return false
    }

    return 'body' in error
}

function createSubmissionRateLimitStore(): SubmissionRateLimitStore {
    if (process.env.NODE_ENV === 'test') {
        return new InMemorySubmissionRateLimitStore(
            SUBMISSION_SECURITY_POLICY.rateLimitWindowMs,
            SUBMISSION_SECURITY_POLICY.maxSubmissionsPerWindow,
        )
    }

    return new RedisSubmissionRateLimitStore(
        SUBMISSION_SECURITY_POLICY.rateLimitWindowMs,
        SUBMISSION_SECURITY_POLICY.maxSubmissionsPerWindow,
    )
}
