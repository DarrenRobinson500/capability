import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { proficiencyScalesApi, skillCategoriesApi, skillRatingsApi, skillsApi } from '../api/client';
import { getLevelsForSkill } from '../lib/proficiency';
import type { ProficiencyScale, Skill, SkillCategory, SkillRating } from '../api/types';

function reorderArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...arr];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

function DragHandle() {
  return (
    <span className="cursor-grab select-none px-1 text-gray-400 hover:text-gray-600" title="Drag to reorder">
      ⠿
    </span>
  );
}

export default function SkillsAdminPage() {
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [scales, setScales] = useState<ProficiencyScale[]>([]);
  const [ratings, setRatings] = useState<SkillRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<number | ''>('');
  const [newSkillDescription, setNewSkillDescription] = useState('');

  const [scaleSkill, setScaleSkill] = useState<number | ''>('');
  const [scaleLevels, setScaleLevels] = useState('');
  const [scaleDescriptions, setScaleDescriptions] = useState<Record<string, string>>({});

  const [editingScaleId, setEditingScaleId] = useState<number | null>(null);
  const [editingDescriptions, setEditingDescriptions] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const [categoriesRes, skillsRes, scalesRes, ratingsRes] = await Promise.all([
        skillCategoriesApi.list(),
        skillsApi.list(),
        proficiencyScalesApi.list(),
        skillRatingsApi.list(),
      ]);
      setCategories(categoriesRes.results);
      setSkills(skillsRes.results);
      setScales(scalesRes.results);
      setRatings(ratingsRes.results);
    } catch {
      setError('Failed to load the skills taxonomy.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function levelCountsForSkill(skillId: number): { level: string; count: number }[] {
    const levels = getLevelsForSkill(skillId, scales);
    const counts: Record<string, number> = {};
    ratings.filter((r) => r.skill === skillId).forEach((r) => {
      counts[r.proficiency_level] = (counts[r.proficiency_level] ?? 0) + 1;
    });
    return levels.map((level) => ({ level, count: counts[level] ?? 0 }));
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    await skillCategoriesApi.create({ name: newCategoryName.trim() });
    setNewCategoryName('');
    await load();
  }

  async function addSkill() {
    if (!newSkillName.trim() || !newSkillCategory) return;
    await skillsApi.create({
      name: newSkillName.trim(),
      category: newSkillCategory as number,
      description: newSkillDescription,
    });
    setNewSkillName('');
    setNewSkillCategory('');
    setNewSkillDescription('');
    await load();
  }

  async function moveCategory(draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const fromIndex = categories.findIndex((c) => c.id === draggedId);
    const toIndex = categories.findIndex((c) => c.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = reorderArray(categories, fromIndex, toIndex);
    setCategories(reordered);
    try {
      await skillCategoriesApi.reorder(reordered.map((c) => c.id));
    } catch {
      setError('Failed to save category order.');
    } finally {
      await load();
    }
  }

  async function moveSkill(categoryId: number, draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const categorySkills = skills.filter((s) => s.category === categoryId);
    const fromIndex = categorySkills.findIndex((s) => s.id === draggedId);
    const toIndex = categorySkills.findIndex((s) => s.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const reorderedCategorySkills = reorderArray(categorySkills, fromIndex, toIndex);
    const otherSkills = skills.filter((s) => s.category !== categoryId);
    setSkills([...otherSkills, ...reorderedCategorySkills]);
    try {
      await skillsApi.reorder(categoryId, reorderedCategorySkills.map((s) => s.id));
    } catch {
      setError('Failed to save skill order.');
    } finally {
      await load();
    }
  }

  function handleDragStart(e: DragEvent, dataType: string, id: number) {
    e.dataTransfer.setData(dataType, String(id));
    e.dataTransfer.effectAllowed = 'move';
  }

  function allowDrop(e: DragEvent) {
    e.preventDefault();
  }

  const parsedNewLevels = scaleLevels
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);

  function handleScaleLevelsChange(raw: string) {
    setScaleLevels(raw);
    const parsed = raw
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    // keep whatever the admin already typed for a level that's still present;
    // drop descriptions for levels that got removed/renamed
    setScaleDescriptions((prev) => {
      const next: Record<string, string> = {};
      parsed.forEach((level) => {
        next[level] = prev[level] ?? '';
      });
      return next;
    });
  }

  async function addScale() {
    if (parsedNewLevels.length === 0) return;
    const level_descriptions: Record<string, string> = {};
    parsedNewLevels.forEach((level) => {
      const desc = (scaleDescriptions[level] ?? '').trim();
      if (desc) level_descriptions[level] = desc;
    });
    await proficiencyScalesApi.create({ skill: scaleSkill || null, levels: parsedNewLevels, level_descriptions });
    setScaleSkill('');
    setScaleLevels('');
    setScaleDescriptions({});
    await load();
  }

  function startEditingScale(scale: ProficiencyScale) {
    setEditingScaleId(scale.id);
    setEditingDescriptions({ ...scale.level_descriptions });
  }

  async function saveScaleDescriptions(scale: ProficiencyScale) {
    const level_descriptions: Record<string, string> = {};
    scale.levels.forEach((level) => {
      const desc = (editingDescriptions[level] ?? '').trim();
      if (desc) level_descriptions[level] = desc;
    });
    await proficiencyScalesApi.update(scale.id, { level_descriptions });
    setEditingScaleId(null);
    await load();
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Skills</h1>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Skills</h2>
        <p className="mb-3 text-sm text-gray-500">
          Drag <span className="text-gray-400">⠿</span> to reorder skills within a category — this order is
          what everyone sees.
        </p>
        <div className="mb-3 space-y-4">
          {categories.map((category) => {
            const categorySkills = skills.filter((s) => s.category === category.id);
            return (
              <div key={category.id}>
                <h3 className="mb-1 text-sm font-semibold text-gray-700">{category.name}</h3>
                {categorySkills.length === 0 ? (
                  <p className="pl-2 text-sm text-gray-400">No skills yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-gray-400">
                      <tr>
                        <th className="w-6" />
                        <th className="w-40 p-2 font-normal">Name</th>
                        <th className="p-2 font-normal">Description</th>
                        <th className="p-2 font-normal">Who has it, by level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorySkills.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-gray-100 last:border-0"
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'text/skill-id', s.id)}
                          onDragOver={allowDrop}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedId = Number(e.dataTransfer.getData('text/skill-id'));
                            if (draggedId) void moveSkill(category.id, draggedId, s.id);
                          }}
                        >
                          <td className="p-2">
                            <DragHandle />
                          </td>
                          <td className="p-2 font-medium">{s.name}</td>
                          <td className="p-2 text-gray-500">{s.description || '—'}</td>
                          <td className="p-2 text-gray-500">
                            {levelCountsForSkill(s.id)
                              .map(({ level, count }) => `${level} ${count}`)
                              .join(' · ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <input
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="New skill name"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
          />
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={newSkillCategory}
            onChange={(e) => setNewSkillCategory(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Description (optional)"
            value={newSkillDescription}
            onChange={(e) => setNewSkillDescription(e.target.value)}
          />
          <button
            onClick={() => void addSkill()}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            Add skill
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Skill categories</h2>
        <p className="mb-3 text-sm text-gray-500">
          Drag <span className="text-gray-400">⠿</span> to reorder categories — this is also the order they
          appear in above and throughout the app.
        </p>
        <ul className="mb-3 space-y-1">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm"
              draggable
              onDragStart={(e) => handleDragStart(e, 'text/category-id', c.id)}
              onDragOver={allowDrop}
              onDrop={(e) => {
                e.preventDefault();
                const draggedId = Number(e.dataTransfer.getData('text/category-id'));
                if (draggedId) void moveCategory(draggedId, c.id);
              }}
            >
              <DragHandle />
              {c.name}
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-3">
          <input
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button
            onClick={() => void addCategory()}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            Add category
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Proficiency scales</h2>
        <p className="mb-3 text-sm text-gray-500">
          Each level can have a description explaining what it actually means — this shows up wherever
          someone picks a level (self-assessments, position requirements, capability search).
        </p>

        <ul className="mb-4 space-y-3">
          {scales.map((s) => (
            <li key={s.id} className="rounded-lg border border-gray-100 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {s.skill ? (skills.find((sk) => sk.id === s.skill)?.name ?? 'Unknown skill') : 'Global default'}
                </span>
                {editingScaleId === s.id ? (
                  <div className="flex gap-3 text-sm">
                    <button onClick={() => void saveScaleDescriptions(s)} className="text-orange-700 hover:underline">
                      Save
                    </button>
                    <button onClick={() => setEditingScaleId(null)} className="text-gray-500 hover:underline">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => startEditingScale(s)} className="text-sm text-orange-700 hover:underline">
                    Edit descriptions
                  </button>
                )}
              </div>
              <ul className="space-y-1 text-sm">
                {s.levels.map((level) => (
                  <li key={level} className="flex items-baseline gap-2">
                    <span className="w-28 shrink-0 font-medium text-gray-600">{level}</span>
                    {editingScaleId === s.id ? (
                      <input
                        className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        placeholder="What does this level mean?"
                        value={editingDescriptions[level] ?? ''}
                        onChange={(e) => setEditingDescriptions((prev) => ({ ...prev, [level]: e.target.value }))}
                      />
                    ) : (
                      <span className="text-gray-500">{s.level_descriptions[level] || '—'}</span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-3">
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={scaleSkill}
            onChange={(e) => setScaleSkill(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Global default scale</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Levels, comma separated (low to high)"
            value={scaleLevels}
            onChange={(e) => handleScaleLevelsChange(e.target.value)}
          />
          <button
            onClick={() => void addScale()}
            disabled={parsedNewLevels.length === 0}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            Add scale
          </button>
        </div>
        {parsedNewLevels.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-gray-500">Optionally describe what each level means:</p>
            {parsedNewLevels.map((level) => (
              <div key={level} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-sm font-medium text-gray-600">{level}</span>
                <input
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  value={scaleDescriptions[level] ?? ''}
                  onChange={(e) => setScaleDescriptions((prev) => ({ ...prev, [level]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
