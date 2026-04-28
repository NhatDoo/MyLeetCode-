import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import * as submissionService from './submission.service.js'
import * as submissionRepo from './submission.repo.js'
import { getErrorMessage } from '../../shared/utils.js'
import { submissionSecurityMiddleware } from './submission.security.js'

const router: Router = Router()

/**
 * @openapi
 * /api/submissions:
 *   post:
 *     summary: Nop bai giai (Submit Code)
 *     tags: [Submissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - problemId
 *               - language
 *               - code
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "user-123"
 *               problemId:
 *                 type: string
 *                 example: "prob-456"
 *               language:
 *                 type: string
 *                 enum: [javascript, python, cpp]
 *                 example: "javascript"
 *               code:
 *                 type: string
 *                 example: "function twoSum(nums, target) { return [0, 1]; }"
 *     responses:
 *       200:
 *         description: Da nhan bai giai va dang xu ly.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubmitResponse'
 *       400:
 *         description: Du lieu dau vao khong hop le.
 */
router.post('/', submissionSecurityMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await submissionService.submitCode(req.body)
        res.json(result)
    } catch (error) {
        next(error)
    }
})

/**
 * @openapi
 * /api/submissions/{id}:
 *   get:
 *     summary: Lay ket qua cham diem theo ID
 *     tags: [Submissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thong tin chi tiet ve submission va ket qua cham.
 *       404:
 *         description: Khong tim thay submission.
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const result = await submissionRepo.getSubmissionById(id)
        if (!result) {
            res.status(404).json({ error: 'Submission not found' })
            return
        }

        res.json(result)
    } catch (err: unknown) {
        res.status(500).json({ error: getErrorMessage(err) })
    }
})

export default router
