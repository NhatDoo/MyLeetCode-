import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const findUserById = vi.hoisted(() => vi.fn())

vi.mock('../../src/modules/auth/auth.repo.js', () => ({
    findUserById,
}))

vi.mock('../../src/shared/security.js', () => ({
    verifyAccessToken: vi.fn(),
}))

import { requireAdmin } from '../../src/modules/auth/auth.middleware.js'

const originalAdminEmails = process.env.ADMIN_EMAILS

function createResponse() {
    return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    } as unknown as Response
}

describe('requireAdmin()', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        if (originalAdminEmails === undefined) {
            delete process.env.ADMIN_EMAILS
        } else {
            process.env.ADMIN_EMAILS = originalAdminEmails
        }
    })

    it('allows a user whose email is on the admin allowlist', async () => {
        process.env.ADMIN_EMAILS = 'admin@example.com, owner@example.com'
        vi.mocked(findUserById).mockResolvedValue({
            id: 'user-1', email: 'ADMIN@example.com', createdAt: new Date(), updatedAt: new Date(),
        })
        const next = vi.fn()

        await requireAdmin({ auth: { userId: 'user-1' } } as Request, createResponse(), next)

        expect(next).toHaveBeenCalledOnce()
    })

    it('rejects a user who is not on the admin allowlist', async () => {
        process.env.ADMIN_EMAILS = 'admin@example.com'
        vi.mocked(findUserById).mockResolvedValue({
            id: 'user-2', email: 'member@example.com', createdAt: new Date(), updatedAt: new Date(),
        })
        const response = createResponse()

        await requireAdmin({ auth: { userId: 'user-2' } } as Request, response, vi.fn())

        expect(response.status).toHaveBeenCalledWith(403)
        expect(findUserById).toHaveBeenCalledWith('user-2')
    })

    it('rejects access when the admin allowlist is not configured', async () => {
        delete process.env.ADMIN_EMAILS
        const response = createResponse()

        await requireAdmin({ auth: { userId: 'user-1' } } as Request, response, vi.fn())

        expect(response.status).toHaveBeenCalledWith(403)
        expect(findUserById).not.toHaveBeenCalled()
    })
})