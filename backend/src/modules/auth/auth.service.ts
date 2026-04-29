import { Prisma } from '../../generated/prisma/client.js'
import * as authRepo from './auth.repo.js'
import {
    generateRefreshToken,
    generateAccessToken,
    verifyAccessToken,
    hashPassword,
    hashToken,
    verifyPassword,
} from '../../shared/security.js'

export const REFRESH_COOKIE_NAME = 'mlc_refresh_token'

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const MIN_PASSWORD_LENGTH = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface AuthUser {
    id: string
    email: string
    createdAt: Date
    updatedAt: Date
}

export interface AuthInput {
    email: string
    password: string
}

export interface SessionMetadata {
    userAgent?: string | null
    ipAddress?: string | null
}

export interface AuthResult {
    user: AuthUser
    accessToken: string
    refreshToken: string
    expiresAt: Date
}

export interface CurrentUserResult {
    user: AuthUser
}

export async function register(input: AuthInput, metadata: SessionMetadata = {}): Promise<AuthResult> {
    const email = normalizeEmail(input.email)
    validateCredentials(email, input.password)

    const existingUser = await authRepo.findUserByEmail(email)
    if (existingUser) {
        throw new Error('Email already registered')
    }

    const password = await hashPassword(input.password)

    try {
        const user = await authRepo.createUser({ email, password })
        return createSessionResult(user, metadata)
    } catch (error) {
        throw mapPrismaError(error)
    }
}

export async function login(input: AuthInput, metadata: SessionMetadata = {}): Promise<AuthResult> {
    const email = normalizeEmail(input.email)
    validateCredentials(email, input.password)

    const user = await authRepo.findUserByEmail(email)
    if (!user) {
        throw new Error('Invalid email or password')
    }

    const validPassword = await verifyPassword(input.password, user.password)
    if (!validPassword) {
        throw new Error('Invalid email or password')
    }

    return createSessionResult({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }, metadata)
}

export async function refresh(refreshToken: string | undefined, metadata: SessionMetadata = {}): Promise<AuthResult> {
    if (!refreshToken) {
        throw new Error('Refresh token is required')
    }

    const tokenHash = hashToken(refreshToken)
    const session = await authRepo.findActiveSessionByTokenHash(tokenHash)
    if (!session) {
        throw new Error('Invalid or expired refresh token')
    }

    // Delete old session for token rotation
    await authRepo.deleteSessionByTokenHash(tokenHash)

    return createSessionResult(session.user, metadata)
}

export async function getCurrentUser(accessToken: string | undefined): Promise<CurrentUserResult | null> {
    if (!accessToken) {
        return null
    }

    const payload = verifyAccessToken(accessToken)
    if (!payload) {
        return null
    }

    const user = await authRepo.findUserById(payload.userId)
    if (!user) {
        return null
    }

    return {
        user: {
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }
    }
}

export async function logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
        return
    }

    await authRepo.deleteSessionByTokenHash(hashToken(refreshToken))
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

function validateCredentials(email: string, password: string): void {
    if (!email) {
        throw new Error('Email is required')
    }

    if (!EMAIL_REGEX.test(email)) {
        throw new Error('Email is invalid')
    }

    if (!password) {
        throw new Error('Password is required')
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }
}

async function createSessionResult(user: AuthUser, metadata: SessionMetadata): Promise<AuthResult> {
    const refreshToken = generateRefreshToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

    const accessToken = generateAccessToken({ userId: user.id, email: user.email })

    await authRepo.createSession({
        userId: user.id,
        refreshToken: hashToken(refreshToken),
        expiresAt,
        userAgent: metadata.userAgent ?? null,
        ipAddress: metadata.ipAddress ?? null,
    })

    return {
        user,
        accessToken,
        refreshToken,
        expiresAt,
    }
}

function mapPrismaError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
            return new Error('Email already registered')
        }
    }

    return error instanceof Error ? error : new Error('Unexpected authentication error')
}
