export function pickRandomQuestions(questions, n = 3) {
  const shuffled = [...questions].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, shuffled.length))
}

export function calculateScore(answers, questions) {
  const correct = questions.filter((q, i) => answers[i] === q.correctAnswer).length
  const total = questions.length
  const percentage = Math.round((correct / total) * 100)
  return { correct, total, percentage, approved: percentage >= 70 }
}
