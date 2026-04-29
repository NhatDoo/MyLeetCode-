import { Router } from 'express'
import type { Request, Response } from 'express'
import * as authService from './auth.service.js'
import { getErrorMessage } from '../../shared/utils.js'

const router: Router = Router()

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: strongPassword123
 *     responses:
 *       201:
 *         description: User registered successfully.
 *       400:
 *         description: Invalid input or duplicated email.
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const result = await authService.register(req.body, extractSessionMetadata(req))
        setRefreshCookie(res, result.refreshToken, result.expiresAt)

        res.status(201).json({
            accessToken: result.accessToken,
        })
    } catch (error: unknown) {
        res.status(400).json({ error: getErrorMessage(error) })
    }
})

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Login successful.
 *       401:
 *         description: Invalid credentials.
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const result = await authService.login(req.body, extractSessionMetadata(req))
        setRefreshCookie(res, result.refreshToken, result.expiresAt)

        res.json({
            accessToken: result.accessToken,
        })
    } catch (error: unknown) {
        const message = getErrorMessage(error)
        const statusCode = message === 'Invalid email or password' ? 401 : 400
        res.status(statusCode).json({ error: message })
    }
})

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Access token refreshed successfully.
 *       401:
 *         description: Invalid or expired refresh token.
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const refreshToken = getRefreshToken(req)
        const result = await authService.refresh(refreshToken, extractSessionMetadata(req))
        setRefreshCookie(res, result.refreshToken, result.expiresAt)

        res.json({
            accessToken: result.accessToken,
        })
    } catch (error: unknown) {
        res.status(401).json({ error: getErrorMessage(error) })
    }
})

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information.
 *       401:
 *         description: Not authenticated.
 */
router.get('/me', async (req: Request, res: Response) => {
    try {
        const accessToken = getAccessToken(req)
        const currentUser = await authService.getCurrentUser(accessToken)

        if (!currentUser) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }

        res.json(currentUser)

    } catch (error: unknown) {
        res.status(500).json({ error: getErrorMessage(error) })
    }
})

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout current session
 *     tags: [Auth]
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Logout successful.
 */
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const refreshToken = getRefreshToken(req)
        await authService.logout(refreshToken)
        clearRefreshCookie(res)

        res.json({ message: 'Logged out successfully' })
    } catch (error: unknown) {
        res.status(500).json({ error: getErrorMessage(error) })
    }
})

export default router

function extractSessionMetadata(req: Request) {
    return {
        userAgent: req.get('user-agent') ?? null,
        ipAddress: extractIpAddress(req),
    }
}

function extractIpAddress(req: Request): string | null {
    const forwardedFor = req.get('x-forwarded-for')
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() ?? null
    }

    return req.ip ?? null
}

function setRefreshCookie(res: Response, refreshToken: string, expiresAt: Date): void {
    res.cookie(authService.REFRESH_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        path: '/',
    })
}

function clearRefreshCookie(res: Response): void {
    res.clearCookie(authService.REFRESH_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    })
}

function getRefreshToken(req: Request): string | undefined {
    const cookies = parseCookieHeader(req.headers.cookie)
    return cookies[authService.REFRESH_COOKIE_NAME]
}

function getAccessToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return undefined
    }
    return authHeader.split(' ')[1]
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) {
        return {}
    }

    return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
        const [rawName, ...rawValue] = part.trim().split('=')
        if (!rawName || rawValue.length === 0) {
            return cookies
        }

        cookies[rawName] = decodeURIComponent(rawValue.join('='))
        return cookies
    }, {})
}

