import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Badge from '../components/Badge';
import { capabilitySearchApi, proficiencyScalesApi, skillsApi } from '../api/client';
import { getLevelDescription, getLevelsForSkill } from '../lib/proficiency';
import type { CapabilitySearchResult, ProficiencyScale, Skill } from '../api/types';

export default function CapabilitySearchPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [scales, setScales] = useState<ProficiencyScale[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<number | ''>('');
  const [minLevel, setMinLevel] = useState('');
  const [results, setResults] = useState<CapabilitySearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([skillsApi.list(), proficiencyScalesApi.list()]).then(([skillsRes, scalesRes]) => {
      setSkills(skillsRes.results);
      setScales(scalesRes.results);
    });
  }, []);

  const availableLevels = selectedSkill ? getLevelsForSkill(selectedSkill, scales) : [];
  const minLevelDescription = selectedSkill && minLevel ? getLevelDescription(selectedSkill, minLevel, scales) : undefined;

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    if (!selectedSkill) return;
    setLoading(true);
    setError(null);
    try {
      const data = await capabilitySearchApi.search(selectedSkill, minLevel || undefined);
      setResults(data);
    } catch {
      setError('Failed to run capability search.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Capability Search</h1>

      <form onSubmit={(e) => void runSearch(e)} className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-sm">
          Skill
          <select
            className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
            value={selectedSkill}
            onChange={(e) => {
              setSelectedSkill(e.target.value ? Number(e.target.value) : '');
              setMinLevel('');
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
          Minimum level (optional)
          <select
            className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
            value={minLevel}
            onChange={(e) => setMinLevel(e.target.value)}
            disabled={!selectedSkill}
          >
            <option value="">Any level</option>
            {availableLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={!selectedSkill || loading}
          className="rounded-md bg-orange-600 px-4 py-1.5 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
        {minLevelDescription && (
          <p className="w-full text-sm text-gray-500">
            <span className="font-medium text-gray-600">{minLevel}:</span> {minLevelDescription}
          </p>
        )}
      </form>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {results && (
        <div className="rounded-xl border border-gray-200 bg-white">
          {results.length === 0 ? (
            <p className="p-4 text-gray-500">No matching employees.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Level</th>
                  <th className="p-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.employee_id} className="border-b border-gray-100 last:border-0">
                    <td className="p-3 font-medium">{r.employee_name}</td>
                    <td className="p-3" title={selectedSkill ? getLevelDescription(selectedSkill, r.proficiency_level, scales) : undefined}>
                      {r.proficiency_level}
                    </td>
                    <td className="p-3">
                      <Badge value={r.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
