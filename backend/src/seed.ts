import 'dotenv/config'
import { disconnectDB, prisma } from './shared/db.js'

const seedProblems = [
    {
        title: 'Two Sum',
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        difficulty: 'EASY',
        tags: ['Array', 'Hash Table'],
        topics: ['Algorithms'],
        starterCode: {
            javascript: 'function twoSum(nums, target) {\n  // Write your solution here\n}',
            python: 'def two_sum(nums, target):\n    # Write your solution here\n    pass',
            cpp: '#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your solution here\n}',
        },
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
        starterCode: {
            javascript: 'function isValid(s) {\n  // Write your solution here\n}',
            python: 'def is_valid(s):\n    # Write your solution here\n    pass',
            cpp: '#include <string>\nusing namespace std;\n\nbool isValid(string s) {\n    // Write your solution here\n}',
        },
        testcases: [{ input: '"()[]{}"', expected: 'true', isHidden: false }, { input: '"([)]"', expected: 'false', isHidden: true }],
    },
    {
        title: 'Longest Substring Without Repeating Characters',
        description: 'Given a string s, find the length of the longest substring without duplicate characters.',
        difficulty: 'MEDIUM',
        tags: ['Hash Table', 'String', 'Sliding Window'],
        topics: ['Algorithms'],
        starterCode: {
            javascript: 'function lengthOfLongestSubstring(s) {\n  // Write your solution here\n}',
            python: 'def length_of_longest_substring(s):\n    # Write your solution here\n    pass',
            cpp: '#include <string>\nusing namespace std;\n\nint lengthOfLongestSubstring(string s) {\n    // Write your solution here\n}',
        },
        testcases: [{ input: '"abcabcbb"', expected: '3', isHidden: false }, { input: '"bbbbb"', expected: '1', isHidden: true }],
    },
    {
        title: 'Merge K Sorted Lists',
        description: 'You are given an array of k linked-lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list.',
        difficulty: 'HARD',
        tags: ['Linked List', 'Divide and Conquer', 'Heap'],
        topics: ['Algorithms'],
        starterCode: {
            javascript: 'function mergeKLists(lists) {\n  // Write your solution here\n}',
            python: 'def merge_k_lists(lists):\n    # Write your solution here\n    pass',
            cpp: 'using namespace std;\n\n// Define your ListNode and solution here\n',
        },
        testcases: [{ input: '[[1,4,5],[1,3,4],[2,6]]', expected: '[1,1,2,3,4,4,5,6]', isHidden: false }],
    },
] as const

async function main() {
    for (const problem of seedProblems) {
        const { testcases, ...problemData } = problem
        const existing = await prisma.problem.findFirst({ where: { title: problem.title }, select: { id: true } })
        if (existing) {
            await prisma.problem.update({ where: { id: existing.id }, data: { starterCode: problemData.starterCode } })
            console.log(`[Seed] Updated "${problem.title}" (${existing.id})`)
            continue
        }

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
