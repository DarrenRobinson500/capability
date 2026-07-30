import { useEffect, useState } from 'react';
import Badge from '../components/Badge';
import { certificationsApi, employeeCertificationsApi, employeesApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Certification, Employee, EmployeeCertification } from '../api/types';

export default function CertificationsPage() {
  const { user } = useAuth();
  const isHRAdmin = user?.role === 'HR_ADMIN';
  const [records, setRecords] = useState<EmployeeCertification[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEmployee, setNewEmployee] = useState<number | ''>('');
  const [newCertification, setNewCertification] = useState<number | ''>('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const calls: [Promise<{ results: EmployeeCertification[] }>, Promise<{ results: Certification[] }>, Promise<{ results: Employee[] } | null>] = [
        employeeCertificationsApi.list(),
        certificationsApi.list(),
        isHRAdmin ? employeesApi.list() : Promise.resolve(null),
      ];
      const [recordsRes, certsRes, employeesRes] = await Promise.all(calls);
      setRecords(recordsRes.results);
      setCertifications(certsRes.results);
      if (employeesRes) setEmployees(employeesRes.results);
    } catch {
      setError('Failed to load certifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHRAdmin]);

  async function handleAdd() {
    if (!newEmployee || !newCertification || !issuedAt) return;
    setSaving(true);
    setError(null);
    try {
      await employeeCertificationsApi.create({
        employee: newEmployee as number,
        certification: newCertification as number,
        issued_at: issuedAt,
        expires_at: expiresAt || null,
      });
      setNewEmployee('');
      setNewCertification('');
      setIssuedAt('');
      setExpiresAt('');
      await load();
    } catch {
      setError('Failed to add certification record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Certifications Tracker</h1>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {isHRAdmin && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 font-medium">Record a certification</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Employee
              <select
                className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
                value={newEmployee}
                onChange={(e) => setNewEmployee(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Certification
              <select
                className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
                value={newCertification}
                onChange={(e) => setNewCertification(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select…</option>
                {certifications.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Issued
              <input
                type="date"
                className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Expires (optional)
              <input
                type="date"
                className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <button
              onClick={() => void handleAdd()}
              disabled={!newEmployee || !newCertification || !issuedAt || saving}
              className="rounded-md bg-orange-600 px-4 py-1.5 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-gray-500">Loading…</p>
        ) : records.length === 0 ? (
          <p className="p-4 text-gray-500">No certifications on record.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                {isHRAdmin && <th className="p-3">Employee</th>}
                <th className="p-3">Certification</th>
                <th className="p-3">Issued</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  {isHRAdmin && <td className="p-3 font-medium">{r.employee_name}</td>}
                  <td className="p-3">{r.certification_name}</td>
                  <td className="p-3">{r.issued_at}</td>
                  <td className="p-3">{r.expires_at ?? 'Never'}</td>
                  <td className="p-3">
                    <Badge value={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
