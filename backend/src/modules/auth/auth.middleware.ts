import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../../shared/security.js'
import * as authRepo from './auth.repo.js'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const accessToken = getAccessToken(req)
    if (!accessToken) {
        res.status(401).json({ error: 'Unauthorized' })
        return
    }

    const payload = verifyAccessToken(accessToken)
    if (!payload) {
        res.status(401).json({ error: 'Unauthorized' })
        return
    }
    req.auth = payload
    next()
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.auth) {
        res.status(401).json({ error: 'Unauthorized' })
        return
    }

    const adminEmails = new Set(
        (process.env.ADMIN_EMAILS ?? '')
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean),
    )
    if (adminEmails.size === 0) {
        res.status(403).json({ error: 'Admin access is not configured' })
        return
    }

    try {
        const user = await authRepo.findUserById(req.auth.userId)
        if (!user || !adminEmails.has(user.email.toLowerCase())) {
            res.status(403).json({ error: 'Admin access required' })
            return
        }
        next()
    } catch (error) {
        next(error)
    }
}

function getAccessToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return undefined
    }

    return authHeader.slice('Bearer '.length).trim() || undefined
}
