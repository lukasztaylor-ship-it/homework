export const exerciseModes = [
    { id: 'gap', title: 'Fill in the gaps', description: 'Complete missing words in your example sentences.' },
    { id: 'choice', title: 'Multiple choice', description: 'Choose the matching English expression.' },
    { id: 'translation', title: 'Translation', description: 'Translate Polish into English.' },
    { id: 'listening', title: 'Listening', description: 'Listen and type the English expression.' },
    { id: 'matching', title: 'Matching pairs', description: 'Match expressions with their Polish translations.' },
    { id: 'mixed', title: 'Mixed practice', description: 'Combine all five exercise types.' },
];
export function normalizeAnswer(value) {
    return value.normalize('NFKC').trim().toLocaleLowerCase('en-US')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[.!?]+$/g, '').trim().replace(/[,;:]/g, ' ').replace(/\s+/g, ' ')
        // Expand only unambiguous contractions; 's and 'd can change meaning.
        .replace(/\bi'm\b/g, 'i am')
        .replace(/\bwhat's your name\b/g, 'what is your name')
        .replace(/\blet's go\b/g, 'let us go')
        .replace(/\b(you|we|they)'re\b/g, '$1 are')
        .replace(/\b(i|you|we|they)'ve\b/g, '$1 have')
        .replace(/\b(i|you|he|she|it|we|they)'ll\b/g, '$1 will')
        .replace(/\bcan't\b/g, 'cannot')
        .replace(/\bcan not\b/g, 'cannot')
        .replace(/\bwon't\b/g, 'will not')
        .replace(/\bshan't\b/g, 'shall not')
        .replace(/\b(is|are|was|were|do|does|did|have|has|had|could|would|should|must|need|dare)n't\b/g, '$1 not');
}
export function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
export function gapPrompt(example, expression) {
    const escaped = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
    const result = example.replace(pattern, '_____');
    return result === example ? null : result;
}
// Practice is read-only: use snapshots, never mutate cards or their review schedule.
export function createQuestions(items, count = 20, mode = 'mixed', random = Math.random) {
    if (!Number.isFinite(count) || count <= 0)
        return [];
    const valid = shuffle(items.filter(item => normalizeAnswer(item.expression) && normalizeAnswer(item.translation)), random);
    const pools = { gap: [], choice: [], translation: [], listening: [], matching: [] };
    const uniquePairs = [];
    const expressions = new Set(), translations = new Set();
    for (const item of valid) {
        const expression = item.expression.trim(), translation = item.translation.trim(), example = item.example?.trim() || undefined;
        const prompt = gapPrompt(item.example?.trim() ?? '', expression);
        if (prompt)
            pools.gap.push({ type: 'gap', id: item.id, example, prompt, answer: expression, translation });
        const alternatives = [...new Set(valid.filter(other => normalizeAnswer(other.translation) !== normalizeAnswer(translation)).map(other => other.expression.trim()))]
            .filter(option => normalizeAnswer(option) !== normalizeAnswer(expression))
            .filter((option, i, all) => all.findIndex(value => normalizeAnswer(value) === normalizeAnswer(option)) === i);
        if (alternatives.length >= 3)
            pools.choice.push({ type: 'choice', id: item.id, example, prompt: translation, answer: expression, options: shuffle([expression, ...shuffle(alternatives, random).slice(0, 3)], random) });
        pools.translation.push({ type: 'translation', id: item.id, example, prompt: translation, answer: expression, translation });
        pools.listening.push({ type: 'listening', id: item.id, example, prompt: '', answer: expression, translation });
        const en = normalizeAnswer(expression), pl = normalizeAnswer(translation);
        if (!expressions.has(en) && !translations.has(pl)) {
            uniquePairs.push({ id: item.id, expression, translation, example });
            expressions.add(en);
            translations.add(pl);
        }
    }
    // Keep a final two-card round instead of stranding a single unmatchable card.
    for (let i = 0; i < uniquePairs.length;) {
        const remaining = uniquePairs.length - i;
        const size = remaining === 5 ? 3 : Math.min(4, remaining);
        if (size < 2)
            break;
        const pairs = uniquePairs.slice(i, i + size);
        pools.matching.push({ type: 'matching', id: pairs[0].id, pairs, translations: shuffle(pairs, random) });
        i += size;
    }
    if (mode !== 'mixed')
        return pools[mode].slice(0, Math.floor(count));
    const order = shuffle(['gap', 'choice', 'translation', 'listening', 'matching'], random);
    const questions = [];
    for (let round = 0; questions.length < Math.floor(count); round++) {
        let added = false;
        for (const type of order) {
            const question = pools[type][round];
            if (question && questions.length < Math.floor(count)) {
                questions.push(question);
                added = true;
            }
        }
        if (!added)
            break;
    }
    return questions;
}
