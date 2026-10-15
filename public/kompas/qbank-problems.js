/* Kompas Question Bank — coding practice set. Classic interview problem types, written for Kompas.
   Each problem: a function to implement, tests the in-browser runner checks, hints, and a reference solution.
   compare: "exact" | "sortedNums" (order of numbers does not matter) | "groups" (order of groups and of items does not matter). */
(function (root) {
  const normalizeSrc = [
    "function normalize(mode, v) {",
    "  if (mode === 'sortedNums') return Array.isArray(v) ? v.slice().sort(function (a, b) { return a - b; }) : v;",
    "  if (mode === 'groups') return Array.isArray(v) ? v.map(function (g) { return Array.isArray(g) ? g.slice().sort() : g; })",
    "    .sort(function (a, b) { return JSON.stringify(a) < JSON.stringify(b) ? -1 : 1; }) : v;",
    "  return v;",
    "}",
  ].join("\n");

  const problems = [
    {
      id: "two-sum", title: "Two Sum", difficulty: "Easy", topic: "Hash map", fn: "twoSum", compare: "sortedNums",
      prompt: "Given an array of numbers and a target, return the indices of the two numbers that add up to the target. Exactly one pair exists, and you may not use the same element twice.",
      examples: [["nums = [2, 7, 11, 15], target = 9", "[0, 1]"], ["nums = [3, 2, 4], target = 6", "[1, 2]"]],
      starter: "function twoSum(nums, target) {\n  // return [i, j]\n}",
      tests: [
        { args: [[2, 7, 11, 15], 9], expect: [0, 1] }, { args: [[3, 2, 4], 6], expect: [1, 2] },
        { args: [[3, 3], 6], expect: [0, 1] }, { args: [[-1, -2, -3, -4, -5], -8], expect: [2, 4] },
      ],
      hints: ["Checking every pair works but is O(n²). What would you need to remember to do it in one pass?", "For each number, the partner you need is target − number. Store numbers you have seen in a map of value → index."],
      solution: "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
      complexity: "O(n) time, O(n) space",
    },
    {
      id: "valid-brackets", title: "Valid Brackets", difficulty: "Easy", topic: "Stack", fn: "isValidBrackets", compare: "exact",
      prompt: "Given a string made only of the characters ( ) [ ] { }, return true if every bracket is closed by the same type in the correct order.",
      examples: [["s = \"()[]{}\"", "true"], ["s = \"([)]\"", "false"]],
      starter: "function isValidBrackets(s) {\n  // return true or false\n}",
      tests: [
        { args: ["()"], expect: true }, { args: ["()[]{}"], expect: true }, { args: ["(]"], expect: false },
        { args: ["([)]"], expect: false }, { args: ["{[]}"], expect: true }, { args: [""], expect: true }, { args: ["("], expect: false },
      ],
      hints: ["The most recently opened bracket must be the first one closed. Which data structure gives you 'most recent first'?", "Push every opener. On a closer, pop and check it matches. At the end the stack must be empty."],
      solution: "function isValidBrackets(s) {\n  const pair = { ')': '(', ']': '[', '}': '{' };\n  const stack = [];\n  for (const ch of s) {\n    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);\n    else if (stack.pop() !== pair[ch]) return false;\n  }\n  return stack.length === 0;\n}",
      complexity: "O(n) time, O(n) space",
    },
    {
      id: "merge-sorted", title: "Merge Two Sorted Arrays", difficulty: "Easy", topic: "Two pointers", fn: "mergeSorted", compare: "exact",
      prompt: "Given two arrays that are each sorted in ascending order, return one sorted array containing every element of both.",
      examples: [["a = [1, 3, 5], b = [2, 4, 6]", "[1, 2, 3, 4, 5, 6]"], ["a = [], b = [1]", "[1]"]],
      starter: "function mergeSorted(a, b) {\n  // return the merged array\n}",
      tests: [
        { args: [[1, 3, 5], [2, 4, 6]], expect: [1, 2, 3, 4, 5, 6] }, { args: [[], [1]], expect: [1] },
        { args: [[1, 1], [1]], expect: [1, 1, 1] }, { args: [[-3, 0], [-2, 7, 9]], expect: [-3, -2, 0, 7, 9] },
      ],
      hints: ["Sorting the concatenation works, but it ignores that both inputs are already sorted.", "Keep one index in each array. Take the smaller current element each time, then append whatever is left."],
      solution: "function mergeSorted(a, b) {\n  const out = [];\n  let i = 0, j = 0;\n  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);\n  while (i < a.length) out.push(a[i++]);\n  while (j < b.length) out.push(b[j++]);\n  return out;\n}",
      complexity: "O(n + m) time, O(n + m) space",
    },
    {
      id: "best-trade", title: "Best Single Trade", difficulty: "Easy", topic: "Arrays", fn: "maxProfit", compare: "exact",
      prompt: "prices[i] is the price of a stock on day i. You may buy once and sell once on a later day. Return the largest profit possible, or 0 if no profit can be made.",
      examples: [["prices = [7, 1, 5, 3, 6, 4]", "5  (buy at 1, sell at 6)"], ["prices = [7, 6, 4, 3, 1]", "0"]],
      starter: "function maxProfit(prices) {\n  // return a number\n}",
      tests: [
        { args: [[7, 1, 5, 3, 6, 4]], expect: 5 }, { args: [[7, 6, 4, 3, 1]], expect: 0 },
        { args: [[1]], expect: 0 }, { args: [[2, 4, 1, 9]], expect: 8 },
      ],
      hints: ["For each day, the best sale uses the lowest price seen before it.", "Walk once: track the minimum price so far and the best (price − minimum) so far."],
      solution: "function maxProfit(prices) {\n  let low = Infinity, best = 0;\n  for (const p of prices) {\n    if (p < low) low = p;\n    else if (p - low > best) best = p - low;\n  }\n  return best;\n}",
      complexity: "O(n) time, O(1) space",
    },
    {
      id: "binary-search", title: "Binary Search", difficulty: "Easy", topic: "Searching", fn: "binarySearch", compare: "exact",
      prompt: "Given an array sorted in ascending order with no duplicates, return the index of target, or -1 if it is not present. Aim for O(log n).",
      examples: [["nums = [-1, 0, 3, 5, 9, 12], target = 9", "4"], ["nums = [-1, 0, 3, 5, 9, 12], target = 2", "-1"]],
      starter: "function binarySearch(nums, target) {\n  // return an index or -1\n}",
      tests: [
        { args: [[-1, 0, 3, 5, 9, 12], 9], expect: 4 }, { args: [[-1, 0, 3, 5, 9, 12], 2], expect: -1 },
        { args: [[], 1], expect: -1 }, { args: [[5], 5], expect: 0 }, { args: [[1, 3], 3], expect: 1 },
      ],
      hints: ["Each comparison with the middle element lets you discard half the array.", "Keep lo and hi. While lo <= hi: mid = (lo + hi) >> 1; move lo past mid or hi before mid."],
      solution: "function binarySearch(nums, target) {\n  let lo = 0, hi = nums.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;\n  }\n  return -1;\n}",
      complexity: "O(log n) time, O(1) space",
    },
    {
      id: "longest-unique", title: "Longest Substring Without Repeats", difficulty: "Medium", topic: "Sliding window", fn: "longestUniqueSubstring", compare: "exact",
      prompt: "Given a string, return the length of the longest substring that contains no repeated character.",
      examples: [["s = \"abcabcbb\"", "3  (\"abc\")"], ["s = \"bbbbb\"", "1"]],
      starter: "function longestUniqueSubstring(s) {\n  // return a number\n}",
      tests: [
        { args: ["abcabcbb"], expect: 3 }, { args: ["bbbbb"], expect: 1 }, { args: ["pwwkew"], expect: 3 },
        { args: [""], expect: 0 }, { args: ["dvdf"], expect: 3 },
      ],
      hints: ["Grow a window to the right. When a character repeats, the window's left edge has to move.", "Remember the last index of each character. On a repeat inside the window, jump the left edge to one past that index."],
      solution: "function longestUniqueSubstring(s) {\n  const last = new Map();\n  let start = 0, best = 0;\n  for (let i = 0; i < s.length; i++) {\n    const ch = s[i];\n    if (last.has(ch) && last.get(ch) >= start) start = last.get(ch) + 1;\n    last.set(ch, i);\n    if (i - start + 1 > best) best = i - start + 1;\n  }\n  return best;\n}",
      complexity: "O(n) time, O(k) space for k distinct characters",
    },
    {
      id: "group-anagrams", title: "Group Anagrams", difficulty: "Medium", topic: "Hashing", fn: "groupAnagrams", compare: "groups",
      prompt: "Given a list of words, group the words that are anagrams of each other. Return a list of groups; the order of groups and of words inside a group does not matter.",
      examples: [["words = [\"eat\", \"tea\", \"tan\", \"ate\", \"nat\", \"bat\"]", "[[\"eat\",\"tea\",\"ate\"], [\"tan\",\"nat\"], [\"bat\"]]"]],
      starter: "function groupAnagrams(words) {\n  // return an array of arrays\n}",
      tests: [
        { args: [["eat", "tea", "tan", "ate", "nat", "bat"]], expect: [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]] },
        { args: [[""]], expect: [[""]] }, { args: [["a"]], expect: [["a"]] },
        { args: [["ab", "ba", "abc", "cab", "x"]], expect: [["ab", "ba"], ["abc", "cab"], ["x"]] },
      ],
      hints: ["Two words are anagrams when they contain the same letters. What single value is identical for all of them?", "Sort each word's letters and use that as a map key; collect the words under each key."],
      solution: "function groupAnagrams(words) {\n  const groups = new Map();\n  for (const w of words) {\n    const key = w.split('').sort().join('');\n    if (!groups.has(key)) groups.set(key, []);\n    groups.get(key).push(w);\n  }\n  return Array.from(groups.values());\n}",
      complexity: "O(n · k log k) time for n words of length k, O(n · k) space",
    },
    {
      id: "merge-intervals", title: "Merge Intervals", difficulty: "Medium", topic: "Sorting", fn: "mergeIntervals", compare: "exact",
      prompt: "Given a list of intervals [start, end], merge every pair that overlaps (touching counts) and return the result sorted by start.",
      examples: [["intervals = [[1,3], [2,6], [8,10], [15,18]]", "[[1,6], [8,10], [15,18]]"], ["intervals = [[1,4], [4,5]]", "[[1,5]]"]],
      starter: "function mergeIntervals(intervals) {\n  // return an array of [start, end]\n}",
      tests: [
        { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expect: [[1, 6], [8, 10], [15, 18]] }, { args: [[[1, 4], [4, 5]]], expect: [[1, 5]] },
        { args: [[[5, 7], [1, 2]]], expect: [[1, 2], [5, 7]] }, { args: [[]], expect: [] }, { args: [[[1, 10], [2, 3], [4, 5]]], expect: [[1, 10]] },
      ],
      hints: ["Overlaps are easy to spot once the intervals are in order of start.", "Sort by start. Keep a current interval; extend its end while the next start is <= that end, otherwise push it and start a new one."],
      solution: "function mergeIntervals(intervals) {\n  const sorted = intervals.map(function (x) { return x.slice(); }).sort(function (a, b) { return a[0] - b[0]; });\n  const out = [];\n  for (const cur of sorted) {\n    const last = out[out.length - 1];\n    if (last && cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]);\n    else out.push(cur);\n  }\n  return out;\n}",
      complexity: "O(n log n) time, O(n) space",
    },
    {
      id: "top-k-frequent", title: "Top K Frequent Elements", difficulty: "Medium", topic: "Counting", fn: "topKFrequent", compare: "sortedNums",
      prompt: "Given an array of numbers and k, return the k values that appear most often. The answer is unique and may be returned in any order.",
      examples: [["nums = [1, 1, 1, 2, 2, 3], k = 2", "[1, 2]"], ["nums = [4], k = 1", "[4]"]],
      starter: "function topKFrequent(nums, k) {\n  // return an array of k numbers\n}",
      tests: [
        { args: [[1, 1, 1, 2, 2, 3], 2], expect: [1, 2] }, { args: [[4], 1], expect: [4] },
        { args: [[5, 5, 6, 6, 6, 7], 1], expect: [6] }, { args: [[9, 8, 9, 8, 9, 7, 8, 9], 2], expect: [8, 9] },
      ],
      hints: ["Count first. The question is then how to pick the k largest counts.", "A frequency can be at most n, so bucket values by count and read the buckets from high to low — no full sort needed."],
      solution: "function topKFrequent(nums, k) {\n  const count = new Map();\n  for (const n of nums) count.set(n, (count.get(n) || 0) + 1);\n  const buckets = [];\n  for (const [value, c] of count) (buckets[c] = buckets[c] || []).push(value);\n  const out = [];\n  for (let c = buckets.length - 1; c > 0 && out.length < k; c--) {\n    for (const value of buckets[c] || []) { if (out.length < k) out.push(value); }\n  }\n  return out;\n}",
      complexity: "O(n) time, O(n) space",
    },
    {
      id: "product-except-self", title: "Product of Array Except Self", difficulty: "Medium", topic: "Prefix products", fn: "productExceptSelf", compare: "exact",
      prompt: "Return an array where position i holds the product of every element except nums[i]. Do not use division.",
      examples: [["nums = [1, 2, 3, 4]", "[24, 12, 8, 6]"], ["nums = [-1, 1, 0, -3, 3]", "[0, 0, 9, 0, 0]"]],
      starter: "function productExceptSelf(nums) {\n  // return an array\n}",
      tests: [
        { args: [[1, 2, 3, 4]], expect: [24, 12, 8, 6] }, { args: [[-1, 1, 0, -3, 3]], expect: [0, 0, 9, 0, 0] },
        { args: [[2, 3]], expect: [3, 2] }, { args: [[0, 0]], expect: [0, 0] },
      ],
      hints: ["The answer at i is (product of everything to the left) × (product of everything to the right).", "One pass left-to-right stores the left products in the output; a second pass right-to-left multiplies in a running right product."],
      solution: "function productExceptSelf(nums) {\n  const out = new Array(nums.length).fill(1);\n  let left = 1;\n  for (let i = 0; i < nums.length; i++) { out[i] = left; left *= nums[i]; }\n  let right = 1;\n  for (let i = nums.length - 1; i >= 0; i--) { out[i] *= right; right *= nums[i]; }\n  return out.map(function (v) { return v === 0 ? 0 : v; });\n}",
      complexity: "O(n) time, O(1) extra space",
    },
    {
      id: "count-islands", title: "Number of Islands", difficulty: "Medium", topic: "Graph search", fn: "countIslands", compare: "exact",
      prompt: "A grid holds 1 for land and 0 for water. An island is a group of land cells connected up, down, left or right. Return how many islands there are.",
      examples: [["grid = [[1,1,0,0], [1,0,0,1], [0,0,1,1]]", "2"]],
      starter: "function countIslands(grid) {\n  // return a number\n}",
      tests: [
        { args: [[[1, 1, 0, 0], [1, 0, 0, 1], [0, 0, 1, 1]]], expect: 2 }, { args: [[[0]]], expect: 0 },
        { args: [[[1, 0, 1], [0, 1, 0], [1, 0, 1]]], expect: 5 }, { args: [[]], expect: 0 }, { args: [[[1, 1], [1, 1]]], expect: 1 },
      ],
      hints: ["Each time you find land you have not visited, you have found one new island. Then you must mark the whole island as visited.", "Scan every cell. On an unvisited 1, add one to the count and flood-fill (stack or queue) to mark every connected 1."],
      solution: "function countIslands(grid) {\n  const rows = grid.length, cols = rows ? grid[0].length : 0;\n  const seen = grid.map(function (r) { return r.map(function () { return false; }); });\n  let count = 0;\n  for (let r = 0; r < rows; r++) {\n    for (let c = 0; c < cols; c++) {\n      if (grid[r][c] !== 1 || seen[r][c]) continue;\n      count++;\n      const stack = [[r, c]];\n      seen[r][c] = true;\n      while (stack.length) {\n        const cell = stack.pop();\n        const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];\n        for (const m of moves) {\n          const nr = cell[0] + m[0], nc = cell[1] + m[1];\n          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 1 && !seen[nr][nc]) { seen[nr][nc] = true; stack.push([nr, nc]); }\n        }\n      }\n    }\n  }\n  return count;\n}",
      complexity: "O(rows · cols) time and space",
    },
    {
      id: "coin-change", title: "Coin Change", difficulty: "Medium", topic: "Dynamic programming", fn: "coinChange", compare: "exact",
      prompt: "Given coin denominations and an amount, return the fewest coins needed to make that amount, or -1 if it cannot be made. You have unlimited coins of each kind.",
      examples: [["coins = [1, 2, 5], amount = 11", "3  (5 + 5 + 1)"], ["coins = [2], amount = 3", "-1"]],
      starter: "function coinChange(coins, amount) {\n  // return a number\n}",
      tests: [
        { args: [[1, 2, 5], 11], expect: 3 }, { args: [[2], 3], expect: -1 }, { args: [[1], 0], expect: 0 },
        { args: [[2, 5, 10], 27], expect: 4 }, { args: [[3, 7], 5], expect: -1 },
      ],
      hints: ["Taking the largest coin first fails for some coin sets (try coins [1, 3, 4], amount 6).", "Let best[a] be the fewest coins for amount a. best[0] = 0, and best[a] = 1 + min(best[a − coin]) over the coins that fit."],
      solution: "function coinChange(coins, amount) {\n  const best = new Array(amount + 1).fill(Infinity);\n  best[0] = 0;\n  for (let a = 1; a <= amount; a++) {\n    for (const coin of coins) {\n      if (coin <= a && best[a - coin] + 1 < best[a]) best[a] = best[a - coin] + 1;\n    }\n  }\n  return best[amount] === Infinity ? -1 : best[amount];\n}",
      complexity: "O(amount · coins) time, O(amount) space",
    },
    {
      id: "lru-cache", title: "LRU Cache", difficulty: "Medium", topic: "Design", fn: "runLRU", compare: "exact",
      prompt: "Design a least-recently-used cache with a fixed capacity. \"get\" returns the value for a key or -1, and counts as a use. \"put\" sets a key and, when the cache is over capacity, evicts the key that was used least recently. Implement runLRU(capacity, ops): ops is a list like [\"put\", key, value] or [\"get\", key]; return the results of the get operations in order.",
      examples: [["capacity = 2, ops = [[\"put\",1,1], [\"put\",2,2], [\"get\",1], [\"put\",3,3], [\"get\",2]]", "[1, -1]  (putting 3 evicted key 2)"]],
      starter: "function runLRU(capacity, ops) {\n  // return the results of every \"get\"\n}",
      tests: [
        { args: [2, [["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["put", 4, 4], ["get", 1], ["get", 3], ["get", 4]]], expect: [1, -1, -1, 3, 4] },
        { args: [1, [["put", 1, 10], ["get", 1], ["put", 2, 20], ["get", 1], ["get", 2]]], expect: [10, -1, 20] },
        { args: [2, [["put", 1, 1], ["put", 1, 5], ["get", 1]]], expect: [5] },
      ],
      hints: ["You need two things at once: lookup by key, and an order of use you can update cheaply.", "A JavaScript Map remembers insertion order. On every use, delete the key and set it again so it becomes the newest; the oldest is map.keys().next().value."],
      solution: "function runLRU(capacity, ops) {\n  const cache = new Map();\n  const out = [];\n  for (const op of ops) {\n    const key = op[1];\n    if (op[0] === 'get') {\n      if (!cache.has(key)) { out.push(-1); continue; }\n      const value = cache.get(key);\n      cache.delete(key); cache.set(key, value);\n      out.push(value);\n    } else {\n      if (cache.has(key)) cache.delete(key);\n      cache.set(key, op[2]);\n      if (cache.size > capacity) cache.delete(cache.keys().next().value);\n    }\n  }\n  return out;\n}",
      complexity: "O(1) per operation, O(capacity) space",
    },
  ];

  root.KOMPAS_CODE = { problems: problems, normalizeSrc: normalizeSrc };
})(typeof window !== "undefined" ? window : globalThis);
