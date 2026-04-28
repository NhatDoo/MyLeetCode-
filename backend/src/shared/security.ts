import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import jwt from 'jsonwebtoken'

const scrypt = promisify(nodeScrypt)
const PASSWORD_SALT_BYTES = 16
const PASSWORD_KEY_LENGTH = 64
const SESSION_TOKEN_BYTES = 32

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment variables')
}

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN ?? '1h'

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex')
    const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer

    return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt, hash] = storedHash.split(':')
    if (!salt || !hash) {
        return false
    }

    const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer
    const storedBuffer = Buffer.from(hash, 'hex')

    if (storedBuffer.length !== derivedKey.length) {
        return false
    }

    return timingSafeEqual(storedBuffer, derivedKey)
}

export function generateRefreshToken(): string {
    return randomBytes(SESSION_TOKEN_BYTES).toString('hex')
}

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export interface JwtPayload {
    userId: string
    email: string
}

export function generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRES_IN as any })
}

export function verifyAccessToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET!) as JwtPayload
    } catch {
        return null
    }
}
