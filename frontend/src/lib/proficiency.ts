import type { ProficiencyScale } from '../api/types';

function getScaleForSkill(skillId: number, scales: ProficiencyScale[]): ProficiencyScale | undefined {
  return scales.find((s) => s.skill === skillId) ?? scales.find((s) => s.skill === null);
}

export function getLevelsForSkill(skillId: number, scales: ProficiencyScale[]): string[] {
  return getScaleForSkill(skillId, scales)?.levels ?? [];
}

export function getLevelDescription(skillId: number, level: string, scales: ProficiencyScale[]): string | undefined {
  return getScaleForSkill(skillId, scales)?.level_descriptions[level];
}
