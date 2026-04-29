import { randomUUID } from 'node:crypto'
import { getRedisClient } from '../../shared/redis.js'

export interface SubmissionRateLimitDecision {
    allowed: boolean
    retryAfterSeconds: number
}

export interface SubmissionRateLimitStore {
    consume(key: string, now?: number): Promise<SubmissionRateLimitDecision>
    reset?(): Promise<void>
}

type RateWindow = {
    hits: number[]
}

const REDIS_KEY_PREFIX = 'submission-rate-limit'
const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local windowStart = now - windowMs

redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)

local count = redis.call('ZCARD', key)
if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retryAt = now + windowMs
    if oldest[2] ~= nil then
        retryAt = tonumber(oldest[2]) + windowMs
    end

    redis.call('PEXPIRE', key, windowMs)
    return {0, retryAt}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return {1, 0}
`

export class InMemorySubmissionRateLimitStore implements SubmissionRateLimitStore {
    private readonly windows = new Map<string, RateWindow>()

    constructor(
        private readonly windowMs: number,
        private readonly maxSubmissionsPerWindow: number,
    ) {}

    async consume(key: string, now = Date.now()): Promise<SubmissionRateLimitDecision> {
        const windowStart = now - this.windowMs
        const state = this.windows.get(key) ?? { hits: [] }

        state.hits = state.hits.filter((timestamp) => timestamp > windowStart)
        if (state.hits.length >= this.maxSubmissionsPerWindow) {
            this.windows.set(key, state)
            const retryAt = state.hits[0]! + this.windowMs
            return {
                allowed: false,
                retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)),
            }
        }

        state.hits.push(now)
        this.windows.set(key, state)
        this.cleanup(windowStart)

        return {
            allowed: true,
            retryAfterSeconds: 0,
        }
    }

    async reset(): Promise<void> {
        this.windows.clear()
    }

    private cleanup(windowStart: number): void {
        for (const [key, state] of this.windows.entries()) {
            state.hits = state.hits.filter((timestamp) => timestamp > windowStart)
            if (state.hits.length === 0) {
                this.windows.delete(key)
            }
        }
    }
}

export class RedisSubmissionRateLimitStore implements SubmissionRateLimitStore {
    constructor(
        private readonly windowMs: number,
        private readonly maxSubmissionsPerWindow: number,
    ) {}

    async consume(key: string, now = Date.now()): Promise<SubmissionRateLimitDecision> {
        const client = await getRedisClient()
        const result = await client.eval(RATE_LIMIT_LUA_SCRIPT, {
            keys: [this.buildKey(key)],
            arguments: [
                String(now),
                String(this.windowMs),
                String(this.maxSubmissionsPerWindow),
                `${now}:${randomUUID()}`,
            ],
        }) as [number | string, number | string]

        const allowedFlag = Number(result[0] ?? 0)
        const retryAt = Number(result[1] ?? 0)

        if (allowedFlag === 1) {
            return {
                allowed: true,
                retryAfterSeconds: 0,
            }
        }

        return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)),
        }
    }

    private buildKey(key: string): string {
        return `${REDIS_KEY_PREFIX}:${key}`
    }
}
