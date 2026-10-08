import { Router, type Request, type Response } from 'express'
import { getErrorMessage } from '../../shared/utils.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { assertUuid } from '../problem/problem.request.errors.js'
import * as discussionService from './discussion.service.js'

const router: Router = Router()

router.get('/problems/:problemId/discussions', requireAuth, async (req: Request, res: Response) => {
    try {
        const problemId = assertUuid(req.params.problemId, 'problemId')
        res.json(await discussionService.listDiscussions(problemId))
    } catch (error: unknown) {
        res.status(resolveStatusCode(error)).json({ error: getErrorMessage(error) })
    }
})

router.post('/problems/:problemId/discussions', requireAuth, async (req: Request, res: Response) => {
    try {
        const problemId = assertUuid(req.params.problemId, 'problemId')
        const discussion = await discussionService.createDiscussion({
            problemId,
            userId: req.auth!.userId,
            title: req.body?.title,
            content: req.body?.content,
        })
        res.status(201).json(discussion)
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