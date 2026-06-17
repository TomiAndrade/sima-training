export function pickRandomQuestions(questions, n = 3) {
  const pinned = questions.filter((q) => q.pinned)
  const rest = questions.filter((q) => !q.pinned)
  const shuffled = [...rest].sort(() => Math.random() - 0.5)
  return [...pinned, ...shuffled].slice(0, Math.min(n, questions.length))
}

export function calculateScore(answers, questions) {
  const correct = questions.filter((q, i) => answers[i] === q.correctAnswer).length
  const total = questions.length
  const percentage = Math.round((correct / total) * 100)
  return { correct, total, percentage, approved: percentage >= 70 }
}
