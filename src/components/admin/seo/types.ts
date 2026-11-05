/** Client-safe mirrors of the `POST /api/admin/seo/audit` response. */

export type SeoIssueRow = {
  path: string;
  detail: string;
};

export type SeoDuplicateRow = {
  title: string;
  paths: string[];
  detail: string;
};

export type SeoDuplicateDescriptionRow = {
  description: string;
  paths: string[];
  detail: string;
};

export type SeoAuditIssues = {
  pageStatus: SeoIssueRow[];
  fetchErrors: SeoIssueRow[];
  redirects: SeoIssueRow[];
  missingTitles: SeoIssueRow[];
  missingDescriptions: SeoIssueRow[];
  missingCanonicals: SeoIssueRow[];
  canonicalMismatch: SeoIssueRow[];
  noindexLeaks: SeoIssueRow[];
  h1Issues: SeoIssueRow[];
  missingLang: SeoIssueRow[];
  missingAlt: SeoIssueRow[];
  invalidJsonLd: SeoIssueRow[];
  missingJsonLd: SeoIssueRow[];
  brokenLinks: SeoIssueRow[];
  linkRedirects: SeoIssueRow[];
  brokenImages: SeoIssueRow[];
};

export type SeoAuditSummary = {
  totalPages: number;
  checkedOk: number;
  pagesWithIssues: number;
  missingTitles: number;
  missingDescriptions: number;
  missingCanonicals: number;
  noindexLeaks: number;
  h1Issues: number;
  missingAlt: number;
  brokenLinks: number;
  brokenImages: number;
  invalidJsonLd: number;
  redirects: number;
  missingLang: number;
  missingJsonLd: number;
  canonicalMismatches: number;
  duplicateTitles: number;
  duplicateDescriptions: number;
  pageStatusIssues?: number;
  fetchErrors?: number;
  auditBaseUrl?: string;
};

export type SeoAuditResult = {
  ok: true;
  generatedAt: string;
  baseUrl: string;
  auditedRoutes: number;
  truncated: boolean;
  warnings: string[];
  summary: SeoAuditSummary;
  issues: SeoAuditIssues;
  duplicateTitles: SeoDuplicateRow[];
  duplicateDescriptions: SeoDuplicateDescriptionRow[];
  brokenLinkDetails: SeoIssueRow[];
  brokenImageDetails: SeoIssueRow[];
  redirectDetails: SeoIssueRow[];
};

export type SeoIssueKey = keyof SeoAuditIssues;
