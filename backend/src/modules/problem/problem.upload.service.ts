import path from 'node:path'
import multer from 'multer'
import type { Request, Response } from 'express'
import { ProblemRequestError } from './problem.request.errors.js'

export const PROBLEM_IMAGE_FIELD = 'problemImage'
export const TESTCASES_FILE_FIELD = 'testcasesFile'

const spreadsheetMimeTypes = new Set([
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv',
    'text/plain',
])

const spreadsheetExtensions = new Set(['.xlsx', '.xls', '.csv'])

const problemUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Number(process.env.PROBLEM_IMAGE_MAX_FILE_BYTES ?? 5 * 1024 * 1024),
        files: Number(process.env.PROBLEM_IMAGE_MAX_FILES ?? 40),
    },
    fileFilter: (req, file, callback) => {
        if (file.fieldname === TESTCASES_FILE_FIELD) {
            if (isSupportedSpreadsheet(file)) {
                callback(null, true)
                return
            }

            callback(new Error(`Field "${TESTCASES_FILE_FIELD}" only accepts .xlsx, .xls, or .csv files`))
            return
        }

        if (file.fieldname === PROBLEM_IMAGE_FIELD || readTestcaseImageIndex(file.fieldname) !== null) {
            if (file.mimetype.startsWith('image/')) {
                callback(null, true)
                return
            }

            callback(new Error(`Field "${file.fieldname}" only accepts image files`))
            return
        }

        callback(new Error(`Unsupported upload field "${file.fieldname}"`))
    },
})

export async function runProblemUpload(req: Request, res: Response): Promise<void> {
    if (!req.is('multipart/form-data')) {
        return
    }

    await new Promise<void>((resolve, reject) => {
        problemUpload.any()(req, res, (error: unknown) => {
            if (!error) {
                resolve()
                return
            }

            reject(normalizeUploadError(error))
        })
    })
}

export function extractUploadedFiles(req: Request): Express.Multer.File[] {
    if (!req.files) {
        return []
    }

    if (Array.isArray(req.files)) {
        return req.files
    }

    return Object.values(req.files).flat()
}

export function getSpreadsheetUpload(req: Request): Express.Multer.File | undefined {
    const spreadsheetFiles = extractUploadedFiles(req).filter((file) => file.fieldname === TESTCASES_FILE_FIELD)
    if (spreadsheetFiles.length > 1) {
        throw new ProblemRequestError(`Only one "${TESTCASES_FILE_FIELD}" file is allowed`)
    }

    return spreadsheetFiles[0]
}

export function readTestcaseImageIndex(fieldName: string): number | null {
    const match = /^testcaseImages\[(\d+)\]$/.exec(fieldName)
    if (!match) {
        return null
    }

    return Number.parseInt(match[1]!, 10)
}

function normalizeUploadError(error: unknown): Error {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return new ProblemRequestError('Uploaded file is too large')
        }

        return new ProblemRequestError(error.message)
    }

    if (error instanceof Error) {
        return new ProblemRequestError(error.message)
    }

    return new ProblemRequestError('Upload failed')
}

function isSupportedSpreadsheet(file: Express.Multer.File): boolean {
    const extension = path.extname(file.originalname || '').trim().toLowerCase()
    return spreadsheetMimeTypes.has(file.mimetype) || spreadsheetExtensions.has(extension)
}
