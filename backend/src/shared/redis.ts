import 'dotenv/config'
import { createClient } from 'redis'

type AppRedisClient = ReturnType<typeof createClient>

let redisClient: AppRedisClient | null = null
let connectPromise: Promise<AppRedisClient> | null = null

export async function connectRedis(): Promise<void> {
    await getRedisClient()
}

export async function disconnectRedis(): Promise<void> {
    const client = redisClient
    redisClient = null
    connectPromise = null

    if (!client) {
        return
    }

    try {
        if (client.isOpen) {
            await client.quit()
        }
    } catch (error) {
        console.error('[Redis] Error during disconnect:', error)
        await client.disconnect()
    }
}

export async function getRedisClient(): Promise<AppRedisClient> {
    if (redisClient?.isOpen) {
        return redisClient
    }

    if (connectPromise) {
        return connectPromise
    }

    const url = process.env.REDIS_URL?.trim()
    if (!url) {
        throw new Error('[Redis] REDIS_URL is not defined in environment')
    }

    const client = createClient({
        url,
        socket: {
            reconnectStrategy(retries) {
                return Math.min(retries * 100, 5_000)
            },
        },
    })

    client.on('error', (error) => {
        console.error('[Redis] Client error:', error)
    })

    connectPromise = (async () => {
        await client.connect()
        redisClient = client
        console.log('[Redis] Connected successfully')
        return client
    })()

    try {
        return await connectPromise
    } finally {
        connectPromise = null
    }
}
