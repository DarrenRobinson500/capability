import type { ProficiencyScale, Skill } from '../api/types';

/** The single shared, ordered list of proficiency level names every skill uses. */
export function getProficiencyLevels(scales: ProficiencyScale[]): string[] {
  return scales[0]?.levels ?? [];
}

/** What a given level actually means for a specific skill (varies per skill). */
export function getLevelDescription(skillId: number, level: string, skills: Skill[]): string | undefined {
  return skills.find((s) => s.id === skillId)?.level_descriptions[level];
}
