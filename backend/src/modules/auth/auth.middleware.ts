import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../../shared/security.js'

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

function getAccessToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return undefined
    }

    return authHeader.slice('Bearer '.length).trim() || undefined
}
