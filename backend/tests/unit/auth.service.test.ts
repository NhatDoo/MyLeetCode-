import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/modules/auth/auth.repo.js', () => ({
    findUserByEmail: vi.fn(),
    createUser: vi.fn(),
    createSession: vi.fn(),
    findActiveSessionByTokenHash: vi.fn(),
    deleteSessionByTokenHash: vi.fn(),
}))

vi.mock('../../src/shared/security.js', () => ({
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateRefreshToken: vi.fn(),
    generateAccessToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    hashToken: vi.fn(),
}))

import * as authRepo from '../../src/modules/auth/auth.repo.js'
import {
    getCurrentUser,
    login,
    logout,
    register,
} from '../../src/modules/auth/auth.service.js'
import {
    generateRefreshToken,
    generateAccessToken,
    verifyAccessToken,
    hashPassword,
    hashToken,
    verifyPassword,
} from '../../src/shared/security.js'

const sessionMetadata = {
    userAgent: 'vitest',
    ipAddress: '127.0.0.1',
}

describe('auth.service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(hashPassword).mockResolvedValue('salt:password-hash')
        vi.mocked(verifyPassword).mockResolvedValue(true)
        vi.mocked(generateRefreshToken).mockReturnValue('plain-refresh-token')
        vi.mocked(generateAccessToken).mockReturnValue('plain-access-token')
        vi.mocked(hashToken).mockReturnValue('hashed-refresh-token')
        vi.mocked(authRepo.createSession).mockResolvedValue({
            id: 'session-1',
            userId: 'user-1',
            expiresAt: new Date('2026-05-27T00:00:00.000Z'),
        } as any)
    })

    describe('register()', () => {
        it('creates user and session for a new email', async () => {
            vi.mocked(authRepo.findUserByEmail).mockResolvedValue(null)
            vi.mocked(authRepo.createUser).mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                createdAt: new Date('2026-04-27T00:00:00.000Z'),
                updatedAt: new Date('2026-04-27T00:00:00.000Z'),
            } as any)

            const result = await register({
                email: 'User@Example.com ',
                password: 'password123',
            }, sessionMetadata)

            expect(authRepo.createUser).toHaveBeenCalledWith({
                email: 'user@example.com',
                password: 'salt:password-hash',
            })
            expect(authRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user-1',
                refreshToken: 'hashed-refresh-token',
                userAgent: 'vitest',
                ipAddress: '127.0.0.1',
            }))
            expect(result.user.email).toBe('user@example.com')
            expect(result.accessToken).toBe('plain-access-token')
            expect(result.refreshToken).toBe('plain-refresh-token')
        })

        it('rejects duplicate email', async () => {
            vi.mocked(authRepo.findUserByEmail).mockResolvedValue({
                id: 'existing-user',
                email: 'user@example.com',
                password: 'stored-hash',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any)

            await expect(register({
                email: 'user@example.com',
                password: 'password123',
            }, sessionMetadata)).rejects.toThrow('Email already registered')

            expect(authRepo.createUser).not.toHaveBeenCalled()
        })
    })

    describe('login()', () => {
        it('creates a new session when password is valid', async () => {
            vi.mocked(authRepo.findUserByEmail).mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                password: 'stored-hash',
                createdAt: new Date('2026-04-27T00:00:00.000Z'),
                updatedAt: new Date('2026-04-27T00:00:00.000Z'),
            } as any)

            const result = await login({
                email: 'user@example.com',
                password: 'password123',
            }, sessionMetadata)

            expect(verifyPassword).toHaveBeenCalledWith('password123', 'stored-hash')
            expect(authRepo.createSession).toHaveBeenCalledTimes(1)
            expect(result.user.id).toBe('user-1')
        })

        it('rejects invalid password', async () => {
            vi.mocked(authRepo.findUserByEmail).mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                password: 'stored-hash',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any)
            vi.mocked(verifyPassword).mockResolvedValue(false)

            await expect(login({
                email: 'user@example.com',
                password: 'wrongpassword',
            }, sessionMetadata)).rejects.toThrow('Invalid email or password')

            expect(authRepo.createSession).not.toHaveBeenCalled()
        })
    })

    describe('getCurrentUser()', () => {
        it('returns null when there is no access token', async () => {
            await expect(getCurrentUser(undefined)).resolves.toBeNull()
            expect(authRepo.findActiveSessionByTokenHash).not.toHaveBeenCalled()
        })

        it('returns current user when session is valid', async () => {
            vi.mocked(verifyAccessToken).mockReturnValue({
                userId: 'user-1',
                email: 'user@example.com',
            } as any)
            vi.mocked(authRepo.findUserByEmail).mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                createdAt: new Date('2026-04-27T00:00:00.000Z'),
                updatedAt: new Date('2026-04-27T00:00:00.000Z'),
            } as any)

            const result = await getCurrentUser('plain-access-token')

            expect(verifyAccessToken).toHaveBeenCalledWith('plain-access-token')
            expect(result?.user.email).toBe('user@example.com')
        })
    })

    describe('logout()', () => {
        it('deletes session by hashed token', async () => {
            vi.mocked(authRepo.deleteSessionByTokenHash).mockResolvedValue({ count: 1 } as any)

            await logout('plain-refresh-token')

            expect(hashToken).toHaveBeenCalledWith('plain-refresh-token')
            expect(authRepo.deleteSessionByTokenHash).toHaveBeenCalledWith('hashed-refresh-token')
        })

        it('does nothing when token is missing', async () => {
            await logout(undefined)
            expect(authRepo.deleteSessionByTokenHash).not.toHaveBeenCalled()
        })
    })
})
