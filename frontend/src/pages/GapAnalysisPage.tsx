import { useState } from 'react';
import type { FormEvent } from 'react';
import Badge from '../components/Badge';
import { gapAnalysisApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { GapAnalysisResult } from '../api/types';

type Scope = 'position' | 'team' | 'department' | 'company';

export default function GapAnalysisPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>(user?.role === 'MANAGER' ? 'team' : 'company');
  const [scopeId, setScopeId] = useState(user?.role === 'MANAGER' ? String(user.position_id ?? '') : '');
  const [result, setResult] = useState<GapAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await gapAnalysisApi.get(scope, scopeId || undefined);
      setResult(data);
    } catch {
      setError('Failed to load gap analysis.');
    } finally {
      setLoading(false);
    }
  }

  const totalGaps = result?.positions.reduce((sum, p) => sum + p.gaps.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Gap Analysis Report</h1>

      <form onSubmit={(e) => void runSearch(e)} className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-sm">
          Scope
          <select
            className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="position">Position</option>
            <option value="team">Team</option>
            <option value="department">Department</option>
            <option value="company">Company</option>
          </select>
        </label>
        {scope !== 'company' && (
          <label className="text-sm">
            {scope === 'department' ? 'Department name' : 'Id'}
            <input
              className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-orange-600 px-4 py-1.5 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Run'}
        </button>
      </form>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {result.positions.length} position(s), {totalGaps} gap(s) found.
          </p>
          {result.positions.map((p) => (
            <div key={p.position_id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">
                  {p.is_vacant ? 'Vacant' : p.employee_name} <span className="text-gray-400">— {p.role_title}, {p.department}</span>
                </div>
                {p.gaps.length === 0 && <span className="text-sm text-green-700">No gaps</span>}
              </div>
              {p.gaps.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {p.gaps.map((g) => (
                    <li key={g.skill_id} className="flex items-center gap-2">
                      <Badge value={g.gap_type} />
                      <span className="font-medium">{g.skill_name}</span>
                      <span className="text-gray-500">
                        requires {g.required_level}
                        {g.current_level ? `, has ${g.current_level}` : ', not rated'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
