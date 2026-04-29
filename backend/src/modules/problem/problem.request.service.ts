import type { Request, Response } from 'express'
import * as problemService from './problem.service.js'
import {
    applyUploadedImages,
    cleanupStoredObjectsQuietly,
    cleanupUploadedObjects,
    collectAllProblemObjectKeys,
    collectObjectKeysToDeleteAfterUpdate,
    createProblemRequestContext,
} from './problem.asset.service.js'
import {
    buildCreateProblemInput,
    buildUpdateProblemInput,
    ensureUpdatePayloadHasChanges,
} from './problem.payload.service.js'
import { resolveProblemRequestErrorStatusCode } from './problem.request.errors.js'
import { enrichProblemResponseWithImageUrls, getProblemImagePublicUrl } from './problem.response.service.js'
import { runProblemUpload } from './problem.upload.service.js'

export { getProblemImagePublicUrl, resolveProblemRequestErrorStatusCode }

export async function createProblemFromRequest(req: Request, res: Response) {
    const context = createProblemRequestContext()

    try {
        await runProblemUpload(req, res)
        const payload = buildCreateProblemInput(req)
        await applyUploadedImages(req, payload, context)
        const createdProblem = await problemService.createProblem(payload)
        return enrichProblemResponseWithImageUrls(createdProblem)
    } catch (error: unknown) {
        await cleanupUploadedObjects(context.uploadedObjectKeys)
        throw error
    }
}

export async function updateProblemFromRequest(id: string, req: Request, res: Response) {
    const existingProblem = await problemService.getProblemForManagement(id)
    const context = createProblemRequestContext()

    try {
        await runProblemUpload(req, res)
        const payload = buildUpdateProblemInput(req)
        await applyUploadedImages(req, payload, context)
        ensureUpdatePayloadHasChanges(payload)

        const oldObjectKeysToDelete = collectObjectKeysToDeleteAfterUpdate(existingProblem, payload)
        const updatedProblem = await problemService.updateProblem(id, payload)

        await cleanupStoredObjectsQuietly(oldObjectKeysToDelete)
        return enrichProblemResponseWithImageUrls(updatedProblem)
    } catch (error: unknown) {
        await cleanupUploadedObjects(context.uploadedObjectKeys)
        throw error
    }
}

export async function deleteProblemWithAssets(id: string): Promise<void> {
    const existingProblem = await problemService.getProblemForManagement(id)
    await problemService.deleteProblem(id)
    await cleanupStoredObjectsQuietly(collectAllProblemObjectKeys(existingProblem))
}
