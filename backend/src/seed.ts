import 'dotenv/config'
import { disconnectDB, prisma } from './shared/db.js'

const seedProblems = [
    {
        title: 'Two Sum',
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        difficulty: 'EASY',
        tags: ['Array', 'Hash Table'],
        topics: ['Algorithms'],
        testcases: [
            { input: '[2,7,11,15],9', expected: '[0,1]', isHidden: false },
            { input: '[3,2,4],6', expected: '[1,2]', isHidden: false },
            { input: '[3,3],6', expected: '[0,1]', isHidden: true },
        ],
    },
    {
        title: 'Valid Parentheses',
        description: 'Given a string s containing just the characters (, ), {, }, [ and ], determine if the input string is valid.',
        difficulty: 'EASY',
        tags: ['String', 'Stack'],
        topics: ['Algorithms'],
        testcases: [{ input: '"()[]{}"', expected: 'true', isHidden: false }, { input: '"([)]"', expected: 'false', isHidden: true }],
    },
    {
        title: 'Longest Substring Without Repeating Characters',
        description: 'Given a string s, find the length of the longest substring without duplicate characters.',
        difficulty: 'MEDIUM',
        tags: ['Hash Table', 'String', 'Sliding Window'],
        topics: ['Algorithms'],
        testcases: [{ input: '"abcabcbb"', expected: '3', isHidden: false }, { input: '"bbbbb"', expected: '1', isHidden: true }],
    },
    {
        title: 'Merge K Sorted Lists',
        description: 'You are given an array of k linked-lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list.',
        difficulty: 'HARD',
        tags: ['Linked List', 'Divide and Conquer', 'Heap'],
        topics: ['Algorithms'],
        testcases: [{ input: '[[1,4,5],[1,3,4],[2,6]]', expected: '[1,1,2,3,4,4,5,6]', isHidden: false }],
    },
] as const

async function main() {
    const existingCount = await prisma.problem.count()
    if (existingCount > 0) {
        console.log(`[Seed] Skipped: database already contains ${existingCount} problem(s).`)
        return
    }

    for (const problem of seedProblems) {
        const { testcases, ...problemData } = problem
        const created = await prisma.problem.create({ data: { ...problemData, testcases: { create: testcases } } })
        console.log(`[Seed] Created "${created.title}" (${created.id})`)
    }
}

try {
    await main()
} catch (error) {
    console.error('[Seed] Failed:', error)
    process.exitCode = 1
} finally {
    await disconnectDB()
}
