import { getPublicImageUrl } from '../../shared/object-storage.js'
import { ProblemRequestError } from './problem.request.errors.js'

export function getProblemImagePublicUrl(objectKey: string) {
    const normalizedKey = objectKey.trim()
    if (!normalizedKey) {
        throw new ProblemRequestError('objectKey is required')
    }

    return {
        objectKey: normalizedKey,
        url: getPublicImageUrl(normalizedKey),
    }
}

export function enrichProblemResponseWithImageUrls<
    TProblem extends {
        image?: string | null
        testcases: Array<{ image?: string | null }>
    },
>(problem: TProblem) {
    return {
        ...problem,
        imageUrl: buildNullablePublicImageUrl(problem.image),
        testcases: problem.testcases.map((testcase) => ({
            ...testcase,
            imageUrl: buildNullablePublicImageUrl(testcase.image),
        })),
    }
}

function buildNullablePublicImageUrl(objectKey: string | null | undefined): string | null {
    if (!objectKey) {
        return null
    }

    return getPublicImageUrl(objectKey)
}
