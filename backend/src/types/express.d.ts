import type { JwtPayload } from '../shared/security.js'

declare global {
    namespace Express {
        interface Request {
            auth?: JwtPayload
        }
    }
}

export {}
