interface DepartmentInfo {
  name: string;
  headCount: number;
  lead: string;
  description: string;
  recentProjects: string[];
}

const DEPARTMENTS: Record<string, DepartmentInfo> = {
  engineering: {
    name: 'Engineering',
    headCount: 48,
    lead: 'Sarah Chen',
    description:
      'Responsible for all software development, infrastructure, and technical architecture. The team follows agile methodology with two-week sprints.',
    recentProjects: [
      'Cloud migration to AWS',
      'API v3 redesign',
      'Internal developer portal',
    ],
  },
  marketing: {
    name: 'Marketing',
    headCount: 22,
    lead: 'James Rodriguez',
    description:
      'Handles brand strategy, digital marketing, content creation, and demand generation. Works closely with Sales on lead qualification.',
    recentProjects: [
      'Q1 product launch campaign',
      'Website redesign',
      'Social media analytics dashboard',
    ],
  },
  sales: {
    name: 'Sales',
    headCount: 35,
    lead: 'Emily Nakamura',
    description:
      'Manages enterprise and SMB sales pipelines. The team is split into inbound and outbound groups with dedicated solution engineers.',
    recentProjects: [
      'CRM migration to Salesforce',
      'Partner channel program',
      'Sales enablement training',
    ],
  },
  hr: {
    name: 'Human Resources',
    headCount: 12,
    lead: 'Michael O\'Brien',
    description:
      'Oversees recruitment, employee relations, benefits administration, and company culture initiatives.',
    recentProjects: [
      'Remote work policy update',
      'DEI training program',
      'Performance review system overhaul',
    ],
  },
  finance: {
    name: 'Finance',
    headCount: 15,
    lead: 'Priya Patel',
    description:
      'Responsible for financial planning and analysis, accounting, budgeting, and compliance. Reports directly to the CFO.',
    recentProjects: [
      'Annual budget planning FY2026',
      'Expense management automation',
      'SOX compliance audit',
    ],
  },
};

export function getDepartmentInfo(departmentName: string): DepartmentInfo | null {
  const key = departmentName.toLowerCase().replace(/\s+/g, '');
  // Also match common aliases
  const aliases: Record<string, string> = {
    eng: 'engineering',
    dev: 'engineering',
    development: 'engineering',
    mktg: 'marketing',
    humanresources: 'hr',
    people: 'hr',
    fin: 'finance',
    accounting: 'finance',
  };
  const resolved = aliases[key] ?? key;
  return DEPARTMENTS[resolved] ?? null;
}

export function getAvailableDepartments(): string[] {
  return Object.values(DEPARTMENTS).map((d) => d.name);
}
