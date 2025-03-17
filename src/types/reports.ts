// src/types/reports.ts
export interface Report {
  id: string;
  name: string;
  description: string;
  lob: {
    id: string;
    name: string;
  };
  subLob: {
    id: string;
    name: string;
  } | null;
  selectedFields: Array<{
    id: string;
    name: string;
  }>;
  criteriaRows?: Array<{
    id: string;
    field: string;
    condition: string;
    value: string;
    connector: 'AND' | 'OR' | null;
  }>;
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  isPublic: boolean;
  queryStatement: string;
}

export interface ReportFormData {
  lobId: string;
  subLobId: string;
  reportName: string;
  description: string;
  selectedFields: Array<{
    id: string;
    name: string;
  }>;
  lobName: string;
  subLobName: string;
}

export interface EditReportResponse {
  success: boolean;
  error?: string;
  report?: Report;
}