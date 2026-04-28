import { spawn } from 'child_process'

export interface DockerRunOptions {
    image: string
    code: string
    filename: string
    runCmd: string[]
    input: string
    timeoutMs: number
    memoryLimitMb?: number
}

export interface DockerRunResult {
    stdout: string
    stderr: string
    exitCode: number
    timedOut: boolean
    outputLimitExceeded: boolean
    securityViolation: string | null
    runtimeMs: number
}

const DEFAULT_MEMORY_MB = 64
const SANDBOX_DIR = '/sandbox'
const TMP_DIR = '/tmp'
const MAX_STDOUT_BYTES = 16 * 1024
const MAX_STDERR_BYTES = 16 * 1024

export function runInDocker(opts: DockerRunOptions): Promise<DockerRunResult> {
    const memoryMb = opts.memoryLimitMb ?? DEFAULT_MEMORY_MB

    const dockerArgs = [
        'run',
        '--rm',
        '--network', 'none',
        '--read-only',
        '--tmpfs', `${SANDBOX_DIR}:rw,size=8m,uid=1001,gid=1001,mode=1777`,
        '--tmpfs', `${TMP_DIR}:rw,noexec,nosuid,size=4m`,
        '--user', '1001:1001',
        '--workdir', SANDBOX_DIR,
        '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges',
        '--ipc', 'none',
        '--pids-limit', '64',
        '--cpus', '0.5',
        '--memory', `${memoryMb}m`,
        '--memory-swap', `${memoryMb}m`,
        '--ulimit', 'nproc=64:64',
        '--ulimit', 'nofile=64:64',
        '--ulimit', 'fsize=1048576:1048576',
        '--no-healthcheck',
        '-i',
        opts.image,
        ...opts.runCmd,
    ]

    return new Promise((resolve) => {
        const startTime = Date.now()
        let stdout = ''
        let stderr = ''
        let timedOut = false
        let outputLimitExceeded = false
        let securityViolation: string | null = null
        let settled = false

        const child = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

        child.stdin.write(opts.code + '\n---INPUT---\n' + opts.input)
        child.stdin.end()

        child.stdout.on('data', (chunk: Buffer) => {
            const next = appendBoundedChunk(stdout, chunk, MAX_STDOUT_BYTES)
            stdout = next.value

            if (next.exceeded && !outputLimitExceeded) {
                outputLimitExceeded = true
                securityViolation = '[Security] Output limit exceeded on stdout'
                child.kill('SIGKILL')
            }
        })

        child.stderr.on('data', (chunk: Buffer) => {
            const next = appendBoundedChunk(stderr, chunk, MAX_STDERR_BYTES)
            stderr = next.value

            if (next.exceeded && !outputLimitExceeded) {
                outputLimitExceeded = true
                securityViolation = '[Security] Output limit exceeded on stderr'
                child.kill('SIGKILL')
            }
        })

        const timer = setTimeout(() => {
            timedOut = true
            child.kill('SIGKILL')
        }, opts.timeoutMs)

        child.on('close', (code) => {
            if (settled) return
            settled = true
            clearTimeout(timer)

            const runtimeMs = Date.now() - startTime

            console.log(
                `[Runner] exit=${code} time=${runtimeMs}ms timedOut=${timedOut} outputLimited=${outputLimitExceeded}`,
            )

            resolve({
                stdout: stdout.trim(),
                stderr: appendSecurityViolation(stderr, securityViolation).trim(),
                exitCode: code ?? 1,
                timedOut,
                outputLimitExceeded,
                securityViolation,
                runtimeMs,
            })
        })

        child.on('error', (err) => {
            if (settled) return
            settled = true
            clearTimeout(timer)

            console.error('[Runner] spawn error:', err)
            resolve({
                stdout: '',
                stderr: err.message,
                exitCode: 1,
                timedOut: false,
                outputLimitExceeded: false,
                securityViolation: null,
                runtimeMs: Date.now() - startTime,
            })
        })
    })
}

function appendBoundedChunk(current: string, chunk: Buffer, byteLimit: number): { value: string, exceeded: boolean } {
    const usedBytes = Buffer.byteLength(current)
    const remainingBytes = byteLimit - usedBytes

    if (remainingBytes <= 0) {
        return { value: current, exceeded: true }
    }

    if (chunk.length <= remainingBytes) {
        return { value: current + chunk.toString('utf8'), exceeded: false }
    }

    return {
        value: current + chunk.subarray(0, remainingBytes).toString('utf8'),
        exceeded: true,
    }
}

function appendSecurityViolation(stderr: string, securityViolation: string | null): string {
    if (!securityViolation) {
        return stderr
    }

    if (stderr.includes(securityViolation)) {
        return stderr
    }

    return stderr.length > 0 ? `${stderr}\n${securityViolation}` : securityViolation
}
