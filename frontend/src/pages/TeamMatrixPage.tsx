import { useEffect, useMemo, useState } from 'react';
import Badge from '../components/Badge';
import { positionRequirementsApi, positionsApi, skillRatingsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getSubtreePositionIds } from '../lib/orgTree';
import type { Position, PositionRequirement, SkillRating } from '../api/types';

export default function TeamMatrixPage() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [requirements, setRequirements] = useState<PositionRequirement[]>([]);
  const [ratings, setRatings] = useState<SkillRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endorsing, setEndorsing] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [positionsRes, requirementsRes, ratingsRes] = await Promise.all([
        positionsApi.list(),
        positionRequirementsApi.list(),
        skillRatingsApi.list(),
      ]);
      setPositions(positionsRes.results);
      setRequirements(requirementsRes.results);
      setRatings(ratingsRes.results);
    } catch {
      setError('Failed to load the team skills matrix.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const teamPositions = useMemo(() => {
    if (user?.position_id == null) return [];
    const subtree = getSubtreePositionIds(user.position_id, positions);
    return positions.filter((p) => subtree.has(p.id) && p.id !== user.position_id);
  }, [positions, user?.position_id]);

  const teamPositionIds = new Set(teamPositions.map((p) => p.id));
  const teamRequirements = requirements.filter((r) => teamPositionIds.has(r.position));
  const skillColumns = Array.from(
    new Map(teamRequirements.map((r) => [r.skill, r.skill_name])).entries()
  );

  function ratingFor(employeeId: number, skillId: number) {
    return ratings.find((r) => r.employee === employeeId && r.skill === skillId);
  }

  function requirementFor(positionId: number, skillId: number) {
    return requirements.find((r) => r.position === positionId && r.skill === skillId);
  }

  async function handleEndorse(ratingId: number) {
    setEndorsing(ratingId);
    try {
      await skillRatingsApi.endorse(ratingId);
      await load();
    } catch {
      setError('Failed to endorse rating.');
    } finally {
      setEndorsing(null);
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (user?.position_id == null) {
    return <p className="text-gray-500">You don't occupy a Position, so there's no team to show.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Team Skills Matrix</h1>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {teamPositions.length === 0 ? (
        <p className="text-gray-500">No positions report to you.</p>
      ) : skillColumns.length === 0 ? (
        <p className="text-gray-500">No skill requirements set for your team's positions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="sticky left-0 bg-white p-3">Employee</th>
                {skillColumns.map(([skillId, skillName]) => (
                  <th key={skillId} className="p-3">
                    {skillName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamPositions.map((position) => (
                <tr key={position.id} className="border-b border-gray-100 last:border-0">
                  <td className="sticky left-0 bg-white p-3 font-medium">
                    {position.is_vacant ? <span className="text-gray-400">Vacant — {position.role_title}</span> : position.employee_name}
                  </td>
                  {skillColumns.map(([skillId]) => {
                    const requirement = requirementFor(position.id, skillId);
                    if (position.employee == null) {
                      return (
                        <td key={skillId} className="p-3 text-gray-300">
                          {requirement ? '—' : ''}
                        </td>
                      );
                    }
                    const rating = ratingFor(position.employee, skillId);
                    if (!requirement && !rating) {
                      return <td key={skillId} className="p-3" />;
                    }
                    if (!rating) {
                      return (
                        <td key={skillId} className="p-3">
                          <Badge value="missing" label="not rated" />
                        </td>
                      );
                    }
                    return (
                      <td key={skillId} className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{rating.proficiency_level}</span>
                          <Badge value={rating.source} />
                          {rating.source === 'SELF' && (
                            <button
                              onClick={() => void handleEndorse(rating.id)}
                              disabled={endorsing === rating.id}
                              className="text-xs text-orange-700 hover:underline disabled:opacity-50"
                            >
                              Endorse
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
