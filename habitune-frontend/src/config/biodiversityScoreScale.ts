export const biodiversityScoreClasses = [
  { min: 0, max: 39, color: '#E8F3E8', label: '0–39' },
  { min: 40, max: 54, color: '#C9E3C7', label: '40–54' },
  { min: 55, max: 69, color: '#8FC48D', label: '55–69' },
  { min: 70, max: 84, color: '#4F965C', label: '70–84' },
  { min: 85, max: 100, color: '#1F6B3A', label: '85–100' },
] as const

export function getBiodiversityScoreColor(score: number) {
  const normalizedScore = Number.isFinite(score) ? Math.min(Math.max(score, 0), 100) : 0
  return biodiversityScoreClasses.find((scoreClass) => normalizedScore <= scoreClass.max)?.color || biodiversityScoreClasses.at(-1)!.color
}
