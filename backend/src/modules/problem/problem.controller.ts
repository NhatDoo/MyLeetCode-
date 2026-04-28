import { Router } from 'express'
import type { Request, Response } from 'express'
import * as problemService from './problem.service.js'
import { getErrorMessage } from '../../shared/utils.js'

const router: Router = Router()

/**
 * @openapi
 * /api/problems:
 *   get:
 *     summary: Lấy danh sách tất cả bài toán
 *     tags: [Problems]
 *     responses:
 *       200:
 *         description: Trả về danh sách bài toán (chỉ gồm thông tin cơ bản, không có description hay testcases).
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   difficulty:
 *                     type: string
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const problems = await problemService.getAllProblems()
        res.json(problems)
    } catch (err: unknown) {
        res.status(500).json({ error: getErrorMessage(err) })
    }
})

/**
 * @openapi
 * /api/problems/{id}:
 *   get:
 *     summary: Lấy chi tiết bài toán
 *     tags: [Problems]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về thông tin bài toán và danh sách public testcases.
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const problem = await problemService.getProblemDetail(id)
        res.json(problem)
    } catch (err: unknown) {
        res.status(404).json({ error: getErrorMessage(err) })
    }
})

/**
 * @openapi
 * /api/problems:
 *   post:
 *     summary: Tạo mới bài toán
 *     tags: [Problems]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               difficulty:
 *                 type: string
 *               testcases:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     input:
 *                       type: string
 *                     expected:
 *                       type: string
 *                     isHidden:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Trả về thông tin bài toán đã tạo.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const problem = await problemService.createProblem(req.body)
        res.status(201).json(problem)
    } catch (err: unknown) {
        res.status(400).json({ error: getErrorMessage(err) })
    }
})

/**
 * @openapi
 * /api/problems/{id}:
 *   put:
 *     summary: Cập nhật chi tiết bài toán
 *     tags: [Problems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               difficulty:
 *                 type: string
 *               testcases:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     input:
 *                       type: string
 *                     expected:
 *                       type: string
 *                     isHidden:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Trả về thông tin bài toán sau cập nhật.
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const problem = await problemService.updateProblem(id, req.body)
        res.json(problem)
    } catch (err: unknown) {
        res.status(400).json({ error: getErrorMessage(err) })
    }
})

/**
 * @openapi
 * /api/problems/{id}:
 *   delete:
 *     summary: Xóa bài toán
 *     tags: [Problems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về trạng thái xóa.
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        await problemService.deleteProblem(id)
        res.json({ message: 'Problem deleted successfully' })
    } catch (err: unknown) {
        res.status(400).json({ error: getErrorMessage(err) })
    }
})

export default router
