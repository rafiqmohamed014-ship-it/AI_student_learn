/**
 * js/data/quizbank.js
 * ---------------------------------------------------------------------------
 * Built-in quizzes that work with NO AI and NO internet.
 * Used by the "Practice quiz" mode so the quiz engine is always usable.
 *
 * Each question: { q, options[4], answer: index, why, topic, difficulty }
 */

export const QUIZ_BANK = {
  programming: [
    { q: 'What is the time complexity of accessing an element by index in a standard array?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], answer: 0, topic: 'Data Structures', difficulty: 'easy', why: 'Elements are stored contiguously, so the address is computed directly: base + index × elementSize. No searching needed.' },
    { q: 'A recursive function is called but never returns. What is the most likely cause?', options: ['Too many local variables', 'No reachable base case', 'Wrong variable scope', 'Missing return type'], answer: 1, topic: 'Recursion', difficulty: 'easy', why: 'Without a base case the recursive call keeps expanding until the call stack overflows.' },
    { q: 'What is the output of `for (let i = 0; i < 5; i++) { if (i % 2 === 0) console.log(i); }`?', options: ['0 1 2 3 4', '0 2 4', '1 3', '0 2 4 6'], answer: 1, topic: 'Control Flow', difficulty: 'easy', why: 'i % 2 === 0 is true for 0, 2 and 4 within the range i < 5.' },
    { q: 'A hash table lookup has an average time complexity of…', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], answer: 0, topic: 'Data Structures', difficulty: 'medium', why: 'A hash function maps the key directly to a bucket, giving constant-time average lookup (O(n) in the pathological worst case).' },
    { q: 'Why is it dangerous to delete items from an array while iterating over it with a for loop?', options: ['The array becomes read-only', 'Indices shift, so elements get skipped', 'The loop variable becomes a string', 'The garbage collector stops'], answer: 1, topic: 'Data Structures', difficulty: 'medium', why: 'Removing an element shifts every later element down by one, so the increment skips the element that moved into the current index.' },
    { q: 'What does a closure capture?', options: ['Only global variables', 'The variables in scope where it was created', 'A copy of all arguments', 'Nothing — it is just a function'], answer: 1, topic: 'Scope', difficulty: 'hard', why: 'A closure bundles a function with references to the variables of the scope in which it was defined, keeping them alive even after that scope exits.' },
  ],

  mathematics: [
    { q: 'Using De Morgan’s law, what is ¬(A ∨ B) equivalent to?', options: ['¬A ∧ ¬B', '¬A ∨ ¬B', 'A ∧ B', 'A → B'], answer: 0, topic: 'Discrete Maths', difficulty: 'easy', why: 'De Morgan: ¬(A ∨ B) = ¬A ∧ ¬B — "not either" means "both are not".' },
    { q: 'A fair six-sided die is rolled. What is P(rolling an even number)?', options: ['1/6', '1/3', '1/2', '2/3'], answer: 2, topic: 'Probability', difficulty: 'easy', why: 'Even outcomes are {2, 4, 6} — 3 out of 6 equally likely results = 1/2.' },
    { q: 'If A and B are independent events, P(A ∩ B) equals…', options: ['P(A) + P(B)', 'P(A) − P(B)', 'P(A) · P(B)', 'P(A) / P(B)'], answer: 2, topic: 'Probability', difficulty: 'medium', why: 'Independence is defined as P(A ∩ B) = P(A) · P(B). Otherwise you need the conditional form P(A) · P(B|A).' },
    { q: 'Which recurrence relation corresponds to O(log n) time complexity?', options: ['T(n) = T(n−1) + c', 'T(n) = 2·T(n/2) + c', 'T(n) = T(n/2) + c', 'T(n) = 2·T(n−1) + c'], answer: 2, topic: 'Calculus', difficulty: 'medium', why: 'Halving the problem each step means n/2ᵏ = 1 after k = log₂n steps. The others give O(n), O(n) and O(2ⁿ).' },
    { q: 'A dataset of salaries is heavily right-skewed. Which measure best represents a "typical" salary?', options: ['Mean', 'Median', 'Standard deviation', 'Variance'], answer: 1, topic: 'Statistics', difficulty: 'medium', why: 'The mean is dragged upward by a few very large values. The median is resistant to outliers and reflects the typical case.' },
    { q: 'If r = 0.05 between two variables, which statement is justified?', options: ['X causes Y', 'Y causes X', 'No linear relationship is detectable', 'Both are constant'], answer: 2, topic: 'Statistics', difficulty: 'hard', why: 'Pearson r only measures linear association. r ≈ 0 means no *linear* relationship — a perfect U-shape still gives r ≈ 0, and causation cannot be inferred either way.' },
  ],

  'cyber-security': [
    { q: 'Which property of the CIA triad is broken by a ransomware attack?', options: ['Confidentiality only', 'Integrity only', 'Availability only', 'Both confidentiality and availability'], answer: 3, topic: 'CIA Triad', difficulty: 'easy', why: 'Ransomware encrypts your data (confidentiality) and locks you out of your systems (availability). Integrity is often affected too once files are altered.' },
    { q: 'What is the correct defence against SQL injection?', options: ['Escaping quotes manually', 'Stored procedures everywhere', 'Parameterised queries', 'Hiding error messages'], answer: 2, topic: 'Web Attacks', difficulty: 'easy', why: 'Parameterisation keeps user data in the data channel so the SQL engine never treats it as code. Escaping is fragile and context-dependent.' },
    { q: 'Why should passwords be hashed with Argon2id or bcrypt instead of SHA-256?', options: ['SHA-256 produces longer output', 'They are deliberately slow and memory-hard', 'They are reversible', 'SHA-256 adds a salt automatically'], answer: 1, topic: 'Cryptography', difficulty: 'medium', why: 'SHA-256 is designed to be fast, so GPUs can try billions of guesses per second. Argon2id/bcrypt are intentionally expensive, making offline guessing impractical.' },
    { q: 'A valid, non-expired user can read another user’s invoice by changing the ID in the URL. What is this?', options: ['XSS', 'CSRF', 'Broken access control (IDOR)', 'SQL injection'], answer: 2, topic: 'Defence', difficulty: 'medium', why: 'The server never authorises the request. The client hid the link, but every request must be checked server-side against the authenticated user.' },
    { q: 'What does the SameSite cookie attribute protect against?', options: ['XSS', 'CSRF', 'SQL injection', 'Clickjacking'], answer: 1, topic: 'Authentication', difficulty: 'medium', why: 'Browsers attach cookies automatically to cross-site requests. SameSite stops that, removing the ambient authority CSRF depends on.' },
    { q: 'In TLS, why does the handshake use asymmetric cryptography before switching to symmetric?', options: ['Asymmetric is faster', 'It solves key distribution; symmetric is faster for the bulk data', 'Symmetric cannot encrypt', 'It hides the certificate'], answer: 1, topic: 'Cryptography', difficulty: 'hard', why: 'Asymmetric crypto safely exchanges a shared secret, but it is ~100–1000× slower. Once the session key is agreed, fast symmetric encryption (AES-GCM) carries the data.' },
  ],

  'web-development': [
    { q: 'What HTTP status code means "authenticated, but not allowed"?', options: ['401', '403', '404', '500'], answer: 1, topic: 'HTTP & APIs', difficulty: 'easy', why: '401 Unauthorized = identity not established. 403 Forbidden = identity known, permission denied.' },
    { q: 'Which CSS display mode is best for laying out a page in two dimensions?', options: ['block', 'inline', 'grid', 'inline-block'], answer: 2, topic: 'CSS', difficulty: 'easy', why: 'Grid lays out rows and columns simultaneously. Flexbox is for one axis at a time.' },
    { q: 'Why use <button> instead of a styled <div> for a clickable element?', options: ['It looks better', 'It is focusable and works with keyboard and screen readers', 'Divs cannot receive clicks', 'It loads faster'], answer: 1, topic: 'Accessibility', difficulty: 'easy', why: 'Native buttons are focusable, activate on Enter/Space, expose their role to assistive tech, and submit forms — all free.' },
    { q: 'Why does fetch() not throw when the server returns 500?', options: ['It is a bug in fetch', 'HTTP error statuses are still successful network responses', 'It only works with 2xx', 'You must enable a flag'], answer: 1, topic: 'JavaScript', difficulty: 'medium', why: 'The promise rejects only on network-level failure. You must check res.ok or res.status yourself.' },
    { q: 'What does `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))` accomplish?', options: ['Creates a fixed 4-column grid', 'Creates columns that wrap responsively without media queries', 'Disables grid gap', 'Forces horizontal scrolling'], answer: 1, topic: 'CSS', difficulty: 'medium', why: 'auto-fill adds as many 260px-minimum columns as fit, then wraps. Combined with min() it also prevents overflow on very narrow screens.' },
    { q: 'Which CSS property is affected by specificity in the order id > class > element?', options: ['z-index', 'The cascade conflict resolution order', 'flex-direction', 'box-sizing'], answer: 1, topic: 'CSS', difficulty: 'hard', why: 'When two rules set the same property, the cascade compares !important, inline, specificity (100 ids / 10 classes / 1 element) then source order.' },
  ],

  'data-science': [
    { q: 'A dataset is 99% negative class. What happens if you only look at accuracy?', options: ['It will be near 99% and useless', 'It will always be 50%', 'It cannot be computed', 'It will be near 1%'], answer: 0, topic: 'Model Evaluation', difficulty: 'easy', why: 'Always predicting the majority class gives 99% accuracy while catching none of the rare cases. Use precision, recall and F1.' },
    { q: 'Why must time-series data be split by time rather than randomly?', options: ['It is faster', 'Random splits leak future information into training', 'Random splits lose timestamps', 'It uses more memory'], answer: 1, topic: 'Machine Learning', difficulty: 'medium', why: 'A random split trains on future points to predict the past, which is impossible in reality and produces unrealistically high accuracy.' },
    { q: 'What is data leakage?', options: ['Encrypting data twice', 'Using information at training time that will not exist at prediction time', 'Corrupting the CSV file', 'A type error'], answer: 1, topic: 'Data Cleaning', difficulty: 'medium', why: 'Leakage inflates offline performance while the model fails in production — a feature computed from the answer, or a duplicate record across the split.' },
    { q: 'Which is more robust for skewed income data, mean or median?', options: ['Mean', 'Median', 'Neither', 'It depends on row count'], answer: 1, topic: 'Statistics', difficulty: 'easy', why: 'A handful of very high incomes pull the mean far above the typical value. The median resists outliers.' },
    { q: 'A model has 96% train accuracy and 62% test accuracy. What is the most likely diagnosis?', options: ['Underfitting', 'Overfitting', 'Perfect generalisation', 'A data type error'], answer: 1, topic: 'Model Evaluation', difficulty: 'medium', why: 'A large gap between training and test performance is the classic signature of overfitting. Try more data, fewer features, or regularisation.' },
    { q: 'Pearson correlation between x and y is exactly 0. What can you conclude?', options: ['x and y are independent', 'There is no linear relationship', 'x and y are both constant', 'One of them is random'], answer: 1, topic: 'Statistics', difficulty: 'hard', why: 'r only measures linear association. y = x² gives r ≈ 0 despite a perfect deterministic relationship, and r = 0 says nothing about causation or independence.' },
  ],

  ai: [
    { q: 'Which search algorithm is complete and optimal when all step costs are equal?', options: ['Depth-first search', 'Breadth-first search', 'Greedy best-first search', 'Random search'], answer: 1, topic: 'Search', difficulty: 'easy', why: 'BFS explores in order of increasing depth, so the first goal found is via the fewest steps — optimal for unit costs. DFS is complete but not optimal.' },
    { q: 'What does A* use in f(n) = g(n) + h(n)?', options: ['Cost so far plus estimated remaining cost', 'Only distance travelled', 'Only the heuristic', 'Random plus depth'], answer: 0, topic: 'Search', difficulty: 'medium', why: 'g(n) is cost already paid, h(n) estimates what is left. Their sum is an estimate of total journey cost, which is why A* is optimal with an admissible h.' },
    { q: 'Why divide the Q·Kᵀ term in attention by √d_k?', options: ['To save memory', 'To stop dot products from saturating softmax', 'To make it faster', 'To reduce the vocabulary size'], answer: 1, topic: 'Transformers', difficulty: 'hard', why: 'Dot products grow with dimension. Large values push softmax into flat regions where gradients vanish. Scaling by √d_k keeps the distribution healthy.' },
    { q: 'A language model states an incorrect fact very confidently. Why?', options: ['It has a bug', 'It generates the most probable token sequence, not verified truth', 'It was trained on bad data only', 'It has no context window'], answer: 1, topic: 'NLP', difficulty: 'medium', why: 'Language models predict plausible continuations. Fluency and factual correctness are different properties — hence the term hallucination.' },
    { q: 'In minimax, which player maximises the utility?', options: ['MAX', 'MIN', 'Both', 'Neither'], answer: 0, topic: 'Search', difficulty: 'easy', why: 'MAX assumes the opponent plays optimally and minimises, so it takes the branch with the highest utility. MIN does the opposite.' },
    { q: 'Why do transformers need positional encodings?', options: ['To compress the input', 'Attention alone has no notion of word order', 'To reduce vocabulary size', 'To add dropout'], answer: 1, topic: 'Transformers', difficulty: 'hard', why: 'Self-attention is permutation-invariant — it cannot tell "dog bites man" from "man bites dog". Positional information (learned embeddings or RoPE) restores order.' },
  ],

  iot: [
    { q: 'Why is deep sleep essential for battery-powered IoT devices?', options: ['It improves accuracy', 'It reduces power from milliamps to microamps between readings', 'It increases range', 'It enables OTA updates'], answer: 1, topic: 'Microcontrollers', difficulty: 'easy', why: 'A running MCU draws tens of milliamps. Deep sleep with a timer wake drops that to tens of microamps, turning hours of life into months.' },
    { q: 'In MQTT, what does the wildcard `home/#` match?', options: ['Only home/temperature', 'Everything at exactly two levels below home', 'Everything published under home/', 'Nothing'], answer: 2, topic: 'MQTT', difficulty: 'medium', why: '# matches any number of levels, including zero, so home/# covers home/living-room/temperature and everything deeper.' },
    { q: 'What does QoS 1 guarantee?', options: ['Exactly once delivery', 'At least once delivery, so duplicates are possible', 'No delivery guarantee', 'Ordered delivery'], answer: 1, topic: 'MQTT', difficulty: 'medium', why: 'QoS 1 acknowledges receipt, so the message arrives — but retries can duplicate it. Consumers must therefore be idempotent.' },
    { q: 'What is a 10-bit ADC resolution worth?', options: ['10 values', '1024 levels', '256 levels', '1024 volts'], answer: 1, topic: 'Sensors', difficulty: 'easy', why: '2¹⁰ = 1024 distinct levels. A 12-bit ADC gives 4096 — roughly 4× the precision.' },
    { q: 'Why should each device have unique MQTT credentials instead of one shared key?', options: ['It is faster', 'It lets you revoke one compromised device without affecting others', 'It uses less bandwidth', 'It encrypts payloads'], answer: 1, topic: 'Device Security', difficulty: 'hard', why: 'With a shared credential, you cannot tell who did what and revoking access locks out the entire fleet. Per-device identity limits the blast radius.' },
    { q: 'A sensor is 0.01 °C resolution but ±0.5 °C accuracy. What does that mean?', options: ['It can detect 0.01 °C changes reliably', 'It distinguishes 0.01 °C changes but each reading may be off by 0.5 °C', 'It cannot be used', 'It measures 0.01 °C total'], answer: 1, topic: 'Sensors', difficulty: 'hard', why: 'Resolution is granularity; accuracy is the error bound. Fine resolution with poor accuracy is a precise-looking but unreliable reading.' },
  ],

  'ar-vr': [
    { q: 'What does 6DoF stand for?', options: ['Six directions of flight', 'Three position axes and three rotation axes', 'Six cameras', 'Six degrees of freedom in sound'], answer: 1, topic: 'Tracking', difficulty: 'easy', why: 'Position on x/y/z plus rotation as pitch, yaw and roll.' },
    { q: 'At 90 Hz, what is the frame budget per frame?', options: ['~11 ms', '~33 ms', '~90 ms', '~5 ms'], answer: 0, topic: 'Performance', difficulty: 'easy', why: '1000/90 = 11.1 ms. Miss it and the compositor repeats the previous frame, producing stutter.' },
    { q: 'What is the difference between inside-out and outside-in tracking?', options: ['Inside-out uses base stations', 'Inside-out uses cameras on the headset; outside-in uses cameras in the room', 'They are identical', 'Inside-out only tracks rotation'], answer: 1, topic: 'Tracking', difficulty: 'medium', why: 'Inside-out (Quest, PSVR2) is portable; outside-in (Valve Index) has lower latency and better precision but needs fixed base stations.' },
    { q: 'What is predictive tracking for?', options: ['Compressing textures', 'Extrapolating the pose to cancel render latency', 'Reducing field of view', 'Calibrating the lens'], answer: 1, topic: 'Rendering', difficulty: 'medium', why: 'By the time a frame appears, your head has moved. Predicting ~3 frames ahead makes the displayed image match your real head position.' },
    { q: 'Which is the most common cause of VR sickness?', options: ['Low resolution textures', 'Latency and sensory conflict with forced camera motion', 'Bright colours', 'Long play sessions'], answer: 1, topic: 'Interaction Design', difficulty: 'medium', why: 'Conflict between what the eyes see and what the vestibular system senses causes nausea. Latency makes it much worse.' },
    { q: 'Why does VR prioritise frame rate over resolution?', options: ['Easier to implement', 'Dropped frames break presence and cause nausea; blur is barely noticed', 'GPPs are better at low res', 'It uses less VRAM'], answer: 1, topic: 'Performance', difficulty: 'hard', why: 'Motion discontinuity is far more jarring than softness. Dynamic resolution scales pixels so the frame rate can be held.' },
  ],

  toc: [
    { q: 'A language that a DFA can recognise is called…', options: ['Context-free', 'Regular', 'Decidable', 'Recursive'], answer: 1, topic: 'Formal Languages', difficulty: 'easy', why: 'DFA, regular expression and NFA all describe exactly the same class: the regular (Type 3) languages.' },
    { q: 'Why is a DFA unable to recognise the language aⁿbⁿ?', options: ['It is too slow', 'A DFA has finite memory and cannot track a running count', 'DFAs only accept binary strings', 'The alphabet is wrong'], answer: 1, topic: 'Finite Automata', difficulty: 'medium', why: 'With a finite number of states, the machine must eventually revisit a state — it cannot know how many a’s it has seen so far.' },
    { q: 'What makes a heuristic h(n) admissible?', options: ['It is fast to compute', 'It never overestimates the true remaining cost', 'It is always zero', 'It only depends on n'], answer: 1, topic: 'Finite Automata', difficulty: 'medium', why: 'Admissibility is what guarantees A* finds an optimal path. An inadmissible heuristic can make A* return a suboptimal route.' },
    { q: 'Which problem is undecidable?', options: ['Sorting a list', 'The Halting Problem', 'Checking if a string matches a regex', 'Prime number testing'], answer: 1, topic: 'Decidability', difficulty: 'easy', why: 'The Halting Problem has no algorithm that decides it for all programs and inputs. Sorting, regex matching and primality testing are all decidable.' },
    { q: 'What does it mean for a problem to be in NP?', options: ['A solution is found in polynomial time', 'A proposed solution can be verified in polynomial time', 'The problem has no solution', 'It needs nonlinear programming'], answer: 1, topic: 'P vs NP', difficulty: 'medium', why: 'NP is about cheap verification. Finding the solution may be extremely hard — that gap is exactly what P vs NP asks about.' },
    { q: 'Why is merge sort O(n log n) while bubble sort is O(n²)?', options: ['Merge sort uses recursion, so it is faster', 'Merge sort splits the problem in half each step; bubble sort only removes one element per pass', 'Bubble sort uses more memory', 'n log n is an approximation of n²'], answer: 1, topic: 'Complexity', difficulty: 'hard', why: 'T(n) = 2·T(n/2) + O(n) closes to O(n log n); T(n) = T(n−1) + O(n) accumulates to O(n²).' },
  ],
};

export const bankFor = (subjectId) => QUIZ_BANK[subjectId] || [];

/** Build a playable quiz object from the bank. */
export function buildBuiltinQuiz(subjectId, { count = 5, difficulty = 'mixed', topic = 'all', title } = {}) {
  let pool = bankFor(subjectId).slice();
  if (difficulty !== 'mixed') pool = pool.filter((q) => q.difficulty === difficulty);
  if (topic && topic !== 'all') {
    const filtered = pool.filter((q) => q.topic.toLowerCase() === topic.toLowerCase());
    if (filtered.length) pool = filtered;
  }
  if (!pool.length) pool = bankFor(subjectId).slice();

  // deterministic-ish shuffle so a retake is not identical but is not random-chaotic
  const shuffled = pool
    .map((q) => ({ q, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.q)
    .slice(0, count);

  return {
    subject: subjectId,
    subjectName: subjectId,
    topic,
    difficulty,
    source: 'builtin',
    title: title || `${subjectId} practice quiz`,
    questions: shuffled.map((q) => ({
      question: q.q,
      options: q.options,
      answerIndex: q.answer,
      explanation: q.why,
      topic: q.topic,
      difficulty: q.difficulty,
    })),
  };
}
