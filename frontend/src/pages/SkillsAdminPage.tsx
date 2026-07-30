import { useEffect, useState } from 'react';
import { proficiencyScalesApi, skillCategoriesApi, skillsApi } from '../api/client';
import type { ProficiencyScale, Skill, SkillCategory } from '../api/types';

export default function SkillsAdminPage() {
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [scales, setScales] = useState<ProficiencyScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<number | ''>('');
  const [newSkillDescription, setNewSkillDescription] = useState('');
  const [scaleSkill, setScaleSkill] = useState<number | ''>('');
  const [scaleLevels, setScaleLevels] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [categoriesRes, skillsRes, scalesRes] = await Promise.all([
        skillCategoriesApi.list(),
        skillsApi.list(),
        proficiencyScalesApi.list(),
      ]);
      setCategories(categoriesRes.results);
      setSkills(skillsRes.results);
      setScales(scalesRes.results);
    } catch {
      setError('Failed to load the skills taxonomy.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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

  async function addScale() {
    const levels = scaleLevels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    if (levels.length === 0) return;
    await proficiencyScalesApi.create({ skill: scaleSkill || null, levels });
    setScaleSkill('');
    setScaleLevels('');
    await load();
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Skills Taxonomy Admin</h1>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Skill categories</h2>
        <ul className="mb-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id} className="rounded-full bg-gray-100 px-3 py-1 text-sm">
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
        <h2 className="mb-3 font-medium">Skills</h2>
        <table className="mb-3 w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-500">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Category</th>
              <th className="p-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0">
                <td className="p-2 font-medium">{s.name}</td>
                <td className="p-2 text-gray-500">{s.category_name}</td>
                <td className="p-2 text-gray-500">{s.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <h2 className="mb-3 font-medium">Proficiency scales</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {scales.map((s) => (
            <li key={s.id}>
              <span className="font-medium">{s.skill ? skills.find((sk) => sk.id === s.skill)?.name : 'Global default'}</span>
              : {s.levels.join(' → ')}
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
            onChange={(e) => setScaleLevels(e.target.value)}
          />
          <button
            onClick={() => void addScale()}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            Add scale
          </button>
        </div>
      </section>
    </div>
  );
}
