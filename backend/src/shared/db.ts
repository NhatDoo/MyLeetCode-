import 'dotenv/config'
import { PrismaClient, Prisma } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

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
            },
        },
    },
})

export function createPrismaClient() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    })

    pool.on('error', (err) => {
        console.error('[DB Pool] Unexpected error on idle client', err)
    })

    const adapter = new PrismaPg(pool)
    const client = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    })

    return client.$extends(extension)
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>

type GlobalPrisma = {
    prisma?: ExtendedPrismaClient
}

const globalForPrisma = globalThis as unknown as GlobalPrisma

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

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

export async function withTransaction<T>(
    fn: (tx: Parameters<Parameters<(typeof prisma)['$transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
    return (prisma as any).$transaction(async (tx: any) => {
        return fn(tx)
    })
}
