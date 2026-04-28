import { prisma } from '../../shared/db.js'

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
        }
    })
}


export async function createProblem(data: {
    title: string,
    description: string,
    difficulty: string,
    testcases: { input: string, expected: string, isHidden: boolean }[]
}) {
    return prisma.problem.create({
        data: {
            title: data.title,
            description: data.description,
            difficulty: data.difficulty,
            testcases: {
                create: data.testcases
            }
        },
        include: { testcases: true }
    })
}

export async function updateProblem(id: string, data: {
    title?: string,
    description?: string,
    difficulty?: string,
    testcases?: { input: string, expected: string, isHidden: boolean }[]
}) {
    return prisma.$transaction(async (tx) => {
        let updateData: any = {
            title: data.title,
            description: data.description,
            difficulty: data.difficulty,
        }

        // If testcases are provided, we delete the old ones and create the new ones
        if (data.testcases) {
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
