import { Router, type Request, type Response } from 'express'
import { assertUuid } from '../problem/problem.request.errors.js'
import { getErrorMessage } from '../../shared/utils.js'
import { requireAuth } from '../auth/auth.middleware.js'
import * as solutionService from './solution.service.js'

const router: Router = Router()

router.get('/problems/:problemId/solutions', async (req: Request, res: Response) => {
    try {
        const problemId = assertUuid(req.params.problemId, 'problemId')
        res.json(await solutionService.listSolutions(problemId))
    } catch (error: unknown) {
        res.status(resolveStatusCode(error)).json({ error: getErrorMessage(error) })
    }
})

router.post('/problems/:problemId/solutions', requireAuth, async (req: Request, res: Response) => {
    try {
        const problemId = assertUuid(req.params.problemId, 'problemId')
        const solution = await solutionService.createSolution({
            problemId,
            userId: req.auth!.userId,
            title: req.body?.title,
            explanation: req.body?.explanation,
            code: req.body?.code,
            language: req.body?.language,
        })
        res.status(201).json(solution)
    } catch (error: unknown) {
        res.status(resolveStatusCode(error)).json({ error: getErrorMessage(error) })
    }
})

function resolveStatusCode(error: unknown): number {
    if (error instanceof Error && error.message === 'Problem not found') return 404
    if (error instanceof Error && !error.message.includes('Unexpected')) return 400
    return 500
}

export default router
