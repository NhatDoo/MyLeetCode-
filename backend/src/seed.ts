// import dotenv from 'dotenv'
// import { connectDB, disconnectDB } from './shared/db.js'
// import { seedExampleProblem } from './modules/problem/problem.service.js'

// dotenv.config()

// async function main() {
//     console.log('[Seed] Starting database seed...')

//     try {
//         await connectDB()

//         const problem = await seedExampleProblem()

//         console.log('--------------------------------------------------')
//         console.log(`✅ Success! Problem created: "${problem.title}"`)
//         console.log(`🆔 ID: ${problem.id}`)
//         console.log(`📝 Total Test Cases: ${problem.testcases.length}`)
//         console.log('--------------------------------------------------')

//     } catch (err) {
//         console.error('[Seed] Error during seeding:', err)
//         process.exit(1)
//     } finally {
//         await disconnectDB()
//     }
// }

// main()
