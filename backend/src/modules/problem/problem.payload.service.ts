import type { Request } from 'express'
import * as XLSX from 'xlsx'
import {
    PROBLEM_DIFFICULTIES,
    type CreateProblemInput,
    type ProblemDifficulty,
    type ProblemTestCaseInput,
    type UpdateProblemInput,
} from './problem.schema.js'
import { ProblemRequestError } from './problem.request.errors.js'
import { getSpreadsheetUpload } from './problem.upload.service.js'

export function buildCreateProblemInput(req: Request): CreateProblemInput {
    const body = readBodyObject(req.body)
    const testcases = readCreateTestcases(body, req)

    const payload: CreateProblemInput = {
        title: readRequiredString(body.title, 'title'),
        description: readRequiredString(body.description, 'description'),
        difficulty: readRequiredDifficulty(body.difficulty),
        testcases,
    }

    const image = readOptionalNullableStringFromProperty(body, 'image')
    if (image !== undefined) {
        payload.image = image
    }

    const tags = readOptionalStringArrayFromProperty(body, 'tags')
    if (tags !== undefined) {
        payload.tags = tags
    }

    const topics = readOptionalStringArrayFromProperty(body, 'topics')
    if (topics !== undefined) {
        payload.topics = topics
    }

    return payload
}

export function buildUpdateProblemInput(req: Request): UpdateProblemInput {
    const body = readBodyObject(req.body)
    const payload: UpdateProblemInput = {}

    if (hasOwn(body, 'title')) {
        payload.title = readRequiredString(body.title, 'title')
    }

    if (hasOwn(body, 'description')) {
        payload.description = readRequiredString(body.description, 'description')
    }

    if (hasOwn(body, 'difficulty')) {
        payload.difficulty = readRequiredDifficulty(body.difficulty)
    }

    const image = readOptionalNullableStringFromProperty(body, 'image')
    if (hasOwn(body, 'image')) {
        payload.image = image ?? null
    }

    const tags = readOptionalStringArrayFromProperty(body, 'tags')
    if (hasOwn(body, 'tags')) {
        payload.tags = tags ?? []
    }

    const topics = readOptionalStringArrayFromProperty(body, 'topics')
    if (hasOwn(body, 'topics')) {
        payload.topics = topics ?? []
    }

    const testcases = readUpdateTestcases(body, req)
    if (testcases !== undefined) {
        payload.testcases = testcases
    }

    return payload
}

export function ensureUpdatePayloadHasChanges(payload: UpdateProblemInput): void {
    const hasChanges =
        payload.title !== undefined ||
        payload.description !== undefined ||
        payload.difficulty !== undefined ||
        payload.image !== undefined ||
        payload.tags !== undefined ||
        payload.topics !== undefined ||
        payload.testcases !== undefined

    if (!hasChanges) {
        throw new ProblemRequestError('No update fields were provided')
    }
}

function readCreateTestcases(body: Record<string, unknown>, req: Request): ProblemTestCaseInput[] {
    const spreadsheetFile = getSpreadsheetUpload(req)
    const hasJsonTestcases = hasOwn(body, 'testcases')

    if (spreadsheetFile && hasJsonTestcases) {
        throw new ProblemRequestError('Provide either "testcases" or "testcasesFile", not both')
    }

    if (spreadsheetFile) {
        return parseTestcasesFromSpreadsheet(spreadsheetFile)
    }

    if (!hasJsonTestcases) {
        throw new ProblemRequestError('testcases is required')
    }

    return readTestcases(body.testcases, true)
}

function readUpdateTestcases(body: Record<string, unknown>, req: Request): ProblemTestCaseInput[] | undefined {
    const spreadsheetFile = getSpreadsheetUpload(req)
    const hasJsonTestcases = hasOwn(body, 'testcases')

    if (spreadsheetFile && hasJsonTestcases) {
        throw new ProblemRequestError('Provide either "testcases" or "testcasesFile", not both')
    }

    if (spreadsheetFile) {
        return parseTestcasesFromSpreadsheet(spreadsheetFile)
    }

    if (hasJsonTestcases) {
        return readTestcases(body.testcases, true)
    }

    return undefined
}

function readBodyObject(raw: unknown): Record<string, unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new ProblemRequestError('Problem payload must be an object')
    }

    return raw as Record<string, unknown>
}

function readRequiredString(value: unknown, fieldName: string): string {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (!normalized) {
        throw new ProblemRequestError(`${fieldName} is required`)
    }

    return normalized
}

function readRequiredDifficulty(value: unknown): ProblemDifficulty {
    const normalized = readRequiredString(value, 'difficulty').toUpperCase()
    if (!PROBLEM_DIFFICULTIES.includes(normalized as ProblemDifficulty)) {
        throw new ProblemRequestError(
            `difficulty must be one of: ${PROBLEM_DIFFICULTIES.join(', ')}`,
        )
    }

    return normalized as ProblemDifficulty
}

function readOptionalNullableStringFromProperty(
    payload: Record<string, unknown>,
    propertyName: string,
): string | null | undefined {
    if (!hasOwn(payload, propertyName)) {
        return undefined
    }

    return readOptionalNullableString(payload[propertyName], propertyName)
}

function readOptionalNullableString(value: unknown, fieldName: string): string | null | undefined {
    if (value === undefined) {
        return undefined
    }

    if (value === null) {
        return null
    }

    if (typeof value !== 'string') {
        throw new ProblemRequestError(`${fieldName} must be a string when provided`)
    }

    const normalized = value.trim()
    if (!normalized) {
        return undefined
    }

    return normalized.toLowerCase() === 'null' ? null : normalized
}

