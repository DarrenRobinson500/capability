import { useEffect, useState } from 'react';
import { positionRequirementsApi, positionsApi, proficiencyScalesApi, skillsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getSubtreePositionIds } from '../lib/orgTree';
import { getLevelDescription, getProficiencyLevels } from '../lib/proficiency';
import type { Position, PositionRequirement, ProficiencyScale, Skill } from '../api/types';

export default function PositionRequirementsPage() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [scales, setScales] = useState<ProficiencyScale[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<number | ''>('');
  const [requirements, setRequirements] = useState<PositionRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newSkill, setNewSkill] = useState<number | ''>('');
  const [newLevel, setNewLevel] = useState('');
  const [newRequired, setNewRequired] = useState(true);

  useEffect(() => {
    Promise.all([positionsApi.list(), skillsApi.list(), proficiencyScalesApi.list()])
      .then(([positionsRes, skillsRes, scalesRes]) => {
        setPositions(positionsRes.results);
        setSkills(skillsRes.results);
        setScales(scalesRes.results);
      })
      .finally(() => setLoading(false));
  }, []);

  const visiblePositions =
    user?.role === 'HR_ADMIN'
      ? positions
      : user?.position_id != null
        ? positions.filter((p) => getSubtreePositionIds(user.position_id as number, positions).has(p.id))
        : [];

  useEffect(() => {
    if (!selectedPosition) {
      setRequirements([]);
      return;
    }
    positionRequirementsApi.list({ position: selectedPosition }).then((res) => setRequirements(res.results));
  }, [selectedPosition]);

  const availableLevels = getProficiencyLevels(scales);
  const newLevelDescription = newSkill && newLevel ? getLevelDescription(newSkill, newLevel, skills) : undefined;

  async function addRequirement() {
    if (!selectedPosition || !newSkill || !newLevel) return;
    setError(null);
    try {
      await positionRequirementsApi.create({
        position: selectedPosition as number,
        skill: newSkill as number,
        min_proficiency: newLevel,
        required: newRequired,
      });
      setNewSkill('');
      setNewLevel('');
      setNewRequired(true);
      const res = await positionRequirementsApi.list({ position: selectedPosition as number });
      setRequirements(res.results);
    } catch {
      setError('Failed to add requirement.');
    }
  }

  async function removeRequirement(id: number) {
    await positionRequirementsApi.delete(id);
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Positions</h1>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <label className="block text-sm">
        Position
        <select
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
          value={selectedPosition}
          onChange={(e) => setSelectedPosition(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select a position…</option>
          {visiblePositions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.role_title} — {p.department} ({p.is_vacant ? 'vacant' : p.employee_name})
            </option>
          ))}
        </select>
      </label>

      {selectedPosition && (
        <>
          <section className="rounded-xl border border-gray-200 bg-white">
            {requirements.length === 0 ? (
              <p className="p-4 text-gray-500">No requirements set for this position yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="p-3">Skill</th>
                    <th className="p-3">Min. proficiency</th>
                    <th className="p-3">Required</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-3 font-medium">{r.skill_name}</td>
                      <td className="p-3" title={getLevelDescription(r.skill, r.min_proficiency, skills)}>
                        {r.min_proficiency}
                      </td>
                      <td className="p-3">{r.required ? 'Required' : 'Nice-to-have'}</td>
                      <td className="p-3">
                        <button onClick={() => void removeRequirement(r.id)} className="text-sm text-red-600 hover:underline">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <label className="text-sm">
              Skill
              <select
                className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
                value={newSkill}
                onChange={(e) => {
                  setNewSkill(e.target.value ? Number(e.target.value) : '');
                  setNewLevel('');
                }}
              >
                <option value="">Select a skill…</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Min. proficiency
              <select
                className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                disabled={!newSkill}
              >
                <option value="">Select…</option>
                {availableLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
              Required (uncheck for nice-to-have)
            </label>
            <button
              onClick={() => void addRequirement()}
              disabled={!newSkill || !newLevel}
              className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Add requirement
            </button>
            {newLevelDescription && (
              <p className="w-full text-sm text-gray-500">
                <span className="font-medium text-gray-600">{newLevel}:</span> {newLevelDescription}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
