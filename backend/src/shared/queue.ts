import 'dotenv/config'
import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib'
import { EventEmitter } from 'events'

export const QUEUES = {
    SUBMISSION: 'submission_queue',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

export interface SubmissionJobPayload {
    submissionId: string
    problemId: string
    userId: string
    language: string
    code: string
}

type QueueConsumer<T = unknown> = {
    queue: QueueName
    handler: (payload: T, msg: ConsumeMessage) => Promise<void>
    prefetch: number
}

const QUEUE_RECONNECT_DELAY_MS = 5_000

let connection: ChannelModel | null = null
let channel: Channel | null = null
let connectPromise: Promise<void> | null = null
let reconnectTimer: NodeJS.Timeout | null = null
let isShuttingDown = false

const consumers: QueueConsumer[] = []

export async function connectQueue(): Promise<void> {
    if (channel) {
        return
    }

    if (connectPromise) {
        await connectPromise
        return
    }

    const url = process.env.RABBITMQ_URL
    if (!url) {
        throw new Error('[Queue] RABBITMQ_URL is not defined in environment')
    }

    isShuttingDown = false
    connectPromise = (async () => {
        try {
            const nextConnection = await amqplib.connect(url)
            const nextChannel = await nextConnection.createChannel()

            for (const queue of Object.values(QUEUES)) {
                await nextChannel.assertQueue(queue, { durable: true })
            }

            attachConnectionListeners(nextConnection)
            connection = nextConnection
            channel = nextChannel

            await restoreConsumers(nextChannel)
            console.log('[Queue] Connected to RabbitMQ')
        } catch (error) {
            resetQueueState()
            scheduleReconnect()
            console.error('[Queue] Failed to connect to RabbitMQ:', error)
            throw error
        } finally {
            connectPromise = null
        }
    })()

    await connectPromise
}

export async function disconnectQueue(): Promise<void> {
    isShuttingDown = true

    if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }

    const currentChannel = channel
    const currentConnection = connection
    resetQueueState()

    try {
        if (currentChannel) {
            await currentChannel.close()
        }
    } catch (error) {
        console.error('[Queue] Error during channel close:', error)
    }

    try {
        if (currentConnection) {
            await currentConnection.close()
        }
    } catch (error) {
        console.error('[Queue] Error during connection close:', error)
    }

    console.log('[Queue] Disconnected from RabbitMQ')
}

export async function publishJob<T>(queue: QueueName, payload: T): Promise<boolean> {
    try {
        await connectQueue()
        if (!channel) {
            console.error('[Queue] Channel is not initialized after connectQueue().')
            return false
        }

        const content = Buffer.from(JSON.stringify(payload))
        const sent = channel.sendToQueue(queue, content, {
            persistent: true,
            contentType: 'application/json',
            timestamp: Math.floor(Date.now() / 1000),
        })

        if (!sent) {
            console.warn(`[Queue] sendToQueue returned false for queue: ${queue}. Buffer may be full.`)
        } else {
            console.log(`[Queue] Published job to [${queue}]`)
        }

        return sent
    } catch (error) {
        console.error(`[Queue] Failed to publish job to [${queue}]:`, error)
        handleConnectionLoss()
        return false
    }
}

export async function consumeQueue<T>(
    queue: QueueName,
    handler: (payload: T, msg: ConsumeMessage) => Promise<void>,
    options: { prefetch?: number } = {},
): Promise<void> {
    const consumer: QueueConsumer = {
        queue,
        handler: handler as QueueConsumer['handler'],
        prefetch: options.prefetch ?? 1,
    }

    upsertConsumer(consumer)

    if (!channel) {
        await connectQueue()
        return
    }

    await registerConsumerOnChannel(channel, consumer)
}

function attachConnectionListeners(nextConnection: ChannelModel): void {
    const connEmitter = nextConnection as unknown as EventEmitter

    connEmitter.on('error', (error: Error) => {
        console.error('[Queue] Connection error:', error.message)
        handleConnectionLoss()
    })

    connEmitter.on('close', () => {
        console.warn('[Queue] Connection closed')
        handleConnectionLoss()
    })
}

async function restoreConsumers(targetChannel: Channel): Promise<void> {
    for (const consumer of consumers) {
        await registerConsumerOnChannel(targetChannel, consumer)
    }
}

async function registerConsumerOnChannel(targetChannel: Channel, consumer: QueueConsumer): Promise<void> {
    await targetChannel.prefetch(consumer.prefetch)
    await targetChannel.consume(consumer.queue, async (msg) => {
        if (!msg) {
            return
        }

        let payload: unknown
        try {
            payload = JSON.parse(msg.content.toString())
        } catch {
            console.error(`[Queue] Failed to parse message from [${consumer.queue}]:`, msg.content.toString())
            targetChannel.nack(msg, false, false)
            return
        }

        try {
            await consumer.handler(payload, msg)
            targetChannel.ack(msg)
        } catch (error) {
            console.error(`[Queue] Handler failed for [${consumer.queue}]:`, error)
            targetChannel.nack(msg, false, false)
        }
    })

    console.log(`[Queue] Consumer registered for [${consumer.queue}] (prefetch: ${consumer.prefetch})`)
}

function upsertConsumer(nextConsumer: QueueConsumer): void {
    const existingIndex = consumers.findIndex((consumer) =>
        consumer.queue === nextConsumer.queue && consumer.handler === nextConsumer.handler,
    )

    if (existingIndex === -1) {
        consumers.push(nextConsumer)
        return
    }

    consumers[existingIndex] = nextConsumer
}

function handleConnectionLoss(): void {
    resetQueueState()
    scheduleReconnect()
}

function resetQueueState(): void {
    connection = null
    channel = null
}

function scheduleReconnect(): void {
    if (isShuttingDown || reconnectTimer || connectPromise) {
        return
    }

    console.warn(`[Queue] Scheduling reconnect in ${QUEUE_RECONNECT_DELAY_MS}ms`)
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        void connectQueue().catch((error) => {
            console.error('[Queue] Reconnect attempt failed:', error)
        })
    }, QUEUE_RECONNECT_DELAY_MS)
}
