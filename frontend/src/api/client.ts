import type {
  Assignment,
  CapabilitySearchResult,
  Certification,
  CreatedUser,
  CreateUserPayload,
  CurrentUser,
  DashboardSummary,
  Employee,
  EmployeeCertification,
  GapAnalysisResult,
  LearningResource,
  OrgChartNode,
  Paginated,
  Position,
  PositionRequirement,
  PositionRequirementsOverviewEntry,
  ProficiencyScale,
  Profile,
  RoleTemplate,
  Skill,
  SkillCategory,
  SkillRating,
} from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) headers.set('X-CSRFToken', csrfToken);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const data: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }
  return data as T;
}

const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: (path: string) => apiFetch<void>(path, { method: 'DELETE' }),
};

export const auth = {
  csrf: () => api.get<{ detail: string }>('/auth/csrf/'),
  login: (username: string, password: string) =>
    api.post<CurrentUser>('/auth/login/', { username, password }),
  logout: () => api.post<{ detail: string }>('/auth/logout/'),
  me: () => api.get<CurrentUser>('/auth/me/'),
};

export const usersApi = {
  create: (data: CreateUserPayload) => api.post<CreatedUser>('/users/create/', data),
};

export const rolesApi = {
  list: () => api.get<Paginated<RoleTemplate>>('/roles/'),
  create: (data: Partial<RoleTemplate>) => api.post<RoleTemplate>('/roles/', data),
  update: (id: number, data: Partial<RoleTemplate>) => api.patch<RoleTemplate>(`/roles/${id}/`, data),
  delete: (id: number) => api.delete(`/roles/${id}/`),
};

export const positionsApi = {
  list: () => api.get<Paginated<Position>>('/positions/'),
  create: (data: Partial<Position>) => api.post<Position>('/positions/', data),
  update: (id: number, data: Partial<Position>) => api.patch<Position>(`/positions/${id}/`, data),
  delete: (id: number) => api.delete(`/positions/${id}/`),
};

export const employeesApi = {
  list: () => api.get<Paginated<Employee>>('/employees/'),
  create: (data: Partial<Employee>) => api.post<Employee>('/employees/', data),
  update: (id: number, data: Partial<Employee>) => api.patch<Employee>(`/employees/${id}/`, data),
};

export const profilesApi = {
  list: () => api.get<Paginated<Profile>>('/profiles/'),
  update: (id: number, data: Partial<Profile>) => api.patch<Profile>(`/profiles/${id}/`, data),
};

export const skillCategoriesApi = {
  list: () => api.get<Paginated<SkillCategory>>('/skill-categories/'),
  create: (data: Partial<SkillCategory>) => api.post<SkillCategory>('/skill-categories/', data),
  update: (id: number, data: Partial<SkillCategory>) =>
    api.patch<SkillCategory>(`/skill-categories/${id}/`, data),
  delete: (id: number) => api.delete(`/skill-categories/${id}/`),
  reorder: (orderedIds: number[]) =>
    api.post<{ detail: string }>('/skill-categories/reorder/', { ordered_ids: orderedIds }),
};

export const skillsApi = {
  list: () => api.get<Paginated<Skill>>('/skills/'),
  create: (data: Partial<Skill>) => api.post<Skill>('/skills/', data),
  update: (id: number, data: Partial<Skill>) => api.patch<Skill>(`/skills/${id}/`, data),
  delete: (id: number) => api.delete(`/skills/${id}/`),
  reorder: (category: number, orderedIds: number[]) =>
    api.post<{ detail: string }>('/skills/reorder/', { category, ordered_ids: orderedIds }),
};

export const proficiencyScalesApi = {
  // Singleton — there is only ever one row; no create/delete.
  list: () => api.get<Paginated<ProficiencyScale>>('/proficiency-scales/'),
  update: (id: number, data: Partial<ProficiencyScale>) =>
    api.patch<ProficiencyScale>(`/proficiency-scales/${id}/`, data),
};

export const skillRatingsApi = {
  list: (params?: { employee?: number }) =>
    api.get<Paginated<SkillRating>>(`/skill-ratings/${params?.employee ? `?employee=${params.employee}` : ''}`),
  create: (data: { skill: number; proficiency_level: string; evidence?: string }) =>
    api.post<SkillRating>('/skill-ratings/', data),
  update: (id: number, data: Partial<SkillRating>) => api.patch<SkillRating>(`/skill-ratings/${id}/`, data),
  endorse: (id: number, proficiency_level?: string) =>
    api.post<SkillRating>(`/skill-ratings/${id}/endorse/`, proficiency_level ? { proficiency_level } : {}),
};

export const positionRequirementsApi = {
  list: (params?: { position?: number }) =>
    api.get<Paginated<PositionRequirement>>(
      `/position-requirements/${params?.position ? `?position=${params.position}` : ''}`
    ),
  create: (data: Partial<PositionRequirement>) => api.post<PositionRequirement>('/position-requirements/', data),
  update: (id: number, data: Partial<PositionRequirement>) =>
    api.patch<PositionRequirement>(`/position-requirements/${id}/`, data),
  delete: (id: number) => api.delete(`/position-requirements/${id}/`),
};

export const certificationsApi = {
  list: () => api.get<Paginated<Certification>>('/certifications/'),
  create: (data: Partial<Certification>) => api.post<Certification>('/certifications/', data),
  update: (id: number, data: Partial<Certification>) => api.patch<Certification>(`/certifications/${id}/`, data),
  delete: (id: number) => api.delete(`/certifications/${id}/`),
};

export const employeeCertificationsApi = {
  list: () => api.get<Paginated<EmployeeCertification>>('/employee-certifications/'),
  create: (data: Partial<EmployeeCertification>) =>
    api.post<EmployeeCertification>('/employee-certifications/', data),
  update: (id: number, data: Partial<EmployeeCertification>) =>
    api.patch<EmployeeCertification>(`/employee-certifications/${id}/`, data),
};

export const learningResourcesApi = {
  list: () => api.get<Paginated<LearningResource>>('/learning-resources/'),
  create: (data: Partial<LearningResource>) => api.post<LearningResource>('/learning-resources/', data),
  update: (id: number, data: Partial<LearningResource>) =>
    api.patch<LearningResource>(`/learning-resources/${id}/`, data),
  delete: (id: number) => api.delete(`/learning-resources/${id}/`),
};

export const assignmentsApi = {
  list: () => api.get<Paginated<Assignment>>('/assignments/'),
};

export const orgChartApi = {
  get: () => api.get<OrgChartNode[]>('/org-chart/'),
};

export const gapAnalysisApi = {
  get: (scope: 'position' | 'team' | 'department' | 'company', id?: number | string) =>
    api.get<GapAnalysisResult>(`/gap-analysis/?scope=${scope}${id !== undefined ? `&id=${id}` : ''}`),
};

export const capabilitySearchApi = {
  search: (skill: number, minLevel?: string) =>
    api.get<CapabilitySearchResult[]>(
      `/capability-search/?skill=${skill}${minLevel ? `&min_level=${encodeURIComponent(minLevel)}` : ''}`
    ),
};

export const positionRequirementsOverviewApi = {
  get: () => api.get<PositionRequirementsOverviewEntry[]>('/position-requirements-overview/'),
};

export const dashboardSummaryApi = {
  get: () => api.get<DashboardSummary>('/dashboard-summary/'),
};
