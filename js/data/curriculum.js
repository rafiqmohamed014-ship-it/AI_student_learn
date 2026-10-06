/**
 * js/data/curriculum.js
 * ---------------------------------------------------------------------------
 * The built-in curriculum. Static on purpose: it ships with the app, needs no
 * database, and never fails to load.
 *
 * Shape of a lesson:
 *   id, subjectId, title, summary, minutes, topics[],
 *   sections:  [{ h: 'Heading', b: 'markdown body' }]
 *   keyPoints: ['...'],
 *   examples:  [{ title, lang, code, explain }],
 *   practice:  [{ q, a }]
 *
 * To add content: append an object to the right subject's `lessons` array.
 * User-created lessons live in the database and are merged in by the store.
 */

export const SUBJECTS = [
  {
    id: 'programming',
    name: 'Programming',
    emoji: '💻',
    description:
      'Core programming thinking: variables, control flow, functions, data structures and the algorithms behind them. Language-agnostic first, then applied.',
    topics: ['Variables & Types', 'Control Flow', 'Functions', 'Recursion', 'Data Structures', 'Algorithms', 'Error Handling'],
    color: '#ff7a00',
    icon: 'code',
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    emoji: '🧮',
    description:
      'The maths that computer science actually needs: logic, algebra, discrete maths, probability, statistics and the calculus behind big-O.',
    topics: ['Discrete Maths', 'Probability', 'Statistics', 'Linear Algebra', 'Calculus', 'Graph Theory'],
    color: '#ff9d2e',
    icon: 'calc',
  },
  {
    id: 'cyber-security',
    name: 'Cyber Security',
    emoji: '🔐',
    description:
      'How systems are attacked and defended: cryptography, network security, web vulnerabilities, authentication and defensive thinking.',
    topics: ['CIA Triad', 'Cryptography', 'Network Security', 'Web Attacks', 'Authentication', 'Defence'],
    color: '#f97316',
    icon: 'shield',
  },
  {
    id: 'web-development',
    name: 'Web Development',
    emoji: '🌐',
    description:
      'Build real, accessible, fast websites: semantic HTML, modern CSS, the DOM, JavaScript in the browser, HTTP and the React component model.',
    topics: ['HTML', 'CSS', 'DOM', 'JavaScript', 'HTTP & APIs', 'Accessibility', 'React'],
    color: '#22d3ee',
    icon: 'globe',
  },
  {
    id: 'data-science',
    name: 'Data Science',
    emoji: '📊',
    description:
      'Turn raw data into decisions: cleaning, exploration, visualisation, statistics, regression, model evaluation and honest reporting.',
    topics: ['Data Cleaning', 'Pandas', 'Visualisation', 'Statistics', 'Machine Learning', 'Model Evaluation'],
    color: '#34d399',
    icon: 'trend',
  },
  {
    id: 'ai',
    name: 'Artificial Intelligence',
    emoji: '🤖',
    description:
      'How modern AI works: search, knowledge representation, learning paradigms, neural networks, transformers and the responsible use of these systems.',
    topics: ['Search', 'Logic & Reasoning', 'Machine Learning', 'Neural Networks', 'NLP', 'Transformers', 'AI Ethics'],
    color: '#a78bfa',
    icon: 'brain',
  },
  {
    id: 'iot',
    name: 'IoT',
    emoji: '📡',
    description:
      'Connecting physical things: sensors, microcontrollers, protocols, embedded constraints, data pipelines and the security that comes with it.',
    topics: ['Sensors', 'Microcontrollers', 'MQTT', 'Embedded C', 'Edge Computing', 'Device Security'],
    color: '#facc15',
    icon: 'cpu',
  },
  {
    id: 'ar-vr',
    name: 'AR / VR',
    emoji: '🎮',
    description:
      'Spatial computing: coordinate systems, tracking, rendering pipelines, interaction design and the performance budget that makes it feel real.',
    topics: ['Coordinate Systems', 'Tracking', 'Rendering', 'Unity', 'Interaction Design', 'Performance'],
    color: '#f472b6',
    icon: 'gamepad',
  },
  {
    id: 'toc',
    name: 'Theory of Computation',
    emoji: '📖',
    description:
      'The mathematical limits of computing: formal languages, finite automata, Turing machines, computability, decidability and complexity classes.',
    topics: ['Formal Languages', 'Finite Automata', 'Turing Machines', 'Decidability', 'P vs NP', 'Complexity'],
    color: '#60a5fa',
    icon: 'book',
  },
];

