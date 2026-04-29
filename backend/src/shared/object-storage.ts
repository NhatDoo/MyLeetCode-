import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { Client } from 'minio'

export class ObjectStorageError extends Error {
    readonly statusCode: number

    constructor(message: string, statusCode = 500) {
        super(message)
        this.name = 'ObjectStorageError'
        this.statusCode = statusCode
    }
}

const DEFAULT_IMAGE_BUCKET = 'images'

let bucketReadyPromise: Promise<void> | null = null
let objectStorageClient: Client | null = null

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new ObjectStorageError(`Missing required object storage configuration: ${name}`)
    }
    return value
}

function getObjectStorageClient(): Client {
    if (!objectStorageClient) {
        const endPoint = getRequiredEnv('MINIO_ENDPOINT')
        const accessKey = getRequiredEnv('MINIO_ACCESS_KEY')
        const secretKey = getRequiredEnv('MINIO_SECRET_KEY')
        const port = Number(process.env.MINIO_PORT ?? '9000')
        const useSSL = (process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true'

        if (!Number.isInteger(port) || port <= 0) {
            throw new ObjectStorageError('MINIO_PORT must be a positive integer')
        }

        objectStorageClient = new Client({
            endPoint,
            port,
            useSSL,
            accessKey,
            secretKey,
        })
    }

    return objectStorageClient
}

export function getImageBucketName(): string {
    return process.env.MINIO_BUCKET?.trim() || DEFAULT_IMAGE_BUCKET
}

export async function ensureImageBucketExists(): Promise<void> {
    if (!bucketReadyPromise) {
        bucketReadyPromise = (async () => {
            const client = getObjectStorageClient()
            const bucketName = getImageBucketName()
            const region = process.env.MINIO_REGION?.trim() || 'us-east-1'
            const exists = await client.bucketExists(bucketName)

            if (!exists) {
                await client.makeBucket(bucketName, region)
            }
        })().catch((error: unknown) => {
            bucketReadyPromise = null
            throw normalizeObjectStorageFailure(error, 'Failed to initialize image bucket')
        })
    }

    await bucketReadyPromise
}

export async function uploadImageObject(
    file: Express.Multer.File,
    keyPrefix: string,
): Promise<string> {
    if (!file.mimetype.startsWith('image/')) {
        throw new ObjectStorageError(`Unsupported file type: ${file.mimetype}`, 400)
    }

    await ensureImageBucketExists()

    const client = getObjectStorageClient()
    const bucketName = getImageBucketName()
    const extension = resolveFileExtension(file)
    const objectKey = `${trimSlashes(keyPrefix)}/${Date.now()}-${randomUUID()}${extension}`

    try {
        await client.putObject(bucketName, objectKey, file.buffer, file.size, {
            'Content-Type': file.mimetype,
        })
        return objectKey
    } catch (error: unknown) {
        throw normalizeObjectStorageFailure(error, 'Failed to upload image to object storage')
    }
}

export function getPublicImageUrl(objectKey: string): string {
    const normalizedObjectKey = objectKey.trim()
    if (!normalizedObjectKey) {
        throw new ObjectStorageError('objectKey is required', 400)
    }

    const publicBaseUrl = process.env.MINIO_PUBLIC_URL?.trim()
    if (!publicBaseUrl) {
        throw new ObjectStorageError('Missing required object storage configuration: MINIO_PUBLIC_URL')
    }

    const encodedObjectKey = normalizedObjectKey
        .split('/')
        .filter((segment) => segment.length > 0)
        .map((segment) => encodeURIComponent(segment))
        .join('/')

    return `${publicBaseUrl.replace(/\/+$/, '')}/${getImageBucketName()}/${encodedObjectKey}`
}

export async function deleteImageObject(objectKey: string): Promise<void> {
    if (!objectKey) {
        return
    }

    try {
        await ensureImageBucketExists()
        const client = getObjectStorageClient()
        await client.removeObject(getImageBucketName(), objectKey)
    } catch (error: unknown) {
        throw normalizeObjectStorageFailure(error, `Failed to delete image object: ${objectKey}`)
    }
}

function resolveFileExtension(file: Express.Multer.File): string {
    const originalExtension = path.extname(file.originalname || '').trim().toLowerCase()
    if (originalExtension) {
        return originalExtension
    }

    const subtype = file.mimetype.split('/')[1]?.trim().toLowerCase()
    if (!subtype) {
        return '.bin'
    }

    return subtype === 'jpeg' ? '.jpg' : `.${subtype}`
}

function trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, '')
}

function normalizeObjectStorageFailure(error: unknown, fallbackMessage: string): ObjectStorageError {
    if (error instanceof ObjectStorageError) {
        return error
    }

    if (error instanceof Error && error.message.trim().length > 0) {
        return new ObjectStorageError(error.message)
    }

    return new ObjectStorageError(fallbackMessage)
}
