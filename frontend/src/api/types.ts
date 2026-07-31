export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'EXECUTIVE';

export interface CurrentUser {
  id: number;
  username: string;
  role: UserRole | null;
  employee_id: number | null;
  employee_name: string | null;
  position_id: number | null;
  is_staff: boolean;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface RoleTemplate {
  id: number;
  title: string;
  level: number;
  parent_role: number | null;
  description: string;
}

export interface Position {
  id: number;
  role: number;
  role_title: string;
  parent_position: number | null;
  department: string;
  employee: number | null;
  employee_name: string | null;
  is_vacant: boolean;
}

export interface Employee {
  id: number;
  user: number | null;
  name: string;
  location: string;
  position_id: number | null;
}

export interface Profile {
  id: number;
  user: number;
  username: string;
  role: UserRole;
}

export interface SkillCategory {
  id: number;
  name: string;
  parent_category: number | null;
  order: number;
}

export interface Skill {
  id: number;
  name: string;
  category: number;
  category_name: string;
  description: string;
  taxonomy_version: number;
  order: number;
}

export interface ProficiencyScale {
  id: number;
  skill: number | null;
  levels: string[];
  level_descriptions: Record<string, string>;
}

export type SkillRatingSource = 'SELF' | 'MANAGER_ENDORSED' | 'MANAGER_ADJUSTED';

export interface SkillRating {
  id: number;
  employee: number;
  employee_name: string;
  skill: number;
  skill_name: string;
  proficiency_level: string;
  source: SkillRatingSource;
  evidence: string;
  rated_at: string;
}

export interface PositionRequirement {
  id: number;
  position: number;
  skill: number;
  skill_name: string;
  min_proficiency: string;
  required: boolean;
  defined_by: number | null;
}

export interface Certification {
  id: number;
  name: string;
  issuing_body: string;
  validity_period_months: number | null;
  related_skill: number | null;
}

export type CertificationStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING_RENEWAL';

export interface EmployeeCertification {
  id: number;
  employee: number;
  employee_name: string;
  certification: number;
  certification_name: string;
  issued_at: string;
  expires_at: string | null;
  status: CertificationStatus;
}

export interface LearningResource {
  id: number;
  title: string;
  provider_url: string;
  skill: number;
  skill_name: string;
  level: string;
}

export interface Assignment {
  id: number;
  name: string;
  required_skills: number[];
  start_date: string | null;
  end_date: string | null;
}

export interface OrgChartNode {
  id: number;
  role_id: number;
  role_title: string;
  department: string;
  employee_id: number | null;
  employee_name: string | null;
  is_vacant: boolean;
  direct_reports: OrgChartNode[];
}

export type GapType = 'missing' | 'below_minimum' | 'vacant_requirement';

export interface Gap {
  skill_id: number;
  skill_name: string;
  required_level: string;
  current_level: string | null;
  required: boolean;
  gap_type: GapType;
}

export interface GapAnalysisPosition {
  position_id: number;
  department: string;
  role_title: string;
  employee_id: number | null;
  employee_name: string | null;
  is_vacant: boolean;
  gaps: Gap[];
}

export interface GapAnalysisResult {
  scope: string;
  positions: GapAnalysisPosition[];
}

export interface CapabilitySearchResult {
  employee_id: number;
  employee_name: string;
  proficiency_level: string;
  source: SkillRatingSource;
}

export interface PositionRequirementsOverviewEntry {
  role_id: number;
  role_title: string;
  requirements: {
    position_id: number;
    department: string;
    skill_id: number;
    skill_name: string;
    min_proficiency: string;
    required: boolean;
  }[];
}

export interface DashboardSummary {
  total_positions: number;
  vacant_positions: number;
  bench_count: number;
  certification_counts: Record<CertificationStatus, number>;
  by_department: { department: string; total: number; vacant: number }[];
}

export interface CreateUserPayload {
  username: string;
  password: string;
  role: UserRole;
  employee_name?: string;
  location?: string;
}

export interface CreatedUser {
  id: number;
  username: string;
  role: UserRole;
  employee_id: number | null;
  employee_name: string | null;
}
