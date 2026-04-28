/**
 * Safely extracts an error message from an unknown error object.
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && 'message' in error) return String(error.message)
    return 'Unknown error'
}