function readOptionalStringArrayFromProperty(
    payload: Record<string, unknown>,
    propertyName: string,
): string[] | undefined {
    if (!hasOwn(payload, propertyName)) {
        return undefined
    }

    return readOptionalStringArray(payload[propertyName], propertyName)
}

function readOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
    if (value === undefined) {
        return undefined
    }

    if (Array.isArray(value)) {
        return value.map((item, index) => readRequiredString(item, `${fieldName}[${index}]`))
    }

    if (typeof value !== 'string') {
        throw new ProblemRequestError(`${fieldName} must be a string array or a JSON array string`)
    }

    const normalized = value.trim()
    if (!normalized) {
        return []
    }

    if (normalized.startsWith('[')) {
        const parsed = safeJsonParse(normalized, `Invalid JSON array string for ${fieldName}`)
        if (!Array.isArray(parsed)) {
            throw new ProblemRequestError(`${fieldName} must be a JSON array string`)
        }

        return parsed.map((item, index) => readRequiredString(item, `${fieldName}[${index}]`))
    }

    return normalized
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
}

function readTestcases(value: unknown, requireAtLeastOne: boolean): ProblemTestCaseInput[] {
    const rawTestcases = typeof value === 'string'
        ? safeJsonParse(value, 'testcases must be a valid JSON array')
        : value

    if (!Array.isArray(rawTestcases)) {
        throw new ProblemRequestError('testcases must be an array')
    }

    if (requireAtLeastOne && rawTestcases.length === 0) {
        throw new ProblemRequestError('At least one testcase is required')
    }

    return rawTestcases.map((testcase, index) => readTestcase(testcase, index))
}

function readTestcase(value: unknown, index: number): ProblemTestCaseInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new ProblemRequestError(`testcases[${index}] must be an object`)
    }

    const testcase = value as Record<string, unknown>
    const nextTestcase: ProblemTestCaseInput = {
        input: readRequiredString(testcase.input, `testcases[${index}].input`),
        expected: readRequiredString(testcase.expected, `testcases[${index}].expected`),
        isHidden: readBoolean(testcase.isHidden, `testcases[${index}].isHidden`),
    }

    const image = readOptionalNullableString(testcase.image, `testcases[${index}].image`)
    if (image !== undefined) {
        nextTestcase.image = image
    }

    return nextTestcase
}

function readBoolean(value: unknown, fieldName: string): boolean {
    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['true', '1', 'yes', 'y'].includes(normalized)) {
            return true
        }

        if (['false', '0', 'no', 'n'].includes(normalized)) {
            return false
        }
    }

    throw new ProblemRequestError(`${fieldName} must be a boolean`)
}

function parseSpreadsheetBoolean(value: unknown, defaultValue = true): boolean {
    if (value === undefined || value === null || value === '') {
        return defaultValue
    }

    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'number') {
        return value !== 0
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (!normalized) {
            return defaultValue
        }

        if (['true', '1', 'yes', 'y'].includes(normalized)) {
            return true
        }

        if (['false', '0', 'no', 'n'].includes(normalized)) {
            return false
        }
    }

    throw new ProblemRequestError('Spreadsheet column "isHidden" must contain boolean-compatible values')
}

function safeJsonParse(value: string, errorMessage: string): unknown {
    try {
        return JSON.parse(value)
    } catch {
        throw new ProblemRequestError(errorMessage)
    }
}

function parseTestcasesFromSpreadsheet(file: Express.Multer.File): ProblemTestCaseInput[] {
    let workbook: XLSX.WorkBook

    try {
        workbook = XLSX.read(file.buffer, { type: 'buffer' })
    } catch {
        throw new ProblemRequestError('Failed to parse testcases spreadsheet')
    }

    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
        throw new ProblemRequestError('Spreadsheet must contain at least one sheet')
    }

    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet) {
        throw new ProblemRequestError(`Spreadsheet sheet "${firstSheetName}" is missing or unreadable`)
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
    if (rows.length === 0) {
        throw new ProblemRequestError('Spreadsheet does not contain any testcase rows')
    }

    return rows.map((row, index) => readSpreadsheetTestcase(row, index))
}

function readSpreadsheetTestcase(row: Record<string, unknown>, index: number): ProblemTestCaseInput {
    const input = readRequiredString(
        readSpreadsheetColumn(row, ['input', 'stdin', 'inputdata']),
        `testcases[${index}].input`,
    )
    const expected = readRequiredString(
        readSpreadsheetColumn(row, ['expected', 'output', 'expectedoutput']),
        `testcases[${index}].expected`,
    )
    const imageValue = readSpreadsheetColumn(row, ['image', 'imagekey'])

    const testcase: ProblemTestCaseInput = {
        input,
        expected,
        isHidden: parseSpreadsheetBoolean(readSpreadsheetColumn(row, ['ishidden', 'hidden']), true),
    }

    const image = readOptionalNullableString(imageValue, `testcases[${index}].image`)
    if (image !== undefined) {
        testcase.image = image
    }

    return testcase
}

function readSpreadsheetColumn(row: Record<string, unknown>, aliases: string[]): unknown {
    const normalizedEntries = new Map(
        Object.entries(row).map(([key, value]) => [normalizeSpreadsheetHeader(key), value]),
    )

    for (const alias of aliases) {
        const value = normalizedEntries.get(normalizeSpreadsheetHeader(alias))
        if (value !== undefined) {
            return value
        }
    }

    return undefined
}

function normalizeSpreadsheetHeader(value: string): string {
    return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function hasOwn(payload: Record<string, unknown>, propertyName: string): boolean {
    return Object.prototype.hasOwnProperty.call(payload, propertyName)
}
