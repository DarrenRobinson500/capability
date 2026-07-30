import type { ProficiencyScale } from '../api/types';

export function getLevelsForSkill(skillId: number, scales: ProficiencyScale[]): string[] {
  const specific = scales.find((s) => s.skill === skillId);
  if (specific) return specific.levels;
  const global = scales.find((s) => s.skill === null);
  return global ? global.levels : [];
}
