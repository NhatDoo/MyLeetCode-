import express from 'express'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'

import { connectDB, disconnectDB } from './shared/db.js'
import { connectQueue, disconnectQueue } from './shared/queue.js'
import { startSubmissionWorker } from './modules/submission/submission.worker.js'

import submissionRouter from './modules/submission/submission.controller.js'
import problemRouter from './modules/problem/problem.controller.js'
import authRouter from './modules/auth/auth.controller.js'
import {
    apiErrorHandler,
    applySecurityHeaders,
    SUBMISSION_SECURITY_POLICY,
} from './modules/submission/submission.security.js'

dotenv.config()

const app = express()
app.disable('x-powered-by')
app.use(applySecurityHeaders)
app.use(express.json({
    limit: `${SUBMISSION_SECURITY_POLICY.maxRequestBodyBytes}b`,
    strict: true,
}))

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MyLeetCode API',
            version: '1.0.0',
            description: 'API core for the automated judge system.',
        },
        servers: [
            { url: `http://localhost:${process.env.PORT || 3000}` },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                sessionCookie: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'mlc_refresh_token',
                },
            },
            schemas: {
                SubmitResponse: {
                    type: 'object',
                    properties: {
                        submissionId: { type: 'string' },
                        status: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    },
    apis: ['./src/modules/**/*.ts', './src/index.ts'],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/api/submissions', submissionRouter)
app.use('/api/problems', problemRouter)
app.use('/api/auth', authRouter)

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.use(apiErrorHandler)

const PORT = process.env.PORT || 3000

async function bootstrap() {
    try {
        await connectDB()
        await connectQueue()
        await startSubmissionWorker()

        app.listen(PORT, () => {
            console.log(`[Server] API running on port ${PORT}`)
        })
    } catch (err) {
        console.error('[Bootstrap] Failed to start application:', err)
        process.exit(1)
    }
}

bootstrap()

async function handleShutdown(signal: string) {
    console.log(`\n[Server] Received ${signal}. Shutting down...`)
    await disconnectQueue()
    await disconnectDB()
    process.exit(0)
}

process.on('SIGINT', () => handleShutdown('SIGINT'))
process.on('SIGTERM', () => handleShutdown('SIGTERM'))
