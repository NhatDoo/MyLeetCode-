import { runInDocker, type DockerRunResult } from './docker.runner.js'

// ─── Supported Languages ─────────────────────────────────────────────────────

export type SupportedLanguage = 'javascript' | 'python' | 'cpp'

interface LanguageConfig {
    image: string    // Docker image đã build sẵn (Rule 7)
    filename: string    // Tên file solution bên trong container
    runCmd: string[]  // Command để chạy file đó
}

// Map ngôn ngữ → Docker image + cách chạy
// Image phải được build sẵn, không build lúc runtime
const LANGUAGE_CONFIG: Record<SupportedLanguage, LanguageConfig> = {
    javascript: {
        image: 'leetcode-runner-node:latest',
        filename: 'solution.js',
        runCmd: ['node', '/usr/local/bin/wrapper.js'],
    },
    python: {
        image: 'leetcode-runner-python:latest',
        filename: 'solution.py',
        runCmd: ['python3', '/usr/local/bin/wrapper.py'],
    },
    cpp: {
        image: 'leetcode-runner-cpp:latest',
        filename: 'solution.cpp',
        runCmd: ['/usr/local/bin/wrapper.sh'],
    },
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TestCase {
    id: string
    input: string
    expected: string
    isHidden: boolean
}

export interface TestCaseResult {
    testCaseId: string
    passed: boolean
    stdout: string
    stderr: string
    expected: string
    exitCode: number
    timedOut: boolean
    securityViolation: string | null
    runtimeMs: number
}

export interface ExecutionResult {
    language: SupportedLanguage
    testResults: TestCaseResult[]
    passedCount: uint8            // 0-255 đủ cho số test case
    totalCount: uint8
    allPassed: boolean
    totalRuntimeMs: number
}

// TypeScript không có uint8, dùng number nhưng constrain bằng logic
type uint8 = number

// ─── Time Limits ─────────────────────────────────────────────────────────────

const TIME_LIMIT_MS: Record<SupportedLanguage, number> = {
    javascript: 5_000,
    python: 10_000,
    cpp: 5_000,
}

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Thực thi code của user trên toàn bộ test cases.
 * Rule 3: Luôn dùng wrapper (stdin protocol) thay vì chạy raw.
 * Rule 8: Luôn có timeout.
 * Rule 10: Log đầy đủ.
 */
export async function executeCode(
    language: string,
    code: string,
    testCases: TestCase[],
): Promise<ExecutionResult> {
    // Validate ngôn ngữ
    if (!(language in LANGUAGE_CONFIG)) {
        throw new Error(`[Executor] Unsupported language: ${language}`)
    }

    const lang = language as SupportedLanguage
    const config = LANGUAGE_CONFIG[lang]
    const limit = TIME_LIMIT_MS[lang]

    const testResults: TestCaseResult[] = []
    let totalRuntimeMs = 0

    // Chạy tuần tự từng test case (deterministic, Rule 6)
    for (const tc of testCases) {
        console.log(`[Executor] Running testCase=${tc.id} lang=${lang}`)

        const runResult: DockerRunResult = await runInDocker({
            image: config.image,
            code,
            filename: config.filename,
            runCmd: config.runCmd,
            input: tc.input,
            timeoutMs: limit,
        })

        totalRuntimeMs += runResult.runtimeMs

        const passed = !runResult.timedOut
            && !runResult.outputLimitExceeded
            && runResult.exitCode === 0
            && normalizeOutput(runResult.stdout) === normalizeOutput(tc.expected)

        const result: TestCaseResult = {
            testCaseId: tc.id,
            passed,
            stdout: runResult.stdout,
            stderr: runResult.stderr,
            expected: tc.expected,
            exitCode: runResult.exitCode,
            timedOut: runResult.timedOut,
            securityViolation: runResult.securityViolation,
            runtimeMs: runResult.runtimeMs,
        }

        testResults.push(result)

        // Log theo Rule 10
        console.log(`[Executor] testCase=${tc.id} passed=${passed} exit=${runResult.exitCode} time=${runResult.runtimeMs}ms`)

        // Fail fast: nếu 1 test lỗi không cần chạy tiếp
        // (Optional: bỏ comment nếu muốn chạy hết toàn bộ để hiện tất cả kết quả)
        // if (!passed) break
    }

    const passedCount = testResults.filter(r => r.passed).length

    return {
        language: lang,
        testResults,
        passedCount: passedCount as uint8,
        totalCount: testCases.length as uint8,
        allPassed: passedCount === testCases.length,
        totalRuntimeMs,
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Chuẩn hóa output trước khi so sánh.
 * Loại bỏ trailing whitespace, normalize line endings.
 * Rule 6: Deterministic comparison.
 */
function normalizeOutput(raw: string): string {
    return raw
        .replace(/\r\n/g, '\n')  // Windows → Unix line ending
        .replace(/\r/g, '\n')
        .trim()
}
