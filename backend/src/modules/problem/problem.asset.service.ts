import type { Request } from 'express'
import type { Problem, TestCase } from '../../generated/prisma/client.js'
import { deleteImageObject, uploadImageObject } from '../../shared/object-storage.js'
import type { CreateProblemInput, UpdateProblemInput } from './problem.schema.js'
import { ProblemRequestError } from './problem.request.errors.js'
import {
    extractUploadedFiles,
    PROBLEM_IMAGE_FIELD,
    readTestcaseImageIndex,
    TESTCASES_FILE_FIELD,
} from './problem.upload.service.js'

export type ManagedProblem = Problem & { testcases: TestCase[] }

export type ProblemRequestContext = {
    uploadedObjectKeys: string[]
}

export function createProblemRequestContext(): ProblemRequestContext {
    return {
        uploadedObjectKeys: [],
    }
}

export async function applyUploadedImages(
    req: Request,
    payload: CreateProblemInput | UpdateProblemInput,
    context: ProblemRequestContext,
): Promise<void> {
    const uploadedFiles = extractUploadedFiles(req).filter((file) => file.fieldname !== TESTCASES_FILE_FIELD)
    if (uploadedFiles.length === 0) {
        return
    }

    const problemImageFiles = uploadedFiles.filter((file) => file.fieldname === PROBLEM_IMAGE_FIELD)
    if (problemImageFiles.length > 1) {
        throw new ProblemRequestError(`Only one "${PROBLEM_IMAGE_FIELD}" file is allowed`)
    }

    if (problemImageFiles.length === 1) {
        const objectKey = await uploadImageObject(problemImageFiles[0]!, 'problems/problem')
        context.uploadedObjectKeys.push(objectKey)
        payload.image = objectKey
    }

    const testcaseImageFiles = uploadedFiles.filter((file) => readTestcaseImageIndex(file.fieldname) !== null)
    if (testcaseImageFiles.length === 0) {
        return
    }

    if (!payload.testcases) {
        throw new ProblemRequestError('testcases or testcasesFile is required when uploading testcase images')
    }

    for (const file of testcaseImageFiles) {
        const testcaseIndex = readTestcaseImageIndex(file.fieldname)
        if (testcaseIndex === null) {
            continue
        }

        if (testcaseIndex >= payload.testcases.length) {
            throw new ProblemRequestError(
                `Received image for testcase index ${testcaseIndex}, but only ${payload.testcases.length} testcases were provided.`,
            )
        }

        const objectKey = await uploadImageObject(file, `problems/testcases/${testcaseIndex}`)
        context.uploadedObjectKeys.push(objectKey)
        payload.testcases[testcaseIndex] = {
            ...payload.testcases[testcaseIndex]!,
            image: objectKey,
        }
    }
}

export function collectObjectKeysToDeleteAfterUpdate(
    existingProblem: ManagedProblem,
    payload: UpdateProblemInput,
): string[] {
    const objectKeysToDelete = new Set<string>()

    if (payload.image !== undefined) {
        const nextProblemImage = payload.image ?? null
        if (existingProblem.image && existingProblem.image !== nextProblemImage) {
            objectKeysToDelete.add(existingProblem.image)
        }
    }

    if (payload.testcases !== undefined) {
        const nextImages = new Set(
            payload.testcases
                .map((testcase) => testcase.image)
                .filter((image): image is string => typeof image === 'string' && image.trim().length > 0),
        )

        for (const testcase of existingProblem.testcases) {
            if (testcase.image && !nextImages.has(testcase.image)) {
                objectKeysToDelete.add(testcase.image)
            }
        }
    }

    return [...objectKeysToDelete]
}

export function collectAllProblemObjectKeys(problem: ManagedProblem): string[] {
    const objectKeys = new Set<string>()

    if (problem.image) {
        objectKeys.add(problem.image)
    }

    for (const testcase of problem.testcases) {
        if (testcase.image) {
            objectKeys.add(testcase.image)
        }
    }

    return [...objectKeys]
}

export async function cleanupUploadedObjects(uploadedObjectKeys: string[]): Promise<void> {
    if (uploadedObjectKeys.length === 0) {
        return
    }

    await Promise.allSettled(uploadedObjectKeys.map((objectKey) => deleteImageObject(objectKey)))
}

export async function cleanupStoredObjectsQuietly(objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) {
        return
    }

    const results = await Promise.allSettled(objectKeys.map((objectKey) => deleteImageObject(objectKey)))
    for (const result of results) {
        if (result.status === 'rejected') {
            console.error('[Problem] Failed to delete object from storage:', result.reason)
        }
    }
}
