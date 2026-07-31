import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgChartApi, positionRequirementsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { OrgChartNode, PositionRequirement } from '../api/types';

function OrgNode({
  node,
  selectedId,
  onSelect,
  canEdit,
}: {
  node: OrgChartNode;
  selectedId: number | null;
  onSelect: (node: OrgChartNode) => void;
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  const isSelected = node.id === selectedId;
  return (
    <li className="ml-4 border-l border-gray-200 pl-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect(node);
        }}
        className={`mb-2 flex w-full items-start justify-between gap-2 rounded-lg border p-3 text-left ${
          isSelected
            ? 'border-orange-400 bg-orange-50'
            : node.is_vacant
              ? 'border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100'
              : 'border-gray-200 bg-white hover:bg-gray-50'
        }`}
      >
        <div>
          <div className="font-medium">{node.role_title}</div>
          <div className="text-sm text-gray-500">{node.is_vacant ? 'Vacant' : node.employee_name}</div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/requirements?position=${node.id}`);
            }}
            className="shrink-0 text-xs text-orange-700 hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      {node.direct_reports.length > 0 && (
        <ul>
          {node.direct_reports.map((child) => (
            <OrgNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgChartPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'MANAGER' || user?.role === 'HR_ADMIN';
  const [tree, setTree] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrgChartNode | null>(null);
  const [requirements, setRequirements] = useState<PositionRequirement[]>([]);
  const [loadingRequirements, setLoadingRequirements] = useState(false);

  useEffect(() => {
    orgChartApi
      .get()
      .then(setTree)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) {
      setRequirements([]);
      return;
    }
    setLoadingRequirements(true);
    positionRequirementsApi
      .list({ position: selected.id })
      .then((res) => setRequirements(res.results))
      .finally(() => setLoadingRequirements(false));
  }, [selected]);

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Org Chart</h1>
      <div className="flex gap-8">
        <div className="flex-1">
          <ul>
            {tree.map((root) => (
              <OrgNode key={root.id} node={root} selectedId={selected?.id ?? null} onSelect={setSelected} canEdit={canEdit} />
            ))}
          </ul>
        </div>
        <div className="w-80 shrink-0">
          <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-4">
            {!selected ? (
              <p className="text-sm text-gray-500">Select a position to see its required skills.</p>
            ) : (
              <>
                <div className="mb-3 font-medium">{selected.role_title}</div>
                {loadingRequirements ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : requirements.length === 0 ? (
                  <p className="text-sm text-gray-400">No skill requirements set for this position.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {requirements.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <span>{r.skill_name}</span>
                        <span className="text-gray-500">
                          {r.min_proficiency}
                          {!r.required && <span className="ml-1 text-gray-400">(nice-to-have)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
