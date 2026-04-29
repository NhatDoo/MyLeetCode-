import { ObjectStorageError } from '../../shared/object-storage.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class ProblemRequestError extends Error {
    readonly statusCode: number

    constructor(message: string, statusCode = 400) {
        super(message)
        this.name = 'ProblemRequestError'
        this.statusCode = statusCode
    }
}

export function resolveProblemRequestErrorStatusCode(error: unknown): number {
    if (error instanceof ProblemRequestError) {
        return error.statusCode
    }

    if (error instanceof ObjectStorageError) {
        return error.statusCode
    }

    if (error instanceof Error && error.message === 'Problem not found') {
        return 404
    }

    return 500
}

export function assertUuid(value: unknown, fieldName: string): string {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (!UUID_PATTERN.test(normalized)) {
        throw new ProblemRequestError(`${fieldName} must be a valid UUID`)
    }

    return normalized
}
