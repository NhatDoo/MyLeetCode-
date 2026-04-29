import { Prisma } from '../../generated/prisma/client.js'
import * as problemRepo from './problem.repo.js'
import type { CreateProblemInput, UpdateProblemInput } from './problem.schema.js'

export async function getProblemDetail(id: string) {
    const problem = await problemRepo.getProblemById(id)
    if (!problem) {
        throw new Error('Problem not found')
    }
    return problem
}

export async function getProblemForManagement(id: string) {
    const problem = await problemRepo.getProblemByIdWithAllTestcases(id)
    if (!problem) {
        throw new Error('Problem not found')
    }
    return problem
}

export async function getAllProblems() {
    return problemRepo.getAllProblems()
}


/**
 * Seed một bài toán mẫu để test hệ thống
 */
export async function createProblem(data: CreateProblemInput) {
    return problemRepo.createProblem(data)
}

export async function updateProblem(id: string, data: UpdateProblemInput) {
    try {
        return await problemRepo.updateProblem(id, data)
    } catch (error) {
        throw mapProblemWriteError(error)
    }
}

export async function deleteProblem(id: string) {
    try {
        return await problemRepo.deleteProblem(id)
    } catch (error) {
        throw mapProblemWriteError(error)
    }
}

function mapProblemWriteError(error: unknown): Error {
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as Prisma.PrismaClientKnownRequestError).code === 'P2025'
    ) {
        return new Error('Problem not found')
    }

    return error instanceof Error ? error : new Error('Unexpected problem write error')
}
