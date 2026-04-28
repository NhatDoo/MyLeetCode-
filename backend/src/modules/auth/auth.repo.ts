import { prisma } from '../../shared/db.js'

const publicUserSelect = {
    id: true,
    email: true,
    createdAt: true,
    updatedAt: true,
} as const

export function findUserByEmail(email: string) {
    return prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            password: true,
            createdAt: true,
            updatedAt: true,
        },
    })
}

export function createUser(input: { email: string, password: string }) {
    return prisma.user.create({
        data: {
            email: input.email,
            password: input.password,
        },
        select: publicUserSelect,
    })
}

export function createSession(input: {
    userId: string
    refreshToken: string
    expiresAt: Date
    userAgent?: string | null
    ipAddress?: string | null
}) {
    return prisma.session.create({
        data: {
            userId: input.userId,
            refreshToken: input.refreshToken,
            expiresAt: input.expiresAt,
            userAgent: input.userAgent ?? null,
            ipAddress: input.ipAddress ?? null,
        },
        select: {
            id: true,
            userId: true,
            expiresAt: true,
        },
    })
}

export function findActiveSessionByTokenHash(refreshToken: string) {
    return prisma.session.findFirst({
        where: {
            refreshToken,
            expiresAt: {
                gt: new Date(),
            },
        },
        select: {
            id: true,
            userId: true,
            expiresAt: true,
            user: {
                select: publicUserSelect,
            },
        },
    })
}

export function deleteSessionByTokenHash(refreshToken: string) {
    return prisma.session.deleteMany({
        where: { refreshToken },
    })
}
