import { useEffect, useState } from 'react';
import Badge from '../components/Badge';
import { proficiencyScalesApi, skillRatingsApi, skillsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getLevelsForSkill } from '../lib/proficiency';
import type { ProficiencyScale, Skill, SkillRating } from '../api/types';

export default function ProfilePage() {
  const { user } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [scales, setScales] = useState<ProficiencyScale[]>([]);
  const [ratings, setRatings] = useState<SkillRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSkill, setSelectedSkill] = useState<number | ''>('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [evidence, setEvidence] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const [skillsRes, scalesRes, ratingsRes] = await Promise.all([
        skillsApi.list(),
        proficiencyScalesApi.list(),
        skillRatingsApi.list({ employee: user.employee_id }),
      ]);
      setSkills(skillsRes.results);
      setScales(scalesRes.results);
      setRatings(ratingsRes.results);
    } catch {
      setError('Failed to load your skills profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employee_id]);

  if (!user?.employee_id) {
    return <p className="text-gray-500">You don't have an Employee record, so there's no skills profile to show.</p>;
  }

  const ratedSkillIds = new Set(ratings.map((r) => r.skill));
  const availableLevels = selectedSkill ? getLevelsForSkill(selectedSkill, scales) : [];
  const existingRating = selectedSkill ? ratings.find((r) => r.skill === selectedSkill) : undefined;

  async function handleSubmit() {
    if (!selectedSkill || !selectedLevel) return;
    setSaving(true);
    setError(null);
    try {
      if (existingRating) {
        await skillRatingsApi.update(existingRating.id, { proficiency_level: selectedLevel, evidence });
      } else {
        await skillRatingsApi.create({ skill: selectedSkill as number, proficiency_level: selectedLevel, evidence });
      }
      setSelectedSkill('');
      setSelectedLevel('');
      setEvidence('');
      await loadAll();
    } catch {
      setError('Failed to save your self-assessment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">My Skills Profile</h1>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Add / update a self-assessment</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Skill
            <select
              className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
              value={selectedSkill}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : '';
                setSelectedSkill(id);
                const existing = id ? ratings.find((r) => r.skill === id) : undefined;
                setSelectedLevel(existing?.proficiency_level ?? '');
                setEvidence(existing?.evidence ?? '');
              }}
            >
              <option value="">Select a skill…</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {ratedSkillIds.has(s.id) ? '(rated)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Proficiency
            <select
              className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              disabled={!selectedSkill}
            >
              <option value="">Select…</option>
              {availableLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-sm">
            Evidence (optional)
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <button
            onClick={() => void handleSubmit()}
            disabled={!selectedSkill || !selectedLevel || saving}
            className="rounded-md bg-orange-600 px-4 py-1.5 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {existingRating ? 'Update' : 'Save'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-gray-500">Loading…</p>
        ) : ratings.length === 0 ? (
          <p className="p-4 text-gray-500">No self-assessments yet — add one above.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="p-3">Skill</th>
                <th className="p-3">Level</th>
                <th className="p-3">Source</th>
                <th className="p-3">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <td className="p-3 font-medium">{r.skill_name}</td>
                  <td className="p-3">{r.proficiency_level}</td>
                  <td className="p-3">
                    <Badge value={r.source} />
                  </td>
                  <td className="p-3 text-gray-500">{r.evidence || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
