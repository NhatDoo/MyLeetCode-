import { Router } from 'express'
import type { Request, Response } from 'express'
import * as problemRequestService from './problem.request.service.js'
import * as problemService from './problem.service.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { assertUuid } from './problem.request.errors.js'
import { getErrorMessage } from '../../shared/utils.js'

const router: Router = Router()

/**
 * @openapi
 * /api/problems:
 *   get:
 *     summary: Lay danh sach tat ca bai toan
 *     tags: [Problems]
 *     responses:
 *       200:
 *         description: Tra ve danh sach bai toan.
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
 * /api/problems/images/url:
 *   get:
 *     summary: Lay public URL cho anh trong MinIO
 *     tags: [Problems]
 *     parameters:
 *       - in: query
 *         name: objectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tra ve public URL de doc anh.
 */
router.get('/images/url', async (req: Request, res: Response) => {
    try {
        const objectKey = typeof req.query.objectKey === 'string' ? req.query.objectKey : ''

        const response = problemRequestService.getProblemImagePublicUrl(objectKey)
        res.json(response)
    } catch (err: unknown) {
        res.status(problemRequestService.resolveProblemRequestErrorStatusCode(err)).json({ error: getErrorMessage(err) })
    }
})

/**
 * @openapi
 * /api/problems/{id}:
 *   get:
 *     summary: Lay chi tiet bai toan
 *     tags: [Problems]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tra ve thong tin bai toan va danh sach public testcases.
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = assertUuid(req.params.id, 'problemId')
        const problem = await problemService.getProblemDetail(id)
        res.json(problem)
    } catch (err: unknown) {
        res.status(problemRequestService.resolveProblemRequestErrorStatusCode(err)).json({ error: getErrorMessage(err) })
    }
})

/**
 * @openapi
 * /api/problems:
 *   post:
 *     summary: Tao moi bai toan
 *     tags: [Problems]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - difficulty
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               difficulty:
 *                 type: string
 *               tags:
 *                 type: string
 *                 description: JSON array string hoac chuoi phan tach bang dau phay.
 *               topics:
 *                 type: string
 *                 description: JSON array string hoac chuoi phan tach bang dau phay.
 *               image:
 *                 type: string
 *                 description: Object key co san trong MinIO.
 *               testcases:
 *                 type: string
 *                 description: JSON array testcase. Khong dung dong thoi voi testcasesFile.
 *               testcasesFile:
 *                 type: string
 *                 format: binary
 *                 description: File .xlsx, .xls, hoac .csv chua testcase.
 *               problemImage:
 *                 type: string
 *                 format: binary
 *               testcaseImages[0]:
 *                 type: string
 *                 format: binary
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Tra ve thong tin bai toan da tao.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const problem = await problemRequestService.createProblemFromRequest(req, res)
        res.status(201).json(problem)
    } catch (err: unknown) {
        res.status(problemRequestService.resolveProblemRequestErrorStatusCode(err)).json({ error: getErrorMessage(err) })
    }
})

/**
 * @openapi
 * /api/problems/{id}:
 *   put:
 *     summary: Cap nhat chi tiet bai toan
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               difficulty:
 *                 type: string
 *               tags:
 *                 type: string
 *                 description: JSON array string hoac chuoi phan tach bang dau phay.
 *               topics:
 *                 type: string
 *                 description: JSON array string hoac chuoi phan tach bang dau phay.
 *               image:
 *                 type: string
 *                 description: Dat "null" de xoa anh problem hien tai, hoac truyen object key co san.
 *               testcases:
 *                 type: string
 *                 description: JSON array testcase moi. Khong dung dong thoi voi testcasesFile.
 *               testcasesFile:
 *                 type: string
 *                 format: binary
 *                 description: File .xlsx, .xls, hoac .csv de thay the testcase.
 *               problemImage:
 *                 type: string
 *                 format: binary
 *               testcaseImages[0]:
 *                 type: string
 *                 format: binary
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Tra ve thong tin bai toan sau cap nhat.
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const id = assertUuid(req.params.id, 'problemId')
        const problem = await problemRequestService.updateProblemFromRequest(id, req, res)
        res.json(problem)
    } catch (err: unknown) {
        res.status(problemRequestService.resolveProblemRequestErrorStatusCode(err)).json({ error: getErrorMessage(err) })
    }
})

/**
 * @openapi
 * /api/problems/{id}:
 *   delete:
 *     summary: Xoa bai toan
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
 *         description: Tra ve trang thai xoa.
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const id = assertUuid(req.params.id, 'problemId')
        await problemRequestService.deleteProblemWithAssets(id)
        res.json({ message: 'Problem deleted successfully' })
    } catch (err: unknown) {
        res.status(problemRequestService.resolveProblemRequestErrorStatusCode(err)).json({ error: getErrorMessage(err) })
    }
})

export default router
