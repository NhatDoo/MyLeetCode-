import { prisma } from '../../shared/db.js'
import type { Prisma } from '../../generated/prisma/client.js'
import type { CreateProblemInput, UpdateProblemInput } from './problem.schema.js'

export async function getProblemById(id: string) {
    return prisma.problem.findUnique({
        where: { id },
        include: {
            testcases: {
                where: { isHidden: false } // Chỉ lấy public testcases cho client
            }
        }
    })
}

export async function getAllProblems() {
    return prisma.problem.findMany({
        select: {
            id: true,
            title: true,
            difficulty: true,
            image: true,
            tags: true,
            topics: true,
        }
    })
}

export async function getProblemByIdWithAllTestcases(id: string) {
    return prisma.problem.findUnique({
        where: { id },
        include: {
            testcases: true,
        }
    })
}


export async function createProblem(data: CreateProblemInput) {
    const createData: Prisma.ProblemCreateInput = {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        testcases: {
            create: data.testcases
        }
    }

    if (data.image !== undefined) {
        createData.image = data.image
    }

    if (data.tags !== undefined) {
        createData.tags = data.tags
    }

    if (data.topics !== undefined) {
        createData.topics = data.topics
    }

    return prisma.problem.create({
        data: createData,
        include: { testcases: true }
    })
}

export async function updateProblem(id: string, data: UpdateProblemInput) {
    return prisma.$transaction(async (tx) => {
        let updateData: Prisma.ProblemUpdateInput = {}

        if (data.title !== undefined) {
            updateData.title = data.title
        }

        if (data.description !== undefined) {
            updateData.description = data.description
        }

        if (data.difficulty !== undefined) {
            updateData.difficulty = data.difficulty
        }

        if (data.image !== undefined) {
            updateData.image = data.image
        }

        if (data.tags !== undefined) {
            updateData.tags = data.tags
        }

        if (data.topics !== undefined) {
            updateData.topics = data.topics
        }

        // If testcases are provided, delete dependent logs before replacing them.
        if (data.testcases) {
            await tx.executionLog.deleteMany({
                where: { testcase: { problemId: id } }
            })
            await tx.testCase.deleteMany({
                where: { problemId: id }
            })
            updateData.testcases = {
                create: data.testcases
            }
        }

        return tx.problem.update({
            where: { id },
            data: updateData,
            include: { testcases: true }
        })
    })
}

export async function deleteProblem(id: string) {
    return prisma.$transaction(async (tx) => {
        await tx.executionLog.deleteMany({
            where: { testcase: { problemId: id } }
        })
        await tx.testCase.deleteMany({
            where: { problemId: id }
        })
        await tx.submission.deleteMany({
            where: { problemId: id }
        })
        return tx.problem.delete({
            where: { id }
        })
    })
}
