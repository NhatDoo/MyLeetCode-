import 'dotenv/config'
import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib'
import { EventEmitter } from 'events'

// ─── Constants ────────────────────────────────────────────────────────────────

export const QUEUES = {
    SUBMISSION: 'submission_queue',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

// ─── Payload Types ────────────────────────────────────────────────────────────

export interface SubmissionJobPayload {
    submissionId: string
    problemId: string
    userId: string
    language: string  // 'javascript' | 'python' | 'cpp' | ...
    code: string
}

// ─── Singleton State ──────────────────────────────────────────────────────────
// amqplib v1: connect() trả về ChannelModel (không phải Connection)

let connection: ChannelModel | null = null
let channel: Channel | null = null

// ─── Connect ──────────────────────────────────────────────────────────────────

export async function connectQueue(): Promise<void> {
    const url = process.env.RABBITMQ_URL

    if (!url) {
        throw new Error('[Queue] RABBITMQ_URL is not defined in environment')
    }

    try {
        connection = await amqplib.connect(url)
        channel = await connection.createChannel()

        // Đảm bảo tất cả queue đều tồn tại khi connect
        for (const queue of Object.values(QUEUES)) {
            await channel.assertQueue(queue, {
                durable: true,   // queue survive broker restart
            })
        }

        // Lắng nghe lỗi connection-level để tránh crash silent
        // amqplib v1: ChannelModel kế thừa EventEmitter ở runtime nhưng không expose trong type
        const connEmitter = connection as unknown as EventEmitter
        connEmitter.on('error', (err: Error) => {
            console.error('[Queue] Connection error:', err.message)
            connection = null
            channel = null
        })

        connEmitter.on('close', () => {
            console.warn('[Queue] Connection closed')
            connection = null
            channel = null
        })

        console.log('[Queue] Connected to RabbitMQ')
    } catch (err) {
        console.error('[Queue] Failed to connect to RabbitMQ:', err)
        throw err
    }
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnectQueue(): Promise<void> {
    try {
        channel?.close()
        await connection?.close()
        channel = null
        connection = null
        console.log('[Queue] Disconnected from RabbitMQ')
    } catch (err) {
        console.error('[Queue] Error during disconnect:', err)
    }
}

// ─── Publish ──────────────────────────────────────────────────────────────────

/**
 * Đẩy một job vào queue.
 * API layer chỉ được gọi hàm này — KHÔNG thực thi code trực tiếp (Rule 2).
 */
export function publishJob<T>(queue: QueueName, payload: T): boolean {
    if (!channel) {
        console.error('[Queue] Channel is not initialized. Call connectQueue() first.')
        return false
    }

    const content = Buffer.from(JSON.stringify(payload))

    const sent = channel.sendToQueue(queue, content, {
        persistent: true,                 // message survive broker restart
        contentType: 'application/json',
        timestamp: Math.floor(Date.now() / 1000),
    })

    if (!sent) {
        console.warn(`[Queue] sendToQueue returned false for queue: ${queue}. Buffer may be full.`)
    } else {
        console.log(`[Queue] Published job to [${queue}]`)
    }

    return sent
}

// ─── Consume ──────────────────────────────────────────────────────────────────

/**
 * Đăng ký một consumer cho queue.
 * Worker layer gọi hàm này để nhận và xử lý job.
 * prefetch = 1: đảm bảo mỗi worker chỉ xử lý 1 job tại một thời điểm.
 */
export async function consumeQueue<T>(
    queue: QueueName,
    handler: (payload: T, msg: ConsumeMessage) => Promise<void>,
    options: { prefetch?: number } = {}
): Promise<void> {
    if (!channel) {
        throw new Error('[Queue] Channel is not initialized. Call connectQueue() first.')
    }

    const prefetch = options.prefetch ?? 1
    await channel.prefetch(prefetch)

    await channel.consume(queue, async (msg) => {
        if (!msg) return  // consumer cancelled bởi broker

        let payload: T
        try {
            payload = JSON.parse(msg.content.toString()) as T
        } catch {
            console.error(`[Queue] Failed to parse message from [${queue}]:`, msg.content.toString())
            // Reject và không requeue — message bị malformed
            channel?.nack(msg, false, false)
            return
        }

        try {
            await handler(payload, msg)
            channel?.ack(msg)
        } catch (err) {
            console.error(`[Queue] Handler failed for [${queue}]:`, err)
            // requeue = false: tránh vòng lặp lỗi vô hạn
            // Production nên dùng Dead Letter Queue (DLQ)
            channel?.nack(msg, false, false)
        }
    })

    console.log(`[Queue] Consumer registered for [${queue}] (prefetch: ${prefetch})`)
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

shutdownSignals.forEach(signal => {
    process.on(signal, async () => {
        console.log(`[Queue] Received ${signal}, shutting down...`)
        await disconnectQueue()
    })
})
