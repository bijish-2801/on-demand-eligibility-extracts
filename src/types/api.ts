export interface LineOfBusiness {
  id: string;
  name: string;
}

export interface SubLineOfBusiness {
  id: string;
  name: string;
  lobId: string;
}

export interface LookupField {
  id: string;
  name: string;
  lobId: string;
}

export interface ApiError {
  error: string;
}

export interface TestRunRequest {
  limit?: number;
  page?: number;
  pageSize?: number;
}

export interface TestRunResponse {
  reportId: string;
  reportName: string;
  columns: string[];
  data: Record<string, any>[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SaveReportResponse {
  success: boolean;
  reportId: string;
  error?: string;
}

export interface ReportCriteria {
  id: string;
  field: string;
  condition: string;
  value: string;
  connector: 'AND' | 'OR' | null;
}

export interface ReportData {
  reportName: string;
  description: string;
  lobId: string;
  subLobId: string;
  selectedFields: LookupField[];
  criteriaRows: ReportCriteria[];
  createdBy: string;
  createdAt: string;
}

export interface QueryGenerationResponse {
  success: boolean;
  queryStatement?: string;
  error?: string;
}

export interface Operator {
  id: number;
  field_type: string;
  operator_symbol: string;
}

export interface OperatorsByType {
  [fieldName: string]: Array<{
    id: number;
    symbol: string;
  }>;
}

export interface SortConfig {
  field: string | null;
  direction: 'asc' | 'desc';
}

export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

export interface LookupCriteriaField {
  id: string;
  fieldName: string;
  displayName: string;
  fieldType: string;
}

export interface LookupCriteriaValue {
  value: string;
}

export interface CriteriaRowValue {
  id: string;
  field: string;
  fieldType: string;
  condition: string;
  value: string;
  connector: 'AND' | 'OR' | null;
  hasLookupValues?: boolean;
}