export const LESSONS = [
  /* ======================================================= PROGRAMMING === */
  {
    id: 'prog-1',
    subjectId: 'programming',
    title: 'Variables, Types and How Computers Store Data',
    summary: 'Memory, variables, data types and why type systems exist.',
    minutes: 12,
    topics: ['Variables & Types', 'Memory'],
    sections: [
      {
        h: 'What a variable really is',
        b: `A **variable is a name for a memory location**. When you write \`score = 42\`, the computer sets aside a few bytes somewhere in RAM, writes the bit pattern for 42 into them, and binds the name \`score\` to that location.

That is why a variable has a *type*: the bytes alone are meaningless. The same bit pattern \`01000001\` is the number 65, the character \`A\` in ASCII, or part of a larger integer. **The type is what tells the machine how to interpret the bytes.**`,
      },
      {
        h: 'The common types',
        b: `| Type | Meaning | Example |
| --- | --- | --- |
| **Integer** | whole numbers, exact | \`0\`, \`-7\`, \`1024\` |
| **Float** | decimals, approximate | \`3.14\`, \`0.1\` |
| **Boolean** | true / false | \`isLoggedIn\` |
| **String** | text (a sequence of characters) | \`"Ada Lovelace"\` |
| **List / Array** | ordered, mutable collection | \`[1, 2, 3]\` |
| **Dictionary / Object** | key → value pairs | \`{"id": 7}\` |

**Precision warning:** \`0.1 + 0.2\` is not \`0.3\` in binary floating point, because 0.1 has no exact binary representation (like 1/3 in decimal). Never compare floats with \`==\` for money or precision-critical values.`,
      },
      {
        h: 'Static vs dynamic typing',
        b: `**Statically typed** languages (Java, C, TypeScript, Rust) check types at *compile time*. The mistake is caught before the program runs — a huge safety win.

**Dynamically typed** languages (Python, JavaScript) check at *run time*. Types live with the values, so code is shorter and more flexible.

Most large projects end up mixing: strict types on the core, looser types at the edges.`,
      },
    ],
    keyPoints: [
      'A variable is a human-readable name bound to a memory location.',
      'The data type defines how raw bytes are interpreted.',
      'Floating point is approximate — never use `==` for exact decimals.',
      'Static typing catches bugs before runtime; dynamic typing trades safety for flexibility.',
    ],
    examples: [
      {
        title: 'Swapping without a temporary (a classic interview warm-up)',
        lang: 'javascript',
        code: `let a = 5, b = 9;
a = a + b;   // 14
b = a - b;   // 5  (14 - 9)
a = a - b;   // 9  (14 - 5)
console.log(a, b); // 9 5`,
        explain: 'Classic arithmetic trick. In real code just use a temp variable — clarity beats cleverness.',
      },
    ],
    practice: [
      { q: 'Why does `0.1 + 0.2 !== 0.3` in most languages?', a: 'Because 0.1 and 0.2 have no exact binary representation, so the stored values are tiny approximations that do not sum to exactly 0.3.' },
      { q: 'What does a data type really do?', a: 'It tells the machine how to interpret the raw bytes in memory as a value, and which operations are legal on them.' },
    ],
  },
  {
    id: 'prog-2',
    subjectId: 'programming',
    title: 'Control Flow: Decisions, Loops and Termination',
    summary: 'if/else, loops, and the three ways a loop can go wrong.',
    minutes: 14,
    topics: ['Control Flow', 'Loops', 'Debugging'],
    sections: [
      {
        h: 'Sequence, selection, iteration',
        b: `Every program is built from three structures:
- **Sequence** — statements run in order.
- **Selection** — a decision chooses a branch (\`if / else / switch\`).
- **Iteration** — a block repeats (\`for\`, \`while\`, \`do...while\`).

Nesting these is enough to express any computable function (that's the core claim of structured programming).`,
      },
      {
        h: 'Choosing the right loop',
        b: `**\`for\`** — you know the count or the index. \`for (let i = 0; i < n; i++)\`

**\`while\`** — repeat until a condition flips. Good for "keep reading input".

**\`do...while\`** — body runs at least once. Useful for menu loops.

**\`for...of\`** — iterate values of an iterable. \`for (const user of users)\`

**\`for...in\`** — iterate *keys*. Usually a mistake for arrays; prefer \`for...of\`.`,
      },
      {
        h: 'The three ways loops break',
        b: `1. **Off-by-one** — \`i <= arr.length\` throws on the last pass. Arrays are 0-indexed, so the last valid index is \`length - 1\`.
2. **Infinite loop** — the condition never becomes false. Always make sure something inside the loop moves the condition toward false.
3. **Mutating while iterating** — removing items from a list while looping over it skips elements. Iterate over a *copy* instead.`,
      },
    ],
    keyPoints: [
      'Sequence + selection + iteration = any computable function.',
      'Use `for` when you know the count, `while` when you know the condition.',
      '`arr.length` is a count; the last valid index is `arr.length - 1`.',
      'Never mutate a collection while iterating over it.',
    ],
    examples: [
      {
        title: 'FizzBuzz — the loop that teaches boundaries',
        lang: 'python',
        code: `for i in range(1, 101):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)`,
        explain: 'Order of the conditions matters: check the most specific case (both) first, otherwise 15 prints "Fizz".',
      },
    ],
    practice: [
      { q: 'Why does `for (let i = 0; i <= arr.length; i++)` crash?', a: 'When i equals arr.length, arr[i] is undefined and reading a property of it throws. The last valid index is arr.length - 1.' },
      { q: 'You delete items from a list inside a loop over that list. What breaks?', a: 'Indices shift down as items are removed, so the loop skips elements. Iterate over a copy: `[...items].forEach(...)`.' },
    ],
  },
  {
    id: 'prog-3',
    subjectId: 'programming',
    title: 'Functions, Scope and Recursion',
    summary: 'Parameters, closures, call stacks and when recursion is the right tool.',
    minutes: 16,
    topics: ['Functions', 'Recursion', 'Scope'],
    sections: [
      {
        h: 'A function is a named, reusable transformation',
        b: `A function takes **inputs (parameters)**, does work, and returns an **output**.

\`\`\`javascript
function add(a, b) {      // parameters
  return a + b;          // return value
}
const total = add(2, 3);  // 5 -> stored in \`total\`
\`\`\`

Note the difference: a function that *returns* a value can be chained and stored. A function that only *prints* cannot. **Design functions to return, not to print.**`,
      },
      {
        h: 'Scope: where a name is visible',
        b: `- **Local scope** — inside a function. Dies when the function returns.
- **Global scope** — everywhere. Avoid; it is the #1 source of bugs.
- **Block scope** — inside \`{}\` in most modern languages.
- **Closure** — an inner function remembering the variables of the scope where it was created, even after that scope has finished. This is how callbacks "remember" things.`,
      },
      {
        h: 'Recursion: a function that calls itself',
        b: `Every correct recursive function has exactly two parts:

1. **Base case** — a simple input that returns directly. This is what stops the recursion.
2. **Recursive case** — the function calls itself on a *smaller* problem.

\`\`\`javascript
function factorial(n) {
  if (n <= 1) return 1;        // base case
  return n * factorial(n - 1); // recursive case
}
\`\`\`

Trace \`factorial(4)\`: 4·factorial(3) → 4·3·factorial(2) → 4·3·2·factorial(1) → 4·3·2·1 = 24.

**When to use it:** tree/graph traversals, divide-and-conquer, backtracking. **When not to:** anything a simple loop does — a loop uses far less memory than the call stack.`,
      },
    ],
    keyPoints: [
      'Prefer functions that *return* values over functions that only print.',
      'A closure remembers the variables of the scope where it was created.',
      'Recursion = base case + a strictly smaller recursive call.',
      'Each call consumes stack space — deep recursion can overflow.',
    ],
    examples: [
      {
        title: 'Fibonacci: recursion vs iteration (and why memoisation exists)',
        lang: 'javascript',
        code: `// naive: ~1.6^n calls - explodes fast
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

// memoised: O(n) calls
const cache = new Map();
function fibFast(n) {
  if (n < 2) return n;
  if (cache.has(n)) return cache.get(n);
  const out = fibFast(n - 1) + fibFast(n - 2);
  cache.set(n, out);
  return out;
}`,
        explain: 'Naive recursion recomputes the same values exponentially often. Memoisation stores each result once.',
      },
    ],
    practice: [
      { q: 'A recursive function never returns. What has gone wrong?', a: 'There is no reachable base case for that input, so the calls keep expanding until the call stack overflows.' },
      { q: 'What is a closure?', a: 'A function bundled together with the variables of the scope it was created in, so it keeps access to them even after that scope has exited.' },
    ],
  },
  {
    id: 'prog-4',
    subjectId: 'programming',
    title: 'Data Structures: Arrays, Hash Tables, Stacks, Queues and Trees',
    summary: 'The core structures and the trade-offs behind each one.',
    minutes: 18,
    topics: ['Data Structures', 'Algorithms'],
    sections: [
      {
        h: 'Array / List',
        b: `An ordered sequence stored **contiguously** in memory.

- Access by index: **O(1)** — jump straight to the address.
- Search for a value: **O(n)** — must check each.
- Insert/remove at the front: **O(n)** — everything shifts.
- Insert/remove at the end: **O(1)** amortised.

That last asymmetry is why "prepend to an array" is a classic performance bug.`,
      },
      {
        h: 'Hash Table (Map / Dictionary)',
        b: `Stores key → value using a **hash function** to convert the key into a bucket index.

- Insert, lookup, delete: **O(1)** on average.
- Requires hashable keys (strings, numbers — not arbitrary objects in most languages).
- Collisions happen; good implementations handle them with chaining or open addressing.

This is the structure that makes "count how many times each word appears" a one-pass problem.`,
      },
      {
        h: 'Stack and Queue',
        b: `**Stack (LIFO)** — last in, first out. \`push\` / \`pop\`. The call stack is a stack. Undo history is a stack.

**Queue (FIFO)** — first in, first out. \`enqueue\` / \`dequeue\` with two pointers. Task schedulers, BFS, printer queues.

**Deque** — both ends O(1). Sliding-window problems are the classic use.`,
      },
      {
        h: 'Tree',
        b: `A **root** with child nodes. The two structures you will use most:

- **Binary Search Tree (BST)** — left subtree < node < right subtree. Search, insert and delete are all O(h). If the tree is balanced, h ≈ log₂n. If it degenerates into a list, it becomes O(n).
- **Heap** — every parent is greater (max-heap) or smaller (min-heap) than its children. Gives O(1) access to the extreme value, O(log n) insert/remove. Priority queues are heaps.`,
      },
    ],
    keyPoints: [
      'Array: O(1) index access, O(n) front insert.',
      'Hash table: O(1) average lookup — the backbone of counting and caching.',
      'Stack = LIFO, Queue = FIFO; both O(1) at their ends.',
      'BST performance is driven by height, so balancing matters.',
    ],
    examples: [
      {
        title: 'Two Sum in one pass (why hash tables exist)',
        lang: 'javascript',
        code: `function twoSum(nums, target) {
  const seen = new Map();      // value -> index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return null;
}`,
        explain: 'Brute force is O(n²) — check every pair. Looking up the complement in a hash table makes it O(n).',
      },
    ],
    practice: [
      { q: 'Why is inserting at the front of an array O(n)?', a: 'Elements are stored contiguously, so every element must shift one position right to make room.' },
      { q: 'What structure would you use for "undo"?', a: 'A stack (LIFO) — the most recent action must be undone first.' },
    ],
  },

  /* ====================================================== MATHEMATICS === */
  {
    id: 'math-1',
    subjectId: 'mathematics',
    title: 'Discrete Mathematics: Logic, Sets and Proofs',
    summary: 'Predicates, quantifiers and how to write a proof that actually holds.',
    minutes: 15,
    topics: ['Discrete Maths', 'Logic'],
    sections: [
      {
        h: 'Propositions and truth tables',
        b: `A **proposition** is a statement that is unambiguously either true or false. "The moon is made of cheese" is a proposition (false). "This sentence is interesting" is not.

Connectives: \`AND\` (∧), \`OR\` (∨), \`NOT\` (¬), \`XOR\` (⊕), implication (→), biconditional (↔).

The key identity to memorise: **De Morgan's laws**
\`\`\`
¬(A ∧ B) = ¬A ∨ ¬B
¬(A ∨ B) = ¬A ∧ ¬B
\`\`\`
"Not (A and B)" means "not A or not B" — at least one of them failed.`,
      },
      {
        h: 'Quantifiers',
        b: `- **∀ (for all)** — every element satisfies it.
- **∃ (there exists)** — at least one element satisfies it.

The most common reasoning bug in computing:
\`\`\`
∀x ∃y  ≠  ∃y ∀x
\`\`\`
"For every x there is some y" allows a *different* y for each x. "There is one y that works for every x" does not.`,
      },
      {
        h: 'Writing a proof',
        b: `The universal recipe:
1. **Restate** what you are proving.
2. **Assume the opposite** (proof by contradiction).
3. Derive a **contradiction** using definitions and known results.
4. Therefore the assumption was false, and the claim holds.

Always define your terms and cite the definition you are using. A proof that skips steps is not a proof.`,
      },
    ],
    keyPoints: [
      "De Morgan: ¬(A ∧ B) = ¬A ∨ ¬B, and ¬(A ∨ B) = ¬A ∧ ¬B.",
      '∀x ∃y and ∃y ∀x are different statements.',
      'Proof by contradiction: assume the negation, derive an impossibility.',
      'Definitions are the toolbox — name the one you are using at each step.',
    ],
    examples: [
      {
        title: 'Proving the square of an even number is even (by contradiction)',
        lang: 'text',
        code: `Claim: if n is even then n² is even.
1. Assume n is even AND n² is odd.
2. n even  =>  n = 2k for some integer k.
3. n² = 4k² = 2·(2k²)
4. So n² is a multiple of 2  =>  n² is even.
5. This contradicts "n² is odd".
Therefore: n even => n² even.`,
        explain: 'Step 3 is the whole argument: 4k² is 2 times an integer, so it is even by definition.',
      },
    ],
    practice: [
      { q: 'Write ¬(P ∨ Q) using only AND and NOT.', a: '¬P ∧ ¬Q — this is De Morgan’s second law.' },
      { q: 'What is wrong with "n is even iff n is divisible by 4"?', a: 'The "only if" direction is false: 2 is even but not divisible by 4. The correct biconditional is "n is even iff n is divisible by 2".' },
    ],
  },
  {
    id: 'math-2',
    subjectId: 'mathematics',
    title: 'Probability: The Rules That Actually Matter',
    summary: 'Conditional probability, Bayes, independence and expected value.',
    minutes: 16,
    topics: ['Probability', 'Statistics'],
    sections: [
      {
        h: 'The foundation',
        b: `**P(A)** = probability event A occurs, 0 ≤ P(A) ≤ 1.

**Addition rule (OR):** P(A ∪ B) = P(A) + P(B) − P(A ∩ B)
The subtraction matters: the overlap was counted twice.

**Multiplication rule (AND):** P(A ∩ B) = P(A) · P(B | A) — *only when independent* does this simplify to P(A)·P(B).`,
      },
      {
        h: 'Conditional probability and Bayes',
        b: `\`P(A | B) = P(A ∩ B) / P(B)\` — "given B, how likely is A".

**Bayes' theorem** flips the condition, which is exactly what you want for diagnosis and spam filtering:

\`P(disease | symptom) = P(symptom | disease) · P(disease) / P(symptom)\`

The classic trap: P(symptom | disease) is easy to measure, but what people actually ask is P(disease | symptom) — usually much smaller.`,
      },
      {
        h: 'Independence',
        b: `A and B are **independent** when P(A ∩ B) = P(A)·P(B); knowledge of A gives you no information about B.

A famous example: two fair coins. The chance of both heads on the **second** toss is still 1/4 regardless of the first — the first toss gives no information. The chance both are heads on **one** toss is 1/2.

Independence is an assumption you test, not a fact you assume.`,
      },
      {
        h: 'Expected value',
        b: `E[X] = Σ x · P(x)

The long-run average of many trials. It is the single most useful idea in probability: use it to compare options.
EV of a fair die = 3.5. EV of a biased die with P(6) = 0.3 is much higher — even if you win less often.`,
      },
    ],
    keyPoints: [
      'P(A ∪ B) subtracts the overlap once.',
      'Independence is required to simplify P(A ∩ B) into P(A)·P(B).',
      'Bayes reverses the condition: P(cause | effect) from P(effect | cause).',
      'Expected value is a long-run average, not a prediction of one trial.',
    ],
    examples: [
      {
        title: 'Bayes: a test with a 1% disease rate and a 99% accurate test',
        lang: 'text',
        code: `P(D)=0.01   P(neg|D)=0.01   P(neg|no D)=0.99
P(no D) = 0.99

P(D | neg) = (0.01 × 0.01) / (0.01×0.01 + 0.99×0.99)
          = 0.0001 / (0.0001 + 0.9801)
          ≈ 0.000102  ≈ 0.01%

A positive-looking negative result means a ~0.01% chance of disease.
The base rate dominates when the condition is rare.`,
        explain: 'The classic "base rate neglect" result: even a very accurate test is uninformative when the condition is rare.',
      },
    ],
    practice: [
      { q: 'Are two coin flips independent?', a: 'Yes. The outcome of one flip gives no information about the other, so P(H1 ∧ H2) = 0.5 × 0.5 = 0.25.' },
      { q: 'A 60% accurate test for a 1-in-1000 condition. Roughly what is P(ill | positive)?', a: 'About 0.06 — far below 60%, because the base rate is so tiny. A positive result is mostly a false positive.' },
    ],
  },
  {
    id: 'math-3',
    subjectId: 'mathematics',
    title: 'Limits, Derivatives and Big-O Calculus',
    summary: 'The calculus you actually need, and how it connects to complexity.',
    minutes: 14,
    topics: ['Calculus', 'Complexity'],
    sections: [
      {
        h: 'The limit',
        b: `\`lim(x→a) f(x) = L\` means: as x gets arbitrarily close to a, f(x) gets arbitrarily close to L.

The idea that unlocks calculus: **approximate locally, integrate globally**. Smooth functions behave linearly over small intervals, so you can break a hard problem into easy tiny pieces.`,
      },
      {
        h: 'The derivative',
        b: `\`f'(a) = lim(h→0) [f(a+h) − f(a)] / h\` — the limit of the slope of the secant line as the second point slides onto the first.

Interpretation: **instantaneous rate of change**. \`f'(t)\` is velocity, \`f''(t)\` is acceleration, and the derivative of \`f(x)=x²\` at x=3 (a cost function) is the marginal cost of one more unit.

A function that grows exponentially is *convex* — its slope keeps increasing, which is why "a little more each day" beats "a lot once" for most learning curves.`,
      },
      {
        h: 'Why this matters for algorithms',
        b: `Repeatedly halving a problem: \`T(n) = T(n/2) + c\`. Unrolling it gives \`T(n) = c·log₂n + d\`. That logarithm is exactly where **O(log n)** comes from.

Repeatedly halving the work: \`T(n) = 2T(n/2) + c\` → \`T(n) = c·n\` → **O(n)**.

Repeatedly doing *two* recursive calls on \`n−1\`: \`T(n) = 2T(n−1)\` → \`2ⁿ\` → **O(2ⁿ)**, which is why naive recursion blows up.`,
      },
    ],
    keyPoints: [
      'A derivative is a limit of slopes: instantaneous rate of change.',
      'Convex growth (accelerating) is why compounding small daily habits wins.',
      'T(n) = T(n/2) + c gives O(log n) — the halving pattern.',
      'T(n) = 2·T(n−1) gives O(2ⁿ) — never do this.',
    ],
    examples: [
      {
        title: 'Why daily practice beats cramming (convexity)',
        lang: 'text',
        code: `Study 1 hour/day for 10 days  = 10 hours, spaced
Study 10 hours on day 10       = 10 hours, massed

Retention is not linear in time:
  spaced  -> retention ≈ 90% after 1 month
  massed  -> retention ≈ 20% after 1 month

The curve f(t) is convex, so f(10) > 10·f(1).`,
        explain: 'Because the forgetting curve is convex (slope steepens), spreading the same total time across more sessions yields far more retained knowledge.',
      },
    ],
    practice: [
      { q: 'What recurrence gives O(log n)?', a: 'T(n) = T(n/2) + c — the problem halves each step, so after k steps n/2ᵏ = 1, i.e. k = log₂n.' },
      { q: 'What does f\'(t) represent for a cost function f?', a: 'The marginal cost — how much one additional unit costs at time t.' },
    ],
  },

  /* ================================================== CYBER SECURITY === */
  {
    id: 'sec-1',
    subjectId: 'cyber-security',
    title: 'The CIA Triad and Thinking Like an Attacker',
    summary: 'Confidentiality, integrity, availability — and the attack surface.',
    minutes: 13,
    topics: ['CIA Triad', 'Threat Modelling'],
    sections: [
      {
        h: 'The three goals',
        b: `- **Confidentiality** — only the right people can read it. Broken by: eavesdropping, leaks, weak access control.
- **Integrity** — the data is correct and unaltered. Broken by: tampering, MitM, unverified updates.
- **Availability** — the system is there when you need it. Broken by: DDoS, ransomware, resource exhaustion.

Most real incidents hit more than one. A ransomware attack steals data (confidentiality) *and* locks you out (availability).`,
      },
      {
        h: 'Threat model: STRIDE',
        b: `For each entry point ask six questions:
- **S**poofing — can someone pretend to be a user?
- **T**ampering — can data be modified in transit or at rest?
- **R**epudiation — can a user deny an action you cannot prove?
- **I**nformation disclosure — can data leak (errors, logs, backups)?
- **D**enial of service — can it be made unavailable?
- **E**levation of privilege — can a normal user gain admin rights?`,
      },
      {
        h: 'Trust boundaries and the principle of least privilege',
        b: `A **trust boundary** is any line where data moves from a lower-trust context to a higher-trust one (user → server, server → database, server → third-party API). Every boundary is a place to validate.

**Least privilege**: every account, key and process gets only the permissions it needs, for only as long as it needs them. Most breaches are not "impossible" attacks — they are a low-privilege account that should never have had admin.`,
      },
    ],
    keyPoints: [
      'CIA = Confidentiality, Integrity, Availability.',
      'STRIDE: Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation.',
      'Validate every input that crosses a trust boundary.',
      'Least privilege limits the blast radius of any single compromise.',
    ],
    examples: [
      {
        title: 'Least privilege, concretely',
        lang: 'text',
        code: `BAD  : app connects to DB as a superuser.
       One SQL injection = full database wipe.

GOOD : app uses a role with:
         SELECT, INSERT on public.orders
         (no DROP, no access to users table)
       One injection = leaked orders, nothing more.`,
        explain: 'Same vulnerability, very different blast radius. Least privilege is the cheapest security control there is.',
      },
    ],
    practice: [
      { q: 'Which CIA property does a DDoS attack break?', a: 'Availability — the service is flooded and cannot serve legitimate users.' },
      { q: 'A user can change their own role to admin via an unprotected API. Which STRIDE category?', a: 'Elevation of privilege, and probably also tampering and repudiation. The fix is server-side authorisation checks on every privileged route.' },
    ],
  },
  {
    id: 'sec-2',
    subjectId: 'cyber-security',
    title: 'Cryptography That You Actually Need',
    summary: 'Hashing, symmetric vs asymmetric, TLS, and why "encrypted" is not "safe".',
    minutes: 16,
    topics: ['Cryptography', 'Authentication'],
    sections: [
      {
        h: 'Hashing — integrity, not secrecy',
        b: `A hash function (SHA-256, Bcrypt for passwords) maps any input to a fixed-length fingerprint.

Properties:
- **Deterministic** — same input, same output.
- **One-way** — you cannot reverse it.
- **Avalanche effect** — flip one bit, half the output changes.
- **Collision resistant** — finding two inputs with the same hash is infeasible.

**Never store passwords as plain hashes.** Fast hashes like SHA-256 can be brute-forced at billions per second. Password storage needs a *slow* algorithm: **Argon2id, bcrypt or scrypt**, with a unique salt per user.`,
      },
      {
        h: 'Symmetric vs asymmetric',
        b: `**Symmetric** (AES): one shared secret encrypts and decrypts. Fast. Problem: how do you safely share the key?

**Asymmetric** (RSA, ECDSA, Ed25519): a key pair — a *public* key you can publish and a *private* key you keep. Anything encrypted with the public key can only be decrypted with the private key, and vice versa.

Asymmetric is slow, so real systems use **hybrid** encryption:
1. Generate a fast random **session key** (AES).
2. Encrypt the data with the session key.
3. Encrypt the session key with the recipient's public key.
4. Send both. Only the private-key holder can recover the session key.`,
      },
      {
        h: 'Signatures, certificates and TLS',
        b: `A **digital signature** is the reverse use: sign with your *private* key, verify with your *public* key. This proves authorship and integrity, and gives non-repudiation.

**TLS** (what turns the padlock on) is that whole chain:
1. **Asymmetric** handshake proves the server owns the private key for its domain.
2. A **certificate authority** vouches that the domain belongs to that key.
3. Both sides then switch to a fast **symmetric** session key for the actual data.`,
      },
      {
        h: 'Why encryption alone is not safety',
        b: `Encrypted data can still be **replayed** on the server, **tampered with** if you do not verify signatures or MACs, or **leaked through metadata** (size, timing, endpoint). That is why you need:
- **AEAD** (AES-GCM / ChaCha20-Poly1305) — encryption *and* integrity in one operation.
- **Nonces/IVs that never repeat** with the same key — reuse breaks GCM badly.
- **Authenticity checks** before you act on data.`,
      },
    ],
    keyPoints: [
      'Hashes guarantee integrity; they give no confidentiality.',
      'Passwords need slow KDFs (Argon2id/bcrypt/scrypt) plus a per-user salt.',
      'Hybrid encryption = fast symmetric data + asymmetric key exchange.',
      'Use AEAD (AES-GCM) and never repeat a nonce with the same key.',
    ],
    examples: [
      {
        title: 'Hashing a password correctly vs incorrectly',
        lang: 'text',
        code: `WRONG
  hash = sha256(password)                       // rainbow-tableable, no salt

ALSO WRONG
  hash = sha256(salt + password)                // still ~10^10 guesses/sec on a GPU

RIGHT
  hash = argon2id(password, salt=random16bytes,
                  time=3, memory=64MB, parallelism=4)
  // store: algorithm, params, salt, hash
  // verify: re-derive with the stored salt and params`,
        explain: 'Argon2id is deliberately expensive in memory and time, so guessing becomes far more costly for an attacker than for a legitimate login.',
      },
    ],
    practice: [
      { q: 'Why is SHA-256 a bad choice for storing passwords?', a: 'It is designed to be fast, so an attacker with a GPU can try billions of candidates per second. Use a slow, memory-hard KDF like Argon2id or bcrypt.' },
      { q: 'What does a digital signature prove?', a: 'That the message came from the holder of the private key and has not been modified — i.e. authenticity and integrity.' },
    ],
  },
  {
    id: 'sec-3',
    subjectId: 'cyber-security',
    title: 'Common Web Attacks and How to Defend Against Them',
    summary: 'Injection, XSS, CSRF, SSRF, broken access control — with real defences.',
    minutes: 17,
    topics: ['Web Attacks', 'Defence', 'Authentication'],
    sections: [
      {
        h: 'Injection (SQL, command, template)',
        b: `Root cause: **untrusted data is concatenated into code** that an interpreter then runs.

\`\`\`javascript
// VULNERABLE
db.query("SELECT * FROM users WHERE id = " + req.params.id);
// id = 1 OR 1=1  ->  returns every user
\`\`\`

The fix is not escaping — it is **parameterisation**. The value travels as data, never as code:

\`\`\`javascript
db.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
\`\`\`

OS command injection works the same way: never pass user input to \`exec\`/\`system\`. Use \`execFile\` with an argument array.`,
      },
      {
        h: 'Cross-Site Scripting (XSS)',
        b: `Attacker JavaScript runs **in your user's session**. Three flavours:

- **Stored** — saved in your database, served to everyone.
- **Reflected** — bounced through a URL parameter.
- **DOM-based** — injected by client-side JS reading \`location\`/\`document.referrer\`.

Defences: escape on output (React does this by default; never use \`dangerouslySetInnerHTML\` on user data), apply a **Content-Security-Policy** header, and set \`HttpOnly\` + \`Secure\` + \`SameSite\` on cookies.

For rich user text, sanitise with a library (DOMPurify) instead of hand-rolling.`,
      },
      {
        h: 'CSRF and SSRF',
        b: `**CSRF** abuses the fact that browsers *automatically* attach cookies. The attacker hosts a page that makes your browser POST to your bank.

Defence: **SameSite=Lax/Strict** cookies, anti-CSRF tokens, and never performing state changes on GET.

**SSRF** tricks your *server* into fetching an internal URL:

\`\`\`
GET /avatar?url=http://169.254.169.254/latest/meta-data/
\`\`\`

Defence: allow-list destinations, resolve the DNS name and reject private IP ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16), and disable redirects.`,
      },
      {
        h: 'Broken access control (the number one real-world flaw)',
        b: `It is not about exotic cryptography. It is about **missing server-side authorisation**:

\`\`\`
GET /api/invoices/1042      // returns someone else's invoice
\`\`\`

The client hid the button. The API never checked. Every request must be authorised on the server, and the safest test is: *if I change the ID in the URL, do I get someone else's data?* If yes, it is broken.

Defence in depth: server-side checks on every request, deny by default, and log access for auditing.`,
      },
    ],
    keyPoints: [
      'Fix injection with parameterisation, not string escaping.',
      'Defend XSS with output escaping + CSP + HttpOnly cookies.',
      'CSRF → SameSite cookies and anti-CSRF tokens. SSRF → allow-list + block private IPs.',
      'Authorise every request server-side; hiding a button is not access control.',
    ],
    examples: [
      {
        title: 'The one question that finds most web vulns',
        lang: 'text',
        code: `Log in as User A.
Open DevTools -> Network.
Change the ID in the URL or request body to User B's.

If you see User B's data  ->  broken access control (IDOR)
If the page renders <b>  ->  reflected XSS
If the SQL error appears  ->  error-based injection
If nothing changes       ->  looks fine, verify server-side logs`,
        explain: 'Every successful check is one attacker step. This is the fastest manual security test that exists.',
      },
    ],
    practice: [
      { q: 'Is HTML-escaping enough to stop SQL injection?', a: 'No. Escaping is fragile and context-dependent. Parameterised queries keep data in the data channel and are the correct fix.' },
      { q: 'Why do we need SameSite cookies?', a: 'Browsers attach cookies automatically to cross-site requests, which is what makes CSRF possible. SameSite blocks that attachment for cross-site calls.' },
    ],
  },

  /* =================================================== WEB DEVELOPMENT === */
  {
    id: 'web-1',
    subjectId: 'web-development',
    title: 'How the Web Actually Works',
    summary: 'DNS, HTTP, the request/response cycle, and what a server really does.',
    minutes: 13,
    topics: ['HTTP & APIs', 'Networking'],
    sections: [
      {
        h: 'The request lifecycle',
        b: `1. **DNS** — the hostname is resolved to an IP address.
2. **TCP (+TLS)** — a connection is opened, then encrypted (the padlock).
3. **HTTP request** — \`GET /about HTTP/1.1\` plus headers and an optional body.
4. **HTTP response** — a status code, headers, and a body.

\`\`\`
GET /api/quizzes HTTP/1.1
Host: example.com
Accept: application/json
Authorization: Bearer <token>
\`\`\`
\`\`\`
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store
\`\`\``,
      },
      {
        h: 'Status codes you must know',
        b: `- **2xx** — 200 OK, 201 Created, 204 No Content
- **3xx** — 301 Moved Permanently, 302 Found, 304 Not Modified (cache hit)
- **4xx** — the *client* is wrong: 400 Bad Request, 401 Unauthorized (not logged in), 403 Forbidden (logged in but not allowed), 404 Not Found, 409 Conflict, 429 Too Many Requests
- **5xx** — the *server* is wrong: 500 Internal Server Error, 502 Bad Gateway, 503 Unavailable, 504 Gateway Timeout

**401 vs 403 is the classic interview question:** 401 = "who are you?", 403 = "I know who you are, and still no."`,
      },
      {
        h: 'State: the honest options',
        b: `HTTP is **stateless** — each request stands alone. Session state has to be added:

- **Cookies** — the server sets \`Set-Cookie\`, the browser sends it back. \`HttpOnly\` (no JS access), \`Secure\` (HTTPS only), \`SameSite\` (CSRF defence).
- **JWT** — a signed token the client stores and sends in \`Authorization: Bearer\`. Stateless and scalable, but **cannot be revoked** before it expires, and a bigger mistake is a vulnerability.
- **Server sessions** — an ID in a cookie, state on the server. Easy to revoke.

Rule of thumb: opaque session cookies for browser apps; short-lived access tokens for APIs.`,
      },
    ],
    keyPoints: [
      'DNS → TCP → TLS → HTTP request → response.',
      '401 = not authenticated, 403 = authenticated but not allowed.',
      'Cookies should be HttpOnly + Secure + SameSite.',
      'JWTs are stateless but not revocable before expiry — keep them short-lived.',
    ],
    examples: [
      {
        title: 'REST conventions that keep backends predictable',
        lang: 'text',
        code: `POST   /api/quizzes        create       -> 201 + Location header
GET    /api/quizzes        list          -> 200
GET    /api/quizzes/:id    read one      -> 200 / 404
PATCH  /api/quizzes/:id    partial edit  -> 200
DELETE /api/quizzes/:id    delete        -> 204
GET    /api/quizzes        ?subject=ai&limit=10   -> paginated list`,
        explain: 'Consistent verbs + nouns mean clients can be written without reading the docs each time.',
      },
    ],
    practice: [
      { q: 'User is logged in but not allowed to delete a file. Which status?', a: '403 Forbidden. Use 401 only when the user is not authenticated at all.' },
      { q: 'Why mark cookies HttpOnly?', a: 'It stops JavaScript from reading them, which limits the damage of any XSS bug — the attacker cannot steal the session cookie directly.' },
    ],
  },
  {
    id: 'web-2',
    subjectId: 'web-development',
    title: 'Semantic HTML, Modern CSS and the Box Model',
    summary: 'Flexbox, Grid, the cascade, and writing CSS that survives.',
    minutes: 15,
    topics: ['HTML', 'CSS', 'Accessibility'],
    sections: [
      {
        h: 'Semantics are not decoration',
        b: `Use the element whose *meaning* matches: \`<article>\`, \`<nav>\`, \`<main>\`, \`<header>\`, \`<footer>\`, \`<button>\`, \`<h1>\`–\`<h6>\`.

You get three things for free:
- **Accessibility** — screen readers navigate by landmark and heading.
- **SEO** — crawlers understand structure.
- **Default behaviour** — \`<button>\` is keyboard focusable and fires on Enter/Space; a \`<div>\` does neither unless you rebuild it.

Always give images \`alt\` (empty \`alt=""\` for decorative ones) and label every input.`,
      },
      {
        h: 'The box model',
        b: `Every element is a box:
\`\`\`
content → padding → border → margin
\`\`\`
\`box-sizing: border-box\` (which this project sets globally) makes \`width\` include padding and border — far easier to reason about.

**One weird trick**: \`margin\` collapses between adjacent block elements, so two \`margin: 20px\` blocks end up 20px apart, not 40px. Flex and Grid containers stop this from happening.`,
      },
      {
        h: 'Flexbox vs Grid',
        b: `**Flexbox** distributes space along **one axis** — a row or a column. Perfect for toolbars, nav lists, button groups.

\`\`\`css
.toolbar { display: flex; gap: 10px; align-items: center; }
.toolbar .spacer { margin-left: auto; }  /* push right */
\`\`\`

**Grid** lays out **two dimensions** at once — page structure, dashboards, card walls.

\`\`\`css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
\`\`\`

That \`auto-fill + minmax()\` pattern is the responsive grid you will use most.`,
      },
      {
        h: 'The cascade and specificity',
        b: `When styles conflict, the winner is decided by:
1. **\`!important\`** (avoid; it is a last resort, not a tool)
2. **Inline style** (\`style="..."\`)
3. **Specificity** — count ids (100) > classes (10) > elements (1)
4. **Source order** — later wins

Custom properties (\`--primary\`) and \`var()\` are the clean way to theme: change one variable, the whole design follows. That is exactly how this project implements its black + orange theme.`,
      },
    ],
    keyPoints: [
      'Semantic elements give accessibility, SEO and keyboard behaviour for free.',
      'Use `box-sizing: border-box` and remember vertical margin collapsing.',
      'Flexbox = one axis, Grid = two axes.',
      '`repeat(auto-fill, minmax(260px, 1fr))` is the responsive card grid to remember.',
    ],
    examples: [
      {
        title: 'A responsive layout that needs no media query',
        lang: 'css',
        code: `.cards {
  display: grid;
  gap: 16px;
  grid-template-columns:
    repeat(auto-fill, minmax(min(260px, 100%), 1fr));
}`,
        explain: '`min(260px, 100%)` prevents overflow on 320px screens. auto-fill adds columns while they fit, so one rule covers phone, tablet and desktop.',
      },
    ],
    practice: [
      { q: 'Why use <button> instead of a styled <div> for a click target?', a: 'It is focusable, activates on Enter and Space, announces its role to screen readers, and participates in form submission — all of which you would have to rebuild by hand.' },
      { q: 'What does minmax() buy you in a grid?', a: 'A minimum track size with the ability to grow, so columns wrap automatically instead of needing media queries.' },
    ],
  },
  {
    id: 'web-3',
    subjectId: 'web-development',
    title: 'The DOM, Events and Async JavaScript',
    summary: 'Select, create, update, delete — plus the event loop and fetch.',
    minutes: 16,
    topics: ['DOM', 'JavaScript', 'Async'],
    sections: [
      {
        h: 'The DOM is a live tree',
        b: `\`document.querySelector('.card')\` searches the tree and returns a live node reference. You can read, change, create and remove nodes:

\`\`\`javascript
el.textContent = 'Hello';        // safe text (no HTML parsing)
el.setAttribute('aria-expanded', 'true');
const node = document.createElement('div');
document.body.append(node);
node.remove();
\`\`\`

**Always prefer \`textContent\` over \`innerHTML\`** when the data came from a user — that one habit prevents most XSS.`,
      },
      {
        h: 'Events',
        b: `\`\`\`javascript
btn.addEventListener('click', (e) => {
  e.preventDefault();   // stop form submit / link navigation
  handle(e.currentTarget);
});
\`\`\`

Event **delegation** handles many children with one listener — useful for long, dynamic lists:

\`\`\`javascript
list.addEventListener('click', (e) => {
  const item = e.target.closest('[data-id]');
  if (item) open(item.dataset.id);
});
\`\`\``,
      },
      {
        h: 'The event loop — why async code works',
        b: `JavaScript runs on **one thread**. \`await\` does not block it; it *schedules* a continuation and returns control.

\`\`\`
Call stack  ->  runs your synchronous code
Web APIs     ->  timers, fetch, DOM events (run in the background)
Microtasks   ->  promise callbacks, queueMicrotask  <- highest priority
Macrotasks   ->  setTimeout, I/O  <- lowest priority
\`\`\`

**Microtasks always run before the next macrotask.** That is why a \`.then()\` chain resolves before a \`setTimeout(...,0)\`.`,
      },
      {
        h: 'fetch and error handling',
        b: `\`fetch\` only rejects on a **network** failure. A 500 response resolves normally, so you must check \`response.ok\`:

\`\`\`javascript
async function getUser(id) {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) {
    throw new Error(\`Request failed: \${res.status}\`);
  }
  return res.json();          // rejects on invalid JSON too
}
\`\`\`

Always attach a \`.catch()\` at the top level, disable the button while the request is in flight (blocks double submits), and show a friendly message instead of an empty screen.`,
      },
    ],
    keyPoints: [
      'Prefer `textContent` to `innerHTML` for anything user-supplied.',
      'Event delegation = one listener for a dynamic list.',
      'Microtasks (promises) run before macrotasks (timers).',
      '`fetch` does not reject on HTTP errors — check `res.ok` yourself.',
    ],
    examples: [
      {
        title: 'Robust fetch wrapper',
        lang: 'javascript',
        code: `async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || \`Request failed (\${res.status})\`);
  }
  return res.status === 204 ? null : res.json();
}`,
        explain: 'One place for error handling means no request can silently fail, and the UI can show the server\'s real message.',
      },
    ],
    practice: [
      { q: 'Your `await fetch("/api/x")` returns a 404 page without throwing. Why?', a: 'fetch only rejects on network-level failure. HTTP error statuses are normal responses — you must check `res.ok` or `res.status`.' },
      { q: 'Why disable the submit button while a request runs?', a: 'It prevents double submits, which would create duplicate records, and gives the user clear feedback that something is happening.' },
    ],
  },

  /* ===================================================== DATA SCIENCE === */
  {
    id: 'ds-1',
    subjectId: 'data-science',
    title: 'Data Cleaning: 80% of the work',
    summary: 'Missing values, duplicates, outliers, and honest data types.',
    minutes: 14,
    topics: ['Data Cleaning', 'Pandas'],
    sections: [
      {
        h: 'The pipeline',
        b: `\`\`\`
1. Load
2. Inspect  (shape, dtypes, head, describe, null counts)
3. Clean   (types, missing values, duplicates, outliers)
4. Transform (features, encoding, scaling)
5. Analyse / model
6. Validate + report
\`\`\`

Skipping step 3 is the single most common cause of a wrong answer that looked perfectly reasonable.`,
      },
      {
        h: 'Missing values: know why before you fill',
        b: `\`\`\`python
df.isna().sum()                 # how many
df.info()                       # dtypes + non-null counts
df["score"].fillna(df["score"].median())   # numeric -> median
df["city"].fillna("Unknown")               # categorical -> explicit label
df.dropna(subset=["email"])               # drop only if the row is useless
\`\`\`

**Deciding matters:**
- **MCAR** (random) — dropping is safe.
- **MAR** (depends on other columns) — impute using those columns.
- **MNAR** (depends on the missing value itself) — imputation will bias results; investigate.

Never impute a *target* variable in a way that leaks the answer.`,
      },
      {
        h: 'Outliers and duplicates',
        b: `\`\`\`python
df.drop_duplicates(subset=["email"], keep="first")
q1, q3 = df["salary"].quantile([0.25, 0.75])
iqr = q3 - q1
df = df[(df["salary"] >= q1 - 1.5*iqr) & (df["salary"] <= q3 + 1.5*iqr)]
\`\`\`

Use the **IQR rule** (1.5×IQR fences) rather than "delete anything above 3σ" — the Gaussian assumption rarely holds for real-world money or height data.

An outlier is not automatically an error. A ₹90,000 salary may be perfectly real and extremely informative.`,
      },
    ],
    keyPoints: [
      'Inspect before you clean: shape, dtypes, nulls, duplicates.',
      'Choose an imputation strategy based on *why* data is missing (MCAR/MAR/MNAR).',
      'IQR fences are more robust than 3σ for real-world data.',
      'An outlier can be genuine signal — investigate, never blindly delete.',
    ],
    examples: [
      {
        title: 'The five-minute audit',
        lang: 'python',
        code: `df.shape          # rows, columns
df.dtypes         # is anything a string that should be numeric?
df.isna().mean()  # % missing per column
df.describe()     # spread + immediate outlier clues
df.duplicated().sum()
df.nunique()      # 1 unique value = probably a useless column`,
        explain: 'This is the checklist to run on any new dataset before writing a single line of analysis.',
      },
    ],
    practice: [
      { q: 'A column named "age" is loaded as text. What is the likely cause?', a: 'Values like "twenty" or "N/A" prevent type inference, or the CSV has mixed types. Coerce with pd.to_numeric(..., errors="coerce").' },
      { q: 'When is dropping missing rows safer than imputing?', a: 'When the missingness is random (MCAR) and the rows are a small fraction of the data, so you are not introducing bias.' },
    ],
  },
  {
    id: 'ds-2',
    subjectId: 'data-science',
    title: 'Statistics You Need to Trust a Result',
    summary: 'Distributions, correlation vs causation, sampling, and significance.',
    minutes: 15,
    topics: ['Statistics', 'Model Evaluation'],
    sections: [
      {
        h: 'Central tendency and spread',
        b: `- **Mean** — sensitive to outliers.
- **Median** — robust; use for skewed data like income.
- **Mode** — the most frequent value.
- **Standard deviation** — typical distance from the mean. Compare it *within* a group, never across different scales.
- **IQR** — spread of the middle 50%, outlier-resistant.`,
      },
      {
        h: 'Correlation is not causation',
        b: `Pearson correlation \`r\` runs from −1 to +1 and only captures **linear** relationships. A perfect **U-shape** (y = x²) has r ≈ 0.

Three ways correlation lies:
1. **Confounder** — ice cream sales correlate with drownings because of summer, not each other.
2. **Coincidence** — in a large enough dataset, random patterns appear (scan the data, you will find them).
3. **Selection bias** — the sample is not representative of the population you care about.

Correlation needs a **mechanism** to become causation.`,
      },
      {
        h: 'Sampling and significance',
        b: `**Sampling bias** is the number one threat to validity. Ways to get a representative sample: random sampling, stratified sampling (ensure proportions per group), and adequate sample size.

**p < 0.05** means: *if the null hypothesis were true, a result this extreme would occur less than 5% of the time by chance*. It does **not** mean there is a 5% chance you are wrong, and it says nothing about effect size or usefulness.

Always report: effect size, confidence interval, and sample size — not just \`p < 0.05\`.`,
      },
    ],
    keyPoints: [
      'Use median and IQR for skewed data; mean and std for symmetric data.',
      'Pearson r only detects linear relationships.',
      'Correlation implies causation only with a mechanism.',
      'p-value ≠ probability you are wrong. Report effect size and CI too.',
    ],
    examples: [
      {
        title: 'Correlation ≠ causation: the ice-cream example',
        lang: 'text',
        code: `ice_cream_sales  ~  0.92  with  drowning_deaths

The real relationship:
  summer temperature
        |-> ice cream sales
        |-> swimming         -> drowning

Season is the confounder. Neither variable causes the other.`,
        explain: 'Whenever you find a strong correlation, ask "what third variable could produce both?" before writing a conclusion.',
      },
    ],
    practice: [
      { q: 'A model reports p = 0.001 on a sample of 12. What should worry you?', a: 'A tiny sample is fragile: one or two unusual points can flip the result. p-values from small n are not trustworthy — check the confidence interval.' },
      { q: 'Does a correlation of 0 mean two variables are unrelated?', a: 'No. It only means there is no linear relationship. A perfect U-shape (y = x²) correlates at about 0.' },
    ],
  },
  {
    id: 'ds-3',
    subjectId: 'data-science',
    title: 'Machine Learning Fundamentals and Honest Evaluation',
    summary: 'Supervised vs unsupervised, overfitting, and splitting your data correctly.',
    minutes: 17,
    topics: ['Machine Learning', 'Model Evaluation'],
    sections: [
      {
        h: 'The paradigms',
        b: `- **Supervised** — labelled data → learn a mapping. Classification (discrete label) or regression (continuous value).
- **Unsupervised** — no labels → find structure. Clustering, dimensionality reduction.
- **Reinforcement** — learn from rewards by interaction.

The bias-variance trade-off is the core idea: a model that is too simple **underfits** (high bias), one that memorises the training set **overfits** (high variance). The best model sits in between.`,
      },
      {
        h: 'Train / validation / test',
        b: `\`\`\`
80%  train     -> learn the parameters
10%  validation -> tune hyper-parameters & choose features
10%  test       -> touched ONCE, at the very end
\`\`\`

**The test set is used exactly once.** Every time you look at test performance and then change something, that test set has leaked into training and your reported number is optimistic.

For time-series data, never random-split: **split by time** (train on the past, test on the future) or you leak the future into the past.`,
      },
      {
        h: 'Metrics that match the question',
        b: `\`\`\`
Accuracy  = (TP+TN)/all        <- misleading on imbalanced data
Precision = TP / (TP+FP)       "of what we flagged, how many were right?"
Recall    = TP / (TP+FN)       "of the real cases, how many did we catch?"
F1        = harmonic mean of precision & recall
AUC-ROC   = ranking quality across all thresholds
\`\`\`

With 1% positives, "always predict negative" scores 99% accuracy and is useless. **Always check the confusion matrix and per-class metrics.**

Watch for **data leakage** too: a feature computed from information unavailable at prediction time will make any model look brilliant and fail in production.`,
      },
    ],
    keyPoints: [
      'Underfit = high bias, overfit = high variance.',
      'Test set is used once. Tuning against it is leakage.',
      'Time-series must be split by time, not randomly.',
      'Accuracy is useless on imbalanced data — use precision/recall/F1.',
    ],
    examples: [
      {
        title: 'The 1% problem',
        lang: 'text',
        code: `1,000 records. 10 are fraudulent.

Model A: always predict "not fraud"
  accuracy = 99.0%   <- looks perfect
  recall    = 0%     <- catches nothing

Model B: real classifier
  accuracy = 98.5%
  recall    = 80%    <- actually useful`,
        explain: 'Pick the metric that reflects the cost of each error type. Missing a fraud case usually costs far more than a false alarm.',
      },
    ],
    practice: [
      { q: 'Why must time-series data be split by time?', a: 'A random split lets the model train on future points to predict past points, which leaks information and produces unrealistic accuracy.' },
      { q: 'Your accuracy dropped from 96% to 90% after adding features. What likely happened?', a: 'Overfitting — the extra features fit noise in the training set. Try feature selection, more data, or stronger regularisation.' },
    ],
  },

  /* ============================================= ARTIFICIAL INTELLIGENCE */
  {
    id: 'ai-1',
    subjectId: 'ai',
    title: 'Search: The Foundation of Reasoning Systems',
    summary: 'Uninformed, informed, A*, and minimax — the algorithms behind game AI.',
    minutes: 15,
    topics: ['Search', 'Algorithms', 'AI Ethics'],
    sections: [
      {
        h: 'Uninformed search',
        b: `Explore the state space blindly and count nodes.

- **BFS** (breadth-first) — explores by depth. **Complete and optimal** when all step costs are equal. Memory-heavy.
- **DFS** (depth-first) — dives deep. Cheap on memory, can go forever down a bad branch. Use with a depth limit (then it becomes **depth-limited search**).

Both are *complete* if the space is finite. Neither is any use on big problems without a heuristic.`,
      },
      {
        h: 'Informed search',
        b: `A **heuristic** h(n) estimates the remaining cost to the goal. It must be **admissible**: it never overestimates.

- **Greedy best-first** — always expand the node with the smallest h. Fast, but not optimal.
- **A\*** — expand the node with the smallest \`f(n) = g(n) + h(n)\`, where g is cost so far and h is estimated cost remaining. With an admissible, consistent heuristic, A* is **complete and optimal**.

\`\`\`
f(n) = cost-so-far(n) + estimated-remaining-cost(n)
\`\`\`

This one line is the whole idea. It is a guess at the total journey, not just the tail.`,
      },
      {
        h: 'Adversarial search',
        b: `Two-player games need **minimax**:

\`\`\`
minimax(n) =
  utility(n)                       if n is a terminal state
  max(minimax(children))           if it is MAX's turn
  min(minimax(children))           if it is MIN's turn
\`\`\`

MAX maximises, MIN minimises, and they each assume the other plays optimally. Alpha-beta **pruning** skips branches that cannot change the final result, cutting roughly the square root of the tree.`,
      },
      {
        h: 'The cost of intelligence',
        b: `Real AI systems have costs worth stating plainly:
- **Compute & energy** — training and serving large models consume significant resources.
- **Bias** — models learn the biases present in their training data and can amplify them.
- **Opacity** — a model that cannot explain itself is hard to audit or contest.
- **Misuse** — the same capability that personalises learning can generate misinformation.

Responsible AI means measuring these, disclosing them, and keeping a human accountable for decisions.`,
      },
    ],
    keyPoints: [
      'BFS is complete and optimal with equal step costs; DFS is memory-cheap.',
      'A* uses f(n) = g(n) + h(n) and is optimal with an admissible heuristic.',
      'Minimax assumes both players act optimally; alpha-beta prunes the rest.',
      'Compute, bias, opacity and misuse are real costs — disclose them.',
    ],
    examples: [
      {
        title: 'A* versus greedy: a 15-puzzle style grid',
        lang: 'python',
        code: `import heapq
def astar(start, goal, h):
    open_set = [(h(start), 0, start)]
    came_from, g_score = {}, {start: 0}
    while open_set:
        _, cost, cur = heapq.pop(open_set)
        if cur == goal:
            return cost
        for nxt in neighbours(cur):
            new_cost = cost + step(cur, nxt)
            if new_cost < g_score.get(nxt, float("inf")):
                g_score[nxt] = new_cost
                f = new_cost + h(nxt)
                heapq.heappush(open_set, (f, new_cost, nxt))
                came_from[nxt] = cur
    return None`,
        explain: 'Swap `f = new_cost + h(nxt)` for `f = h(nxt)` and you have greedy best-first: much faster, often wrong.',
      },
    ],
    practice: [
      { q: 'Why can a greedy best-first search return a suboptimal path?', a: 'It only considers the estimated remaining cost h, ignoring the cost already paid g, so it can commit to an expensive dead-end.' },
      { q: 'What does it mean for a heuristic to be admissible?', a: 'It never overestimates the true remaining cost to the goal. That guarantees A* finds an optimal path.' },
    ],
  },
  {
    id: 'ai-2',
    subjectId: 'ai',
    title: 'Neural Networks and How Transformers Work',
    summary: 'Perceptrons, backpropagation, attention — how modern AI actually learns.',
    minutes: 18,
    topics: ['Neural Networks', 'Transformers', 'Machine Learning'],
    sections: [
      {
        h: 'From perceptron to layer',
        b: `A single **neuron** computes \`activation · weights + bias\`, then passes it through an **activation function**.

\`\`\`
a = σ(w·x + b)
σ : ReLU (hidden), sigmoid/softmax (output probabilities)
\`\`\`

Activation functions matter because without them, stacking layers is still just one linear transform — you could not model anything non-linear.`,
      },
      {
        h: 'Forward pass and backpropagation',
        b: `**Forward**: push input through the layers to get a prediction.
**Loss**: measure the error (e.g. cross-entropy).
**Backpropagation**: apply the chain rule backwards to get the gradient of the loss w.r.t. every weight.
**Update**: \`w -= learning_rate · gradient\` (gradient descent).

The chain rule is the entire trick: \`∂L/∂w = ∂L/∂output × ∂output/∂w\`, applied layer by layer. That is why layer order matters — you propagate from the loss backwards.`,
      },
      {
        h: 'Attention — the transformer core',
        b: `Attention lets every token look at every other token and decide how much each one matters.

\`\`\`
Attention(Q,K,V) = softmax( Q · Kᵀ / √d_k ) · V
                     "how do I attend"    "what I take"
\`\`\`

- **Q (query)** — what am I looking for?
- **K (key)** — what do I offer?
- **V (value)** — the actual content.

The \`√d_k\` factor stops dot products from exploding as dimensions grow, which would push softmax into flat regions with vanishing gradients.

**Multi-head attention** runs this several times in parallel with different projections, so one head can track syntax while another tracks coreference.

Because attention alone has no notion of order, **positional encodings** are added — and in modern models, **rotary position embeddings (RoPE)**, which encode relative distance.`,
      },
      {
        h: 'What this means for you as a user',
        b: `A transformer predicts the next token. It is a powerful pattern-completer with a very large training corpus, not a database and not a reasoning engine.

Practical consequences:
- It does not "look up" facts — it can produce fluent text that is wrong (**hallucination**).
- It has no memory beyond the context window you give it, so long conversations need the history re-supplied.
- Temperature controls randomness; low is more factual, higher is more creative.
- Always verify important claims against a source, and use the AI to *understand* rather than to *avoid thinking*.`,
      },
    ],
    keyPoints: [
      'Activation functions provide the non-linearity that makes depth useful.',
      'Backprop = the chain rule applied backwards from the loss.',
      'Attention = softmax(Q·Kᵀ/√d_k)·V, done in parallel across many heads.',
      'LLMs predict the next token — fluent output is not the same as correct output.',
    ],
    examples: [
      {
        title: 'Self-attention for one word, conceptually',
        lang: 'text',
        code: `sentence: "The animal did not cross the street because it was too tired"

Question: what does "it" refer to?

Query  "it"   -> "animal"   : high score
            -> "street"   : medium
            -> "tired"    : high score (syntax)

Heads separate concerns:
  head 1 -> coreference (it -> animal)
  head 2 -> grammar     (tired -> it)
Together the model builds a usable interpretation.`,
        explain: 'This is why multiple heads exist: a single attention pattern rarely captures everything a sentence needs.',
      },
    ],
    practice: [
      { q: 'Why divide Q·Kᵀ by √d_k?', a: 'Dot products grow with dimension, which pushes softmax into saturated regions where gradients vanish. Dividing by √d_k keeps values in a healthy range.' },
      { q: 'Why can a language model state a fact incorrectly with total confidence?', a: 'It generates the most probable token sequence, not verified truth. Fluency and correctness are different things.' },
    ],
  },

  /* =============================================================== IoT === */
  {
    id: 'iot-1',
    subjectId: 'iot',
    title: 'Sensors, Microcontrollers and the Constraints That Shape Everything',
    summary: 'How a sensor reading becomes a cloud dashboard.',
    minutes: 14,
    topics: ['Sensors', 'Microcontrollers', 'Embedded C'],
    sections: [
      {
        h: 'The physical layer',
        b: `An IoT system is a chain: **sense → convert → decide → transmit → store → actuate**.

- **Digital** sensors (DHT22 temperature) return discrete values over I²C/SPI.
- **Analog** sensors (thermistor, LDR) output a voltage that an **ADC** converts to a number. Resolution matters: a 10-bit ADC has 1024 levels.
- **Actuators** go the other way — relays, servos, motors.

A "datasheet" is the real specification. Resolution, accuracy and error (±0.5 °C) are three different things.`,
      },
      {
        h: 'The microcontroller',
        b: `An MCU (ESP32, Arduino, RP2040) has a CPU, flash, RAM and peripherals in one chip.

**The three hard constraints:**
1. **RAM** (KB, not GB) — you cannot load a big library.
2. **Flash** — firmware size is limited.
3. **Power** — battery devices must sleep between readings.

That is why device code is simple loops, not deep abstractions.`,
      },
      {
        h: 'Sleep and duty cycle',
        b: `\`\`\`c
#include <esp_sleep.h>

void setup() {
  Serial.begin(115200);
  esp_sleep_enable_timer_wakeup(60ULL * 1000000ULL); // 60 seconds
}

void loop() {
  read_sensor_and_publish();
  esp_deep_sleep_start();   // CPU off, timer wakes us
}
\`\`\`

Deep sleep can drop current from ~80 mA to ~20 µA. A 2000 mAh battery at that rate lasts **months** instead of hours. This one concept is the difference between a demo and a deployable device.`,
      },
    ],
    keyPoints: [
      'Sensing chain: sense → convert → decide → transmit → store → actuate.',
      'RAM, flash and power are the three design constraints.',
      'Deep sleep between readings is what makes battery devices viable.',
      'Resolution, accuracy and error are different datasheet numbers.',
    ],
    examples: [
      {
        title: 'Reading an analog sensor on an ESP32',
        lang: 'cpp',
        code: `const int PIN = 34;           // ADC1_CH6, input-only
const int VREF = 3200;       // mV at full scale

void loop() {
  uint32_t total = 0;
  for (int i = 0; i < 16; i++) {          // average to cut noise
    total += analogReadMilliVolts(PIN);
    delay(5);
  }
  float mv = total / 16.0;
  float volts = mv / VREF;
  Serial.printf("raw=%.1f mV  %.3f V\\n", mv, volts);
  delay(1000);
}`,
        explain: 'Averaging 16 samples cuts random noise by roughly 4x. analogReadMilliVolts() avoids the calibration mess of raw ADC counts.',
      },
    ],
    practice: [
      { q: 'Why average multiple ADC readings?', a: 'Each reading carries random noise with roughly zero mean, so averaging N samples reduces the noise amplitude by about √N.' },
      { q: 'A temperature sensor reports ±0.5 °C accuracy and 0.01 °C resolution. What does that mean?', a: 'It can distinguish 0.01 °C changes, but any single reading may be off by up to 0.5 °C. Resolution is not accuracy.' },
    ],
  },
  {
    id: 'iot-2',
    subjectId: 'iot',
    title: 'MQTT, the Cloud Pipeline and Device Security',
    summary: 'Publish/subscribe messaging, brokers, topics — and securing the whole path.',
    minutes: 15,
    topics: ['MQTT', 'Device Security', 'Edge Computing'],
    sections: [
      {
        h: 'Why publish/subscribe',
        b: `Devices should not know who consumes their data. MQTT decouples them:

\`\`\`
Publisher  ->  Broker  ->  Subscriber(s)
(sensor)      (server)     (dashboard, database, alert)
\`\`\`

The device publishes to a topic and simply forgets. Subscribers decide what to do. Adding a new consumer requires **zero changes to the device**.`,
      },
      {
        h: 'Topics, QoS and retained messages',
        b: `Topics are hierarchical and use \`/\` as a separator:

\`\`\`
home/living-room/temperature
home/living-room/humidity
building-4/floor-2/room-201/occupancy
\`\`\`

**Wildcards** let you subscribe broadly:
\`\`\`
home/+/temperature    -> one level wildcard
home/#                -> everything below "home"
\`\`\`

**QoS (Quality of Service):**
- **QoS 0** — at most once. Fire and forget. Fine for frequent sensor readings.
- **QoS 1** — at least once. Duplicates possible; the consumer must be idempotent.
- **QoS 2** — exactly once. Slowest, use sparingly.

A **retained message** is stored by the broker and delivered instantly to new subscribers — ideal for "current device status".`,
      },
      {
        h: 'Securing devices',
        b: `A device on your network is often **cheap, long-lived and unpatchable**. Assume it will be compromised.

**Transport**: TLS (port 8883) — never send credentials in plaintext.
**Credentials**: per-device certificates or unique username/password, not a shared key. Revoking one device then affects only that device.
**At rest**: disable debug interfaces, lock the bootloader, encrypt flash.
**In code**: validate every value received, because a device is also an input source.
**Network**: put devices on a separate VLAN or IoT subnet, so a compromise is contained.`,
      },
      {
        h: 'Edge computing',
        b: `Not everything should go to the cloud. Process locally when:
- **Latency** matters (a safety interlock cannot wait for a round trip).
- **Bandwidth** is the bottleneck (video streams).
- **Privacy** requires it (raw sensor data never leaves the device).
- **Connectivity** is unreliable — devices must work offline.

The usual pattern: **edge filters and reacts, cloud stores, aggregates and trains**.`,
      },
    ],
    keyPoints: [
      'Pub/sub decouples devices from consumers — add consumers without touching devices.',
      'Use + and # wildcards; choose QoS per message importance.',
      'Retained messages give new subscribers the current state instantly.',
      'Per-device credentials, TLS, and network segmentation contain breaches.',
    ],
    examples: [
      {
        title: 'MQTT publish and subscribe',
        lang: 'javascript',
        code: `// publisher (device)
client.publish(
  'home/living-room/temperature',
  JSON.stringify({ value: 23.4, unit: 'C', ts: Date.now() }),
  { qos: 1, retain: true }
);

// subscriber (dashboard)
client.on('message', (topic, payload) => {
  if (topic === 'home/living-room/temperature') {
    updateChart(JSON.parse(payload));
  }
});
client.subscribe('home/+/temperature', { qos: 1 });`,
        explain: 'retain:true means a subscriber that connects later still gets the current temperature without waiting for the next reading.',
      },
    ],
    practice: [
      { q: 'When would you pick QoS 1 over QoS 0?', a: 'When losing a message would matter (a door-lock command, a payment event). QoS 1 may duplicate, so the handler must be idempotent.' },
      { q: 'Why should IoT devices be on a separate network segment?', a: 'It contains compromise: a hacked camera cannot scan or reach your laptops, NAS or NAS credentials.' },
    ],
  },

  /* ============================================================= AR/VR === */
  {
    id: 'arvr-1',
    subjectId: 'ar-vr',
    title: 'Coordinate Systems, Tracking and the Rendering Pipeline',
    summary: 'World space, head pose, the frame loop and the performance budget.',
    minutes: 15,
    topics: ['Coordinate Systems', 'Tracking', 'Rendering', 'Performance'],
    sections: [
      {
        h: 'Frames and spaces',
        b: `Everything in XR is defined relative to a tracking space.

- **World space** — the fixed reference frame of the room. Objects live here.
- **Local space** — relative to an object.
- **Tracking space / play area** — the volume the runtime has mapped.

**Head pose** = position + orientation. Typically the headset is at the origin in XR rig space, so "in front of you" is \`+Z\` in Unity / \`−Z\` in OpenGL. Getting this backwards is the classic first-day bug.`,
      },
      {
        h: 'How tracking works',
        b: `**6DoF (six degrees of freedom)** = 3 position axes + 3 rotation axes. This is what makes a headset feel present.

\`\`\`
Inside-out  : cameras on the headset map the room   (Quest, PSVR2)
Outside-in   : cameras in the room track the device (Valve Index)
\`\`\`

Outside-in has lower latency and better precision but needs fixed base stations. Inside-out is portable, which is why it won.

**Predictive tracking** extrapolates the pose forward by the render latency (~3 frames) so what you see matches where your head actually is.`,
      },
      {
        h: 'The render loop and the budget',
        b: `\`\`\`
1. Predict head pose
2. Read controller poses
3. Update physics
4. Cull + render
5. Submit to compositor -> display
\`\`\`

The critical number: you have **~11 ms** per eye at 90 Hz. Miss it and the app stutters — a far worse experience than low resolution.

\`\`\`
90 Hz  -> 11.1 ms
72 Hz  -> 13.9 ms
120 Hz -> 8.3 ms
\`\`\`

**Dynamic resolution** renders at a lower pixel count and upscales when the GPU is struggling, protecting the frame rate.`,
      },
      {
        h: 'Common causes of nausea',
        b: `VR sickness is mostly a **sensory conflict** between what your eyes see and what your inner ear senses.

- **Latency** — motion that appears late makes the world feel wrong.
- **Motion-to-photon delay** — must be under ~20 ms.
- **Forced acceleration** — moving the player without physical input.
- **Fixed reference frame** — inside a small cockpit, a fixed horizon is better.
- **Binocular mismatch** — should be ~64 mm; wrong IPD settings are painful.`,
      },
    ],
    keyPoints: [
      '6DoF = 3 position + 3 rotation axes.',
      'Inside-out is portable; outside-in is precise but tethered to base stations.',
      'At 90 Hz you have ~11 ms — protect frame rate above all else.',
      'VR sickness comes from sensory conflict: latency, forced motion, bad IPD.',
    ],
    examples: [
      {
        title: 'Frame budget at different refresh rates',
        lang: 'text',
        code: `target 90 Hz  -> 11.1 ms/frame
  CPU frame prep     2.0 ms
  draw calls        2.5 ms
  GPU render        5.0 ms
  ------------------
  used              9.5 ms
  headroom          1.6 ms   <- must stay positive

If GPU render grows to 9 ms, total = 13.5 ms
  -> drop to 72 Hz or lower resolution, never ship the stutter.`,
        explain: 'When the budget goes negative the compositor repeats the previous frame. Dropping resolution before frame rate is the standard trade.',
      },
    ],
    practice: [
      { q: 'Why is frame rate prioritised over resolution in VR?', a: 'A dropped frame breaks the illusion of presence and causes nausea; slightly soft visuals are barely noticeable. The eye is far more sensitive to motion discontinuity than to blur.' },
      { q: 'What causes most VR sickness?', a: 'Sensory conflict between visual and vestibular signals, usually caused by latency or forced camera motion the player did not initiate.' },
    ],
  },

  /* ================================================= THEORY OF COMPUTATION */
  {
    id: 'toc-1',
    subjectId: 'toc',
    title: 'Formal Languages and Finite Automata',
    summary: 'Alphabet, strings, regular expressions and the machines that decide them.',
    minutes: 16,
    topics: ['Formal Languages', 'Finite Automata'],
    sections: [
      {
        h: 'The alphabet and the language',
        b: `An **alphabet** Σ is a finite set of symbols, e.g. \`{0, 1}\`. A **string** is a finite sequence of those symbols.

A **language** is any set of strings over Σ. Writing "the set of all strings that start with 01" *is* a language definition — regularity, not the alphabet, decides whether the name is legal.

Operations: union (∪), intersection (∩), complement, concatenation, Kleene star (*).

**Kleene star** is the interesting one: \`(0|1)*\` matches *every* binary string, including the empty string.`,
      },
      {
        h: 'The Chomsky hierarchy',
        b: `\`\`\`
Type 3  Regular            finite automata, regex
Type 2  Context-free      pushdown automata, most programming language syntax
Type 1  Context-sensitive  linear bounded automata
Type 0  Recursively enumerable  Turing machines
\`\`\`

Each level is a strict superset of the one below. **"Can this language be recognised by a machine with no memory beyond the current state?"** is exactly the question that separates regular from context-free.`,
      },
      {
        h: 'DFA, NFA and regular expressions',
        b: `A **DFA** (deterministic finite automaton) has exactly one transition per symbol per state — no choices, no memory. A string is accepted if it ends in an accept state.

An **NFA** can branch and can transition on the empty symbol. It is more expressive in practice (and just as powerful in expressiveness — any NFA has an equivalent DFA).

**A string is regular ⟺ some DFA accepts it ⟺ some regular expression matches it.** That is the Regular Language Theorem, and it is why \`grep\`, \`\\\`route matching and \`\\\`\\\`.*\\\`\\\` all work the way they do.

The pumping lemma proves non-regularity: assume an infinite regular language, and the pumping lemma guarantees a substring that can be pumped forever — which some non-regular language simply cannot do.`,
      },
      {
        h: 'Pumping lemma in practice',
        b: `To prove a language L is **not** regular:
1. Assume it *is* regular with pumping length p.
2. Choose a string s ∈ L with |s| ≥ p (the "adversarial" string).
3. Split s = xyz where |xy| ≤ p and |y| > 0.
4. Show that pumping y down (xy⁰z) produces a string **not in L**.
5. Contradiction → L is not regular.

\`\`\`
L = { aⁿbⁿ : n ≥ 0 }   // "a"n then "b"n

pumpable word  aᵖbᵖ
pumping y = aᵖ  ->  a⁰bᵖ = bᵖ  ∉ L   (n=0 but there are b's)
=> L is NOT regular. It needs a stack: PDA / context-free.`,
      },
    ],
    keyPoints: [
      'A language is a set of strings; regularity decides what we may call it.',
      'Chomsky Type 3 = regular = DFA = regex (equivalent).',
      'DFA: one transition per symbol. NFA: branches and ε-moves.',
      'Pumping lemma: assume regular, pump y out, get a contradiction.',
    ],
    examples: [
      {
        title: 'A DFA for strings ending in "01"',
        lang: 'text',
        code: `states: q0 (start) -> q1 (saw 0) -> q2 ACCEPT (saw 01)
                       q0 on 1 -> q0

  --1--> q0 --0--> q1 --1--> q2 (accept)
   ^        |                |
   +--------+----------------+
        on 0: q1 -> q0 , q2 -> q0

To test: 0 1 0 1  ->  q0 q1 q0 q1 q2  ACCEPT`,
        explain: 'Only three states, and no memory beyond "what was the last character". That is the whole trick of a DFA.',
      },
    ],
    practice: [
      { q: 'Can a DFA count how many a\'s appear (any number)?', a: 'No. A DFA has finite memory, so it cannot remember a running count. Any DFA for aⁿbⁿ is impossible — that language is not regular.' },
      { q: 'Why is a NFA equivalent to a DFA?', a: 'Subset construction: an NFA with k states maps to a DFA with up to 2ᵏ states by tracking the set of possible current states.' },
    ],
  },
  {
    id: 'toc-2',
    subjectId: 'toc',
    title: 'Turing Machines, Decidability and P vs NP',
    summary: 'What can be computed at all, and what is intractable.',
    minutes: 17,
    topics: ['Turing Machines', 'Decidability', 'P vs NP', 'Complexity'],
    sections: [
      {
        h: 'The Turing machine',
        b: `A **Turing machine** has a tape (infinite in both directions), a read/write head, a finite state machine, and transition rules \`(state, symbol) → (state, write, move)\`.

Everything you already know — Python, Java, SQL, a browser — can be simulated by one. That is the Church-Turing thesis: a function is computable if *some* Turing machine computes it.`,
      },
      {
        h: 'The three problems',
        b: `\`\`\`
Decidable      : a machine always halts with the right answer
Undecidable    : no machine can decide it for all inputs
               (Halting Problem, Church-Turing, Gödel)
Intractable    : decidable, but no known algorithm is fast enough
\`\`\`

**Halting Problem proof sketch:** suppose a program H(P, x) decides whether program P halts on input x. Now run H(H, H):
- H says "H halts" → H should not halt. Contradiction.
- H says "H does not halt" → H should halt. Contradiction.

So H cannot exist, and no cleverer program can decide it either — a theorem about all programs, not about one implementation.`,
      },
      {
        h: 'Complexity classes',
        b: `\`\`\`
P     : problems solvable in polynomial time
NP    : solutions verifiable in polynomial time
NP-hard  : at least as hard as every problem in NP
NP-complete : in NP AND NP-hard
\`\`\`

**P vs NP** asks: *if a proposed answer can be checked quickly, can it always be found quickly?*

- **P = NP** would mean efficient algorithms exist for essentially every problem with a checkable answer.
- **P ≠ NP** would mean some checkable problems can never be solved efficiently.

Nobody has proved either. Note the asymmetry: P ⊆ NP trivially (if you can find it, you can verify it). P = NP is the widely believed answer.`,
      },
      {
        h: 'Why NP-hard problems are still practical',
        b: `Many NP-hard problems are solvable in real time by giving up optimality:

- **Travelling Salesman**: the Held-Karp DP is O(n²·2ⁿ) — hopeless for n=100. But good heuristics solve n=10,000 cities in seconds and land within ~1% of optimal.
- **SAT**: NP-complete, yet modern SAT solvers handle millions of clauses via CDCL.
- **Scheduling**: use constraint programming / ILP with a time limit.

And a huge class of problems is **not NP-hard at all** but only *seemingly* exponential — 2-SAT, interval scheduling, and many greedy problems. **Proving hardness is what lets you stop hunting for an exact algorithm.**`,
      },
    ],
    keyPoints: [
      'A Turing machine can simulate every known computation.',
      'Decidable = always halts correctly. Undecidable = no machine can decide it.',
      'NP = verifiable quickly. NP-complete = as hard as the hardest NP problems.',
      'Heuristics and "probably good enough" answers make NP-hard problems practical.',
    ],
    examples: [
      {
        title: 'Why bubble sort is O(n²) and merge sort is O(n log n)',
        lang: 'text',
        code: `bubble sort : T(n) = T(n-1) + O(n) = O(n²)
               (you only know the list is sorted at the end)

merge sort  : T(n) = 2·T(n/2) + O(n)
               = O(n log n)     <- a master-theorem result

Concrete: 1,000,000 items
  n²        -> ~10^12 operations   (hours)
  n log n   -> ~2·10^7 operations   (well under a second)`,
        explain: 'The divide-and-conquer structure is exactly why merge sort scales — the recurrence closes on log n, not n.',
      },
    ],
    practice: [
      { q: 'Why is the Halting Problem undecidable?', a: 'A decider for it would have to correctly report on itself, which produces a contradiction in both cases. The impossibility is about all possible programs, so no alternative program can escape it.' },
      { q: 'Is the problem "is this graph 2-colourable?" in P or NP-complete?', a: 'It is in P (BFS in O(V+E)) — even though it looks like a constraint-satisfaction problem. Not everything that looks hard is NP-hard.' },
    ],
  },
];

export const SUBJECTS_BY_ID = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
export const LESSONS_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
export const lessonsFor = (subjectId) =>
  LESSONS.filter((l) => l.subjectId === subjectId).sort((a, b) => a.id.localeCompare(b.id));
