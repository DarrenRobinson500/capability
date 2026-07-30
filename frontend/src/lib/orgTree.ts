import type { Position } from '../api/types';

/** All Position ids in the reporting subtree rooted at rootId, including rootId itself. */
export function getSubtreePositionIds(rootId: number, positions: Position[]): Set<number> {
  const ids = new Set<number>([rootId]);
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = positions.filter((p) => p.parent_position !== null && frontier.includes(p.parent_position));
    const newIds = children.map((c) => c.id).filter((id) => !ids.has(id));
    if (newIds.length === 0) break;
    newIds.forEach((id) => ids.add(id));
    frontier = newIds;
  }
  return ids;
}
