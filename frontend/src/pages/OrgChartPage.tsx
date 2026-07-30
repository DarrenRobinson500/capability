import { useEffect, useState } from 'react';
import { orgChartApi } from '../api/client';
import type { OrgChartNode } from '../api/types';

function OrgNode({ node }: { node: OrgChartNode }) {
  return (
    <li className="ml-4 border-l border-gray-200 pl-4">
      <div
        className={`mb-2 inline-block rounded-lg border p-3 ${
          node.is_vacant ? 'border-dashed border-gray-300 bg-gray-50 text-gray-500' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="font-medium">{node.is_vacant ? 'Vacant' : node.employee_name}</div>
        <div className="text-sm text-gray-500">
          {node.role_title} · {node.department}
        </div>
      </div>
      {node.direct_reports.length > 0 && (
        <ul>
          {node.direct_reports.map((child) => (
            <OrgNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgChartPage() {
  const [tree, setTree] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orgChartApi
      .get()
      .then(setTree)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Org Chart</h1>
      <ul>
        {tree.map((root) => (
          <OrgNode key={root.id} node={root} />
        ))}
      </ul>
    </div>
  );
}
