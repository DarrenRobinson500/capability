import { useEffect, useState } from 'react';
import { employeesApi, positionsApi, rolesApi } from '../api/client';
import type { Employee, Position, RoleTemplate } from '../api/types';

export default function OrgStructureBuilderPage() {
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleTitle, setRoleTitle] = useState('');
  const [roleLevel, setRoleLevel] = useState('');
  const [roleParent, setRoleParent] = useState<number | ''>('');
  const [roleDescription, setRoleDescription] = useState('');

  const [posRole, setPosRole] = useState<number | ''>('');
  const [posParent, setPosParent] = useState<number | ''>('');
  const [posDepartment, setPosDepartment] = useState('');
  const [posEmployee, setPosEmployee] = useState<number | ''>('');

  async function load() {
    setLoading(true);
    try {
      const [rolesRes, positionsRes, employeesRes] = await Promise.all([
        rolesApi.list(),
        positionsApi.list(),
        employeesApi.list(),
      ]);
      setRoles(rolesRes.results);
      setPositions(positionsRes.results);
      setEmployees(employeesRes.results);
    } catch {
      setError('Failed to load org structure data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addRole() {
    if (!roleTitle.trim() || roleLevel === '') return;
    await rolesApi.create({
      title: roleTitle.trim(),
      level: Number(roleLevel),
      parent_role: roleParent || null,
      description: roleDescription,
    });
    setRoleTitle('');
    setRoleLevel('');
    setRoleParent('');
    setRoleDescription('');
    await load();
  }

  async function addPosition() {
    if (!posRole || !posDepartment.trim()) return;
    setError(null);
    try {
      await positionsApi.create({
        role: posRole as number,
        parent_position: posParent || null,
        department: posDepartment.trim(),
        employee: posEmployee || null,
      });
      setPosRole('');
      setPosParent('');
      setPosDepartment('');
      setPosEmployee('');
      await load();
    } catch {
      setError('Failed to create position — check for a reporting-line cycle.');
    }
  }

  async function reassignEmployee(position: Position, employeeId: number | '') {
    setError(null);
    try {
      await positionsApi.update(position.id, { employee: employeeId || null });
      await load();
    } catch {
      setError('Failed to update assignment.');
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Org Structure Builder</h1>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Role templates</h2>
        <table className="mb-3 w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-500">
            <tr>
              <th className="p-2">Title</th>
              <th className="p-2">Level</th>
              <th className="p-2">Career-ladder parent</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 last:border-0">
                <td className="p-2 font-medium">{r.title}</td>
                <td className="p-2">{r.level}</td>
                <td className="p-2 text-gray-500">{roles.find((p) => p.id === r.parent_role)?.title ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-end gap-3">
          <input
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Title"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          />
          <input
            type="number"
            className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Level"
            value={roleLevel}
            onChange={(e) => setRoleLevel(e.target.value)}
          />
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={roleParent}
            onChange={(e) => setRoleParent(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">No career-ladder parent</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Description (optional)"
            value={roleDescription}
            onChange={(e) => setRoleDescription(e.target.value)}
          />
          <button
            onClick={() => void addRole()}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            Add role
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Positions</h2>
        <table className="mb-3 w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-500">
            <tr>
              <th className="p-2">Role</th>
              <th className="p-2">Department</th>
              <th className="p-2">Reports to</th>
              <th className="p-2">Employee</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0">
                <td className="p-2 font-medium">{p.role_title}</td>
                <td className="p-2">{p.department}</td>
                <td className="p-2 text-gray-500">
                  {positions.find((parent) => parent.id === p.parent_position)?.role_title ?? '— (root)'}
                </td>
                <td className="p-2">
                  <select
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    value={p.employee ?? ''}
                    onChange={(e) => void reassignEmployee(p, e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Vacant</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-end gap-3">
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={posRole}
            onChange={(e) => setPosRole(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={posParent}
            onChange={(e) => setPosParent(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">No parent (root)</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.role_title} — {p.department}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Department"
            value={posDepartment}
            onChange={(e) => setPosDepartment(e.target.value)}
          />
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={posEmployee}
            onChange={(e) => setPosEmployee(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Vacant</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void addPosition()}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            Add position
          </button>
        </div>
      </section>
    </div>
  );
}
