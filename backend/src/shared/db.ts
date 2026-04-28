import 'dotenv/config'
import { PrismaClient, Prisma } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// ─── Query Monitoring Extension ─────────────────────────────────────────────
const extension = Prisma.defineExtension({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const start = Date.now()
                try {
                    const result = await query(args)
                    const duration = Date.now() - start
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[DB] ${model}.${operation} - ${duration}ms`)
                    }
                    return result
                } catch (err) {
                    const duration = Date.now() - start
                    console.error(`[DB] ${model}.${operation} FAILED after ${duration}ms`, err)
                    throw err
                }
            }
        }
    }
})

// ─── Client Factory ──────────────────────────────────────────────────────────
export function createPrismaClient() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,                 // max connections trong pool
        idleTimeoutMillis: 30_000,   // đóng idle connection sau 30s
        connectionTimeoutMillis: 5_000, // timeout nếu không lấy được conn sau 5s
    })

    // Log lỗi pool-level (connection drop, timeout,...) 
    pool.on('error', (err) => {
        console.error('[DB Pool] Unexpected error on idle client', err)
    })

    const adapter = new PrismaPg(pool)
    const client = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error']
    })

    return client.$extends(extension)
}

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Kiểu của Extended Prisma Client (sau khi gọi $extends).
 * Prisma không expose $connect/$disconnect trên extended type,
 * nên các hàm connect/disconnect dùng `as any` — đây là workaround đã biết.
 * @see https://github.com/prisma/prisma/issues/16608
 */
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>

type GlobalPrisma = {
    prisma?: ExtendedPrismaClient
}

// ─── Singleton ───────────────────────────────────────────────────────────────
const globalForPrisma = globalThis as unknown as GlobalPrisma

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export async function connectDB(): Promise<void> {
    try {
        await (prisma as any).$connect()
        console.log('[DB] Connected successfully')
    } catch (err) {
        console.error('[DB] Connection failed:', err)
        process.exit(1)
    }
}

export async function disconnectDB(): Promise<void> {
    try {
        await (prisma as any).$disconnect()
        console.log('[DB] Disconnected successfully')
    } catch (err) {
        console.error('[DB] Error during disconnect:', err)
    }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

shutdownSignals.forEach(signal => {
    process.on(signal, async () => {
        console.log(`[DB] Received ${signal}, shutting down...`)
        await disconnectDB()
        process.exit(0)
    })
})

// ─── Transaction Helper ──────────────────────────────────────────────────────

/**
 * Bọc logic trong một Prisma transaction.
 * `tx` được type là `any` vì Prisma extended client chưa expose
 * đúng kiểu cho $transaction callback — behavior vẫn đúng ở runtime.
 */
export async function withTransaction<T>(
    fn: (tx: Parameters<Parameters<(typeof prisma)['$transaction']>[0]>[0]) => Promise<T>
): Promise<T> {
    return (prisma as any).$transaction(async (tx: any) => {
        return fn(tx)
    })
}
