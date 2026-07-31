import { Fragment, useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { proficiencyScalesApi, skillCategoriesApi, skillRatingsApi, skillsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getProficiencyLevels } from '../lib/proficiency';
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
  const { user } = useAuth();
  const isHRAdmin = user?.role === 'HR_ADMIN';
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

  const [levelsInput, setLevelsInput] = useState('');
  const [savingLevels, setSavingLevels] = useState(false);

  const [editingSkillId, setEditingSkillId] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [editingSkillDescriptions, setEditingSkillDescriptions] = useState<Record<string, string>>({});
  const [expandedSkillId, setExpandedSkillId] = useState<number | null>(null);

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
      setLevelsInput(scalesRes.results[0]?.levels.join(', ') ?? '');
    } catch {
      setError('Failed to load the skills taxonomy.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const levels = getProficiencyLevels(scales);

  function levelCountsForSkill(skillId: number): { level: string; count: number }[] {
    const counts: Record<string, number> = {};
    ratings.filter((r) => r.skill === skillId).forEach((r) => {
      counts[r.proficiency_level] = (counts[r.proficiency_level] ?? 0) + 1;
    });
    return levels.map((level) => ({ level, count: counts[level] ?? 0 }));
  }

  function namesAtLevel(skillId: number, level: string): string[] {
    return ratings.filter((r) => r.skill === skillId && r.proficiency_level === level).map((r) => r.employee_name);
  }

  function countCellTooltip(skill: Skill, level: string): string | undefined {
    const names = namesAtLevel(skill.id, level);
    return names.length > 0 ? `${level}: ${names.join(', ')}` : undefined;
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

  async function saveLevels() {
    const parsed = levelsInput
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;
    setSavingLevels(true);
    setError(null);
    try {
      const existing = scales[0];
      if (existing) {
        await proficiencyScalesApi.update(existing.id, { levels: parsed });
      }
      await load();
    } catch {
      setError('Failed to save proficiency levels.');
    } finally {
      setSavingLevels(false);
    }
  }

  function startEditingSkill(skill: Skill) {
    setEditingSkillId(skill.id);
    setEditingDescription(skill.description);
    setEditingSkillDescriptions({ ...skill.level_descriptions });
  }

  async function saveSkillEdits(skill: Skill) {
    const level_descriptions: Record<string, string> = {};
    levels.forEach((level) => {
      const desc = (editingSkillDescriptions[level] ?? '').trim();
      if (desc) level_descriptions[level] = desc;
    });
    await skillsApi.update(skill.id, { description: editingDescription.trim(), level_descriptions });
    setEditingSkillId(null);
    await load();
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Skills</h1>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Skills</h2>
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
                        {isHRAdmin && <th className="w-6" />}
                        <th className="w-40 p-2 font-normal">Name</th>
                        <th className="p-2 font-normal">Description</th>
                        {levels.map((level) => (
                          <th key={level} className="p-2 text-center font-normal">
                            {level}
                          </th>
                        ))}
                        {isHRAdmin && <th className="p-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {categorySkills.map((s) => (
                        <Fragment key={s.id}>
                          <tr
                            className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
                            onClick={() => setExpandedSkillId((prev) => (prev === s.id ? null : s.id))}
                            draggable={isHRAdmin}
                            onDragStart={isHRAdmin ? (e) => handleDragStart(e, 'text/skill-id', s.id) : undefined}
                            onDragOver={isHRAdmin ? allowDrop : undefined}
                            onDrop={
                              isHRAdmin
                                ? (e) => {
                                    e.preventDefault();
                                    const draggedId = Number(e.dataTransfer.getData('text/skill-id'));
                                    if (draggedId) void moveSkill(category.id, draggedId, s.id);
                                  }
                                : undefined
                            }
                          >
                            {isHRAdmin && (
                              <td className="p-2">
                                <DragHandle />
                              </td>
                            )}
                            <td className="p-2 font-medium">{s.name}</td>
                            <td className="p-2 text-gray-500">{s.description || '—'}</td>
                            {levelCountsForSkill(s.id).map(({ level, count }) => (
                              <td
                                key={level}
                                className="p-2 text-center text-gray-700"
                                title={countCellTooltip(s, level)}
                              >
                                {count}
                              </td>
                            ))}
                            {isHRAdmin && (
                              <td className="p-2 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (editingSkillId === s.id) {
                                      setEditingSkillId(null);
                                    } else {
                                      startEditingSkill(s);
                                    }
                                  }}
                                  className="text-xs text-orange-700 hover:underline"
                                >
                                  {editingSkillId === s.id ? 'Close' : 'Edit'}
                                </button>
                              </td>
                            )}
                          </tr>
                          {editingSkillId === s.id && (
                            <tr className="border-b border-gray-100 bg-gray-50 last:border-0">
                              <td />
                              <td colSpan={2 + levels.length + 1} className="p-3">
                                <div className="mb-3">
                                  <span className="mb-1 block text-xs font-medium text-gray-500">
                                    Description
                                  </span>
                                  <input
                                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                                    value={editingDescription}
                                    onChange={(e) => setEditingDescription(e.target.value)}
                                  />
                                </div>
                                <p className="mb-2 text-xs text-gray-500">
                                  What does each level mean for <span className="font-medium">{s.name}</span>?
                                </p>
                                <div className="space-y-2">
                                  {levels.map((level) => (
                                    <div key={level} className="flex items-center gap-2">
                                      <span className="w-28 shrink-0 text-sm font-medium text-gray-600">{level}</span>
                                      <input
                                        className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                                        value={editingSkillDescriptions[level] ?? ''}
                                        onChange={(e) =>
                                          setEditingSkillDescriptions((prev) => ({
                                            ...prev,
                                            [level]: e.target.value,
                                          }))
                                        }
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 flex gap-3 text-sm">
                                  <button
                                    onClick={() => void saveSkillEdits(s)}
                                    className="text-orange-700 hover:underline"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingSkillId(null)}
                                    className="text-gray-500 hover:underline"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {expandedSkillId === s.id && editingSkillId !== s.id && (
                            <tr className="border-b border-gray-100 bg-gray-50 last:border-0">
                              {isHRAdmin && <td />}
                              <td colSpan={2 + levels.length + (isHRAdmin ? 1 : 0)} className="p-3">
                                <div className="space-y-3 text-sm">
                                  {levels.map((level) => {
                                    const description = s.level_descriptions[level];
                                    const names = namesAtLevel(s.id, level);
                                    return (
                                      <div key={level}>
                                        <div className="font-medium text-gray-700">{level}</div>
                                        {description && <p className="text-gray-500">{description}</p>}
                                        {names.length > 0 ? (
                                          <p className="text-blue-600">{names.join(', ')}</p>
                                        ) : (
                                          <p className="text-gray-500">No one rated at this level yet.</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
        {isHRAdmin && (
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
        )}
      </section>

      {isHRAdmin && (
      <>
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Proficiency levels</h2>
        <p className="mb-3 text-sm text-gray-500">
          Every skill shares this same set of levels, low to high — what each one actually <em>means</em> is
          set per skill above.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <input
            className="min-w-80 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={levelsInput}
            onChange={(e) => setLevelsInput(e.target.value)}
          />
          <button
            onClick={() => void saveLevels()}
            disabled={savingLevels}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            Save levels
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
      </>
      )}
    </div>
  );
}
