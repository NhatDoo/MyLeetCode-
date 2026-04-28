import * as problemRepo from './problem.repo.js'

export async function getProblemDetail(id: string) {
    const problem = await problemRepo.getProblemById(id)
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
export async function createProblem(data: {
    title: string,
    description: string,
    difficulty: string,
    testcases: { input: string, expected: string, isHidden: boolean }[]
}) {
    return problemRepo.createProblem(data)
}

export async function updateProblem(id: string, data: {
    title?: string,
    description?: string,
    difficulty?: string,
    testcases?: { input: string, expected: string, isHidden: boolean }[]
}) {
    // verify problem exists stringently before updating
    await getProblemDetail(id)
    return problemRepo.updateProblem(id, data)
}

export async function deleteProblem(id: string) {
    // verify problem exists stringently before deleting
    await getProblemDetail(id)
    return problemRepo.deleteProblem(id)
}
