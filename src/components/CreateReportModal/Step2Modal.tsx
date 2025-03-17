'use client'
import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LookupField, 
  TestRunResponse, 
  ReportCriteria, 
  Operator, 
  OperatorsByType,
  SortConfig,
  LookupCriteriaField,
  LookupCriteriaValue,
  CriteriaRowValue 
} from '@/types/api';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { convertToCSV, downloadCSV } from '@/utils/csvExport';

interface Step2ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: (criteriaRows: CriteriaRowValue[]) => void; // Updated to pass criteriaRows
  onSave: () => void;
  onSaveAndConfigure: (reportId: string) => void;
  formData: {
    lobId: string;
    subLobId: string;
    lobName: string;
    subLobName: string;
    reportName: string;
    description: string;
    selectedFields: LookupField[];
  };
  isEditMode?: boolean;
  reportId?: string;
  initialCriteriaRows?: CriteriaRowValue[];
}

// Define available delimiters and file formats
const DELIMITERS = [
  { value: ',', label: '(,) Comma' },
  { value: '|', label: '(|) Pipe' },
  { value: '\t', label: '(\\t) Tab' },
  { value: ';', label: '(;) Semicolon' },
  { value: '~', label: '(~) Tilde' }
];

const FILE_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'txt', label: 'TXT' }
];

export default function Step2Modal({ 
  isOpen, 
  onClose,
  onBack,
  onSave, 
  onSaveAndConfigure,
  formData,
  isEditMode = false,
  reportId: existingReportId,
  initialCriteriaRows 
}: Step2ModalProps) {
  // State Management
  const [criteriaFields, setCriteriaFields] = useState<LookupCriteriaField[]>([]);
  const [criteriaValues, setCriteriaValues] = useState<{ [fieldId: string]: LookupCriteriaValue[] }>({});
  const [criteriaRows, setCriteriaRows] = useState<CriteriaRowValue[]>([
    {
      id: '1',
      field: '',
      fieldType: '',
      condition: '',
      value: '',
      connector: null,
      hasLookupValues: false
    }
  ]);
  const [operators, setOperators] = useState<OperatorsByType>({});
  const [fetchedOperators, setFetchedOperators] = useState<Set<string>>(new Set()); // Track fields we've already fetched operators for
  const [fetchedLookupValues, setFetchedLookupValues] = useState<Set<string>>(new Set()); // Track fields we've already fetched lookup values for
  const [isSaving, setIsSaving] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(existingReportId || null);
  const [criteriaGroupId] = useState<number>(Date.now());
  const [testRunResults, setTestRunResults] = useState<TestRunResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: null,
    direction: 'asc'
  });
  const [isInitialized, setIsInitialized] = useState(false);
  
  // New state for export options
  const [selectedDelimiter, setSelectedDelimiter] = useState<string>(',');
  const [selectedFormat, setSelectedFormat] = useState<string>('csv');
  
  // State to store the complete dataset for export (all 50 records)
  const [completeDataset, setCompleteDataset] = useState<any[] | null>(null);
  
  const pageSize = 10;
  
  // Initialize with existing data in edit mode
  useEffect(() => {
    if (isEditMode && initialCriteriaRows && initialCriteriaRows.length > 0 && !isInitialized) {
      console.log('Initializing Step2Modal with criteria rows:', initialCriteriaRows);
      setCriteriaRows(initialCriteriaRows);
      setIsInitialized(true);
    }
  }, [isEditMode, initialCriteriaRows, isInitialized]);

  // Fetch criteria fields based on LOB ID
  useEffect(() => {
    const fetchCriteriaFields = async () => {
      try {
        console.log('** fetchCriteriaFields: Fetching criteria fields for LOB ID:', formData.lobId);
        const response = await axios.get(`/api/lookup-criteria-fields/${formData.lobId}`);
        console.log('** fetchCriteriaFields: Criteria fields response:', response.data);
        setCriteriaFields(response.data);
      } catch (error) {
        console.error('Error fetching criteria fields:', error);
        setError('Error fetching criteria fields');
      }
    };

    if (formData.lobId) {
      fetchCriteriaFields();
    }
  }, [formData.lobId]);

  // Initialize lookup values and operators for existing criteria rows - runs only once after criteriaFields are loaded
  useEffect(() => {
    const initializeLookupValues = async () => {
      // Skip if already initialized or if criteriaFields aren't loaded yet
      if (isInitialized || criteriaFields.length === 0 || !criteriaRows.some(row => row.field)) {
        return;
      }

      console.log('*** Running one-time initialization for lookup values and operators');
      
      // Create new sets to track what we've fetched
      const newFetchedOperators = new Set<string>();
      const newFetchedLookupValues = new Set<string>();

      // Process each row with a field value
      for (const row of criteriaRows) {
        if (row.field) {
          // Fetch lookup values for the field (if not already fetched)
          if (!fetchedLookupValues.has(row.field)) {
            try {
              const response = await axios.get(`/api/lookup-criteria-values/${row.field}`);
              if (response.data.length > 0) {
                setCriteriaValues(prev => ({
                  ...prev,
                  [row.field]: response.data
                }));
                
                setCriteriaRows(prev => prev.map(r => 
                  r.id === row.id ? { ...r, hasLookupValues: true } : r
                ));
              }
              newFetchedLookupValues.add(row.field);
            } catch (error) {
              console.error('Error fetching lookup values:', error);
            }
          }
          
          // Fetch operators for the field (if not already fetched)
          const field = criteriaFields.find(field => field.id === row.field);
          if (field && !fetchedOperators.has(field.displayName)) {
            try {
              const operatorsResponse = await axios.get('/api/operators', {
                params: {
                  fieldName: field.fieldName,
                  lobId: formData.lobId
                }
              });

              setOperators(prev => ({
                ...prev,
                [field.displayName]: operatorsResponse.data
                  .filter((op: Operator) => op.id != null)
                  .map((op: Operator) => ({
                    id: op.id,
                    symbol: op.operator_symbol
                  }))
              }));
              newFetchedOperators.add(field.displayName);
            } catch (error) {
              console.error('Error fetching operators:', error);
            }
          }
        }
      }
      
      // Update our tracking sets
      setFetchedOperators(prev => new Set([...prev, ...newFetchedOperators]));
      setFetchedLookupValues(prev => new Set([...prev, ...newFetchedLookupValues]));
      setIsInitialized(true);
    };

    initializeLookupValues();
  }, [criteriaFields, criteriaRows, formData.lobId, fetchedOperators, fetchedLookupValues, isInitialized]);

  // Format criteria rows for API calls
  const formatCriteriaRows = () => {
    return criteriaRows.map((row, index) => ({
      lookup_field_id: row.field,
      operator_id: row.condition,
      criteria_value: row.value,
      criteria_order: index + 1,
      group_id: criteriaGroupId,
      group_operator: row.connector || 'AND'
    }));
  };

  // Core utility function for query generation
  const generateAndUpdateQuery = async (reportId: string) => {
    try {
      const formattedCriteriaRows = formatCriteriaRows();

      const response = await axios.put(`/api/reports/${reportId}`, {
        selectedFields: formData.selectedFields.map((field, index) => ({
          lookup_field_id: field.id,
          display_order: index + 1
        })),
        criteriaRows: formattedCriteriaRows
      });

      if (!response.data.success || !response.data.queryStatement) {
        throw new Error('Failed to generate query');
      }

      return response.data.queryStatement;
    } catch (error) {
      console.error('Error generating query:', error);
      throw error;
    }
  };

  // Row manipulation handlers
  const addCriteriaRow = async (index: number, connector: 'AND' | 'OR') => {
    const newRow: CriteriaRowValue = {
      id: Date.now().toString(),
      field: '',
      fieldType: '',
      condition: '',
      value: '',
      connector: null,
      hasLookupValues: false
    };

    const updatedRows = [...criteriaRows];
    updatedRows[index].connector = connector;
    updatedRows.splice(index + 1, 0, newRow);
    setCriteriaRows(updatedRows);
  };
  
  // Field change handlers
  const handleFieldChange = async (index: number, value: string) => {
    const updatedRows = [...criteriaRows];
    const selectedField = criteriaFields.find(field => field.id === value);
    
    if (selectedField) {
      updatedRows[index] = {
        ...updatedRows[index],
        field: value,
        fieldType: selectedField.fieldType,
        condition: '',
        value: '',
        hasLookupValues: false
      };

      try {
        await fetchOperatorsForField(selectedField, value);

      } catch (error) {
        console.error('Error fetching field data:', error);
        setError('Error fetching field data');
      }
    }

    setCriteriaRows(updatedRows);
  };

  // New function to fetch operators for a field
  const fetchOperatorsForField = async (selectedField: LookupCriteriaField, fieldValue: string) => {
    // Check if we need to fetch operators (only if we haven't already)
    if (!fetchedOperators.has(selectedField.displayName)) {
      const operatorsResponse = await axios.get('/api/operators', {
        params: {
          fieldName: selectedField.fieldName,
          lobId: formData.lobId
        }
      });
      
      setOperators(prev => ({
        ...prev,
        [selectedField.displayName]: operatorsResponse.data
          .filter((op: Operator) => op.id != null)
          .map((op: Operator) => ({
            id: op.id,
            symbol: op.operator_symbol
          }))
      }));
      
      // Add to our tracking set
      setFetchedOperators(prev => new Set([...prev, selectedField.displayName]));
    }

    // Check if we need to fetch lookup values (only if we haven't already)
    if (!fetchedLookupValues.has(fieldValue)) {
      const lookupValuesResponse = await axios.get(`/api/lookup-criteria-values/${fieldValue}`);
      const hasValues = lookupValuesResponse.data.length > 0;
      
      if (hasValues) {
        setCriteriaValues(prev => ({
          ...prev,
          [fieldValue]: lookupValuesResponse.data
        }));
        
        // Update the row with hasLookupValues flag
        setCriteriaRows(prev => prev.map(r => 
          r.field === fieldValue ? { ...r, hasLookupValues: true } : r
        ));
      }
      
      // Add to our tracking set
      setFetchedLookupValues(prev => new Set([...prev, fieldValue]));
    } else if (criteriaValues[fieldValue]?.length > 0) {
      // If we've already fetched the lookup values, just update the hasLookupValues flag
      setCriteriaRows(prev => prev.map(r => 
        r.field === fieldValue ? { ...r, hasLookupValues: true } : r
      ));
    }
  };

  // New effect to populate operators for existing rows after criteria fields are loaded
  useEffect(() => {
    const loadOperatorsForExistingRows = async () => {
      // Only run this if we have criteria fields and rows with fields
      if (!criteriaFields.length || !criteriaRows.some(row => row.field) || !isInitialized) return;

      console.log('Loading operators for existing rows');
      
      // Process each row that has a field and needs operators
      for (const row of criteriaRows) {
        if (row.field) {
          const selectedField = criteriaFields.find(field => field.id === row.field);
          if (selectedField && !fetchedOperators.has(selectedField.displayName)) {
            try {
              await fetchOperatorsForField(selectedField, row.field);
            } catch (err) {
              console.error(`Error fetching operators for field ${selectedField.displayName}:`, err);
            }
          }
        }
      }
    };

    loadOperatorsForExistingRows();
  }, [criteriaFields, isInitialized]);

  const handleConditionChange = async (index: number, value: string) => {
    const updatedRows = [...criteriaRows];
    updatedRows[index].condition = value;
    setCriteriaRows(updatedRows);
  };

  const handleValueChange = async (index: number, value: string) => {
    const updatedRows = [...criteriaRows];
    updatedRows[index].value = value;
    setCriteriaRows(updatedRows);
  };

  const removeCriteriaRow = async (index: number) => {
    if (criteriaRows.length > 1) {
      const updatedRows = [...criteriaRows];
      updatedRows.splice(index, 1);
      
      if (index < criteriaRows.length - 1 && index > 0) {
        updatedRows[index - 1].connector = criteriaRows[index].connector;
      }
      
      setCriteriaRows(updatedRows);
    }
  };

  // Render helpers
  const renderValueInput = (row: CriteriaRowValue, index: number) => {
    if (!row.field) return null;

    if (row.hasLookupValues) {
      return (
        <select
          value={row.value}
          onChange={(e) => handleValueChange(index, e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          disabled={isSaving}
        >
          <option value="">Select Value</option>
          {criteriaValues[row.field]?.map((item) => (
            <option key={item.value} value={item.value}>
              {item.value}
            </option>
          ))}
        </select>
      );
    }

    if (row.fieldType === 'DATE') {
      return (
        <input
          type="date"
          value={row.value}
          onChange={(e) => handleValueChange(index, e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          disabled={isSaving}
        />
      );
    }

    return (
      <input
        type="text"
        value={row.value}
        onChange={(e) => handleValueChange(index, e.target.value)}
        className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
        placeholder="Enter value"
        disabled={isSaving}
      />
    );
  };
  
  // Utility functions
  const isSaveEnabled = () => {
    return criteriaRows.every(row => row.field && row.condition && row.value);
  };

  const handleSort = (field: string) => {
    setSortConfig(prevConfig => ({
      field,
      direction: prevConfig.field === field && prevConfig.direction === 'asc' 
        ? 'desc' 
        : 'asc'
    }));
  };

  const getSortedData = () => {
    if (!testRunResults || !sortConfig.field) return testRunResults?.data;

    return [...testRunResults.data].sort((a, b) => {
      const aVal = a[sortConfig.field!];
      const bVal = b[sortConfig.field!];
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      if (aVal < bVal) return -1 * direction;
      if (aVal > bVal) return 1 * direction;
      return 0;
    });
  };

  // Handle back button click - pass the current criteria rows back to parent
  const handleBackClick = () => {
    // Pass the current criteria rows back to the parent component
    onBack(criteriaRows);
  };

  // Function to fetch all records for export
  const fetchAllRecordsForExport = async () => {
    if (!savedReportId) return null;

    try {
      // Make API call to get all 50 records at once
      const response = await axios.post<TestRunResponse>(
        `/api/reports/${savedReportId}/execute`,
        {
          limit: 50,  // Request all 50 records
          page: 1,    // Start from first page
          pageSize: 50 // Get all in one page
        }
      );

      return response.data.data; // Return the complete dataset
    } catch (error) {
      console.error('Error fetching all records for export:', error);
      setError('Failed to fetch all records for export');
      return null;
    }
  };

  // Enhanced CSV Export functionality
  const handleExport = async () => {
    if (!testRunResults || !testRunResults.data || testRunResults.data.length === 0) {
      setError("No data to export");
      return;
    }
    
    try {
      setIsExporting(true);
      
      // Fetch all 50 records for export
      const allRecords = await fetchAllRecordsForExport();
      
      if (!allRecords) {
        throw new Error("Failed to fetch all records for export");
      }
      
      // Apply sorting to the complete dataset if sorting is active
      let dataToExport = allRecords;
      if (sortConfig.field) {
        dataToExport = [...allRecords].sort((a, b) => {
          const aVal = a[sortConfig.field!];
          const bVal = b[sortConfig.field!];
          const direction = sortConfig.direction === 'asc' ? 1 : -1;

          if (aVal < bVal) return -1 * direction;
          if (aVal > bVal) return 1 * direction;
          return 0;
        });
      }
      
      // Convert to the selected format with the selected delimiter
      const formattedContent = convertToCSV(dataToExport, testRunResults.columns, selectedDelimiter);
      
      // Set filename based on report name and current datetime
      const now = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
      const filename = `${formData.reportName.replace(/\s+/g, '_')}_${now}`;
      
      // Download the file with the correct extension
      downloadCSV(formattedContent, filename, selectedFormat);
    } catch (err) {
      console.error('Error exporting data:', err);
      setError('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = async (andConfigure: boolean = false) => {
    try {
      setIsSaving(true);
      setError(null);

      if (!isSaveEnabled()) {
        setError('Please fill in all required fields');
        return;
      }

      const reportData = {
        reportName: formData.reportName,
        description: formData.description,
        lobId: formData.lobId,
        subLobId: formData.subLobId,
        selectedFields: formData.selectedFields.map((field, index) => ({
          lookup_field_id: field.id,
          display_order: index + 1
        })),
        criteriaRows: formatCriteriaRows(),
        createdBy: '1',
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };

      let response;
      
      if (savedReportId) {
        await generateAndUpdateQuery(savedReportId);
        response = { data: { success: true, reportId: savedReportId } };
      } else {
        response = await axios.post('/api/reports', reportData);
        if (response.data.success && response.data.reportId) {
          setSavedReportId(response.data.reportId);
          await generateAndUpdateQuery(response.data.reportId);
        }
      }

      if (response.data.success) {
        if (andConfigure) {
          onSaveAndConfigure(response.data.reportId);
        } else {
          onSave();
        }
        onClose();
      } else {
        throw new Error('Failed to save Extract');
      }

      console.log('Save successful:', {
        formData,
        criteriaRows,
        operators,
        reportData,
        response
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving the extract!');
      console.error('Error saving extract:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestRun = async () => {
    try {
      setIsTestRunning(true);
      setError(null);

      if (!isSaveEnabled()) {
        setError('Please fill in all required fields');
        return;
      }

      let reportId = savedReportId;

      // Format the criteria rows for the API
      const formattedCriteriaRows = criteriaRows.map((row, index) => ({
        lookup_field_id: row.field,
        operator_id: row.condition,
        criteria_value: row.value,
        criteria_order: index + 1,
        group_id: criteriaGroupId,
        group_operator: row.connector || 'AND'
      }));

      if (!reportId) {
        // Create a new report if one doesn't exist yet
        const reportData = {
          reportName: formData.reportName,
          description: formData.description,
          lobId: formData.lobId,
          subLobId: formData.subLobId,
          selectedFields: formData.selectedFields.map((field, index) => ({
            lookup_field_id: field.id,
            display_order: index + 1
          })),
          criteriaRows: formattedCriteriaRows,
          createdBy: '1',
          createdAt: new Date().toISOString()
        };
  
        const saveResponse = await axios.post('/api/reports', reportData);
        
        if (!saveResponse.data.success || !saveResponse.data.reportId) {
          throw new Error('Failed to save extract');
        }
        
        reportId = saveResponse.data.reportId;
        setSavedReportId(reportId);
      }

      // This is the critical step that was missing - always update the query before executing
      await generateAndUpdateQuery(reportId);

      // Now execute the query with the updated criteria
      const executeResponse = await axios.post(`/api/reports/${reportId}/execute`, {
        limit: 50,
        page: 1,
        pageSize: 10
      });
  
      setTestRunResults(executeResponse.data);
      setCurrentPage(1); // Reset to first page when running a new test
      
      // Reset the completeDataset - it will be fetched when exporting
      setCompleteDataset(null);
    } catch (error) {
      console.error('Error running test:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || 'Failed to run test. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsTestRunning(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage);
    if (testRunResults && savedReportId) {
      try {
        const executeResponse = await axios.post<TestRunResponse>(
          `/api/reports/${savedReportId}/execute`,
          {
            limit: 50,
            page: newPage,
            pageSize
          }
        );
        setTestRunResults(executeResponse.data);
      } catch (error) {
        console.error('Error fetching page:', error);
        setError('Failed to fetch page. Please try again.');
      }
    }
  };
  
  // Early return if modal is not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-[75%] h-[800px] flex flex-col">
        {/* Header */}
        <div className="bg-[#581C87] text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-bold">
            {isEditMode ? 'Edit Extract: Step 2' : 'Create Extract: Step 2'}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Extract Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Line of Business</label>
              <div className="mt-1 font-bold">{formData.lobName}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Sub LoB</label>
              <div className="mt-1 font-bold">{formData.subLobName}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Extract Name *</label>
              <div className="mt-1 font-bold">{formData.reportName}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Short Description</label>
              <div className="mt-1 font-bold">{formData.description}</div>
            </div>
          </div>

          {/* Criteria Section */}
          <div className="mb-6">
            <div className="bg-[#9CA3AF] text-white p-2 mb-4">
              <h3 className="font-bold">CRITERIA</h3>
            </div>

            {/* Criteria Rows */}
            <div className="space-y-4">
              {criteriaRows.map((row, index) => (
                <div key={row.id} className="grid grid-cols-[2fr,2fr,2fr,2fr,1fr] gap-4 items-end">
                  {/* Field dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
                    <select
                      value={row.field}
                      onChange={(e) => handleFieldChange(index, e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                      disabled={isSaving}
                    >
                      <option value="">Select Field</option>
                      {criteriaFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Condition dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                    <select
                      value={row.condition}
                      onChange={(e) => handleConditionChange(index, e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                      disabled={isSaving}
                    >
                      <option value="">Select Condition</option>
                      {row.field && (() => {
                        const selectedField = criteriaFields.find(field => field.id === row.field);
                        return selectedField && operators[selectedField.displayName] 
                          ? operators[selectedField.displayName].map((operator) => (
                              <option 
                                key={`${row.id}-operator-${operator.id}`} 
                                value={operator.id}
                              >
                                {operator.symbol}
                              </option>
                            ))
                          : null;
                      })()}
                    </select>
                  </div>

                  {/* Value input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                    {renderValueInput(row, index)}
                  </div>

                  {/* AND/OR buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => addCriteriaRow(index, 'AND')}
                      className={`px-3 py-2 text-white rounded transition-colors ${
                        row.connector === 'AND'
                          ? 'bg-[#CA9F07] font-bold'
                          : 'bg-[#EAB308] hover:bg-[#CA9F07]'
                      }`}
                    >
                      And
                    </button>
                    <button
                      onClick={() => addCriteriaRow(index, 'OR')}
                      className={`px-3 py-2 text-white rounded transition-colors ${
                        row.connector === 'OR'
                          ? 'bg-[#CA9F07] font-bold'
                          : 'bg-[#EAB308] hover:bg-[#CA9F07]'
                      }`}
                    >
                      Or
                    </button>
                  </div>

                  {/* Remove button */}
                  <div>
                    <button
                      onClick={() => removeCriteriaRow(index)}
                      disabled={criteriaRows.length === 1}
                      className={`px-3 py-2 rounded ${
                        criteriaRows.length === 1
                          ? 'bg-gray-200 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-600'
                      }`}
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test Run Results */}
          {testRunResults && (
            <div className="mt-6">
              <div className="flex items-center justify-between bg-[#9CA3AF] text-white p-2 mb-4">
                <h3 className="font-bold">TEST RUN RESULTS</h3>
                <div className="flex items-center space-x-2">
                  {/* Delimiter Selection Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedDelimiter}
                      onChange={(e) => setSelectedDelimiter(e.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-1 px-2 text-sm text-gray-800"
					  disabled={isExporting || !testRunResults.data || testRunResults.data.length === 0}
                    >
                      {DELIMITERS.map((delimiter) => (
                        <option key={delimiter.value} value={delimiter.value}>
                          {delimiter.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* File Format Selection Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-1 px-2 text-sm text-gray-800"
					  disabled={isExporting || !testRunResults.data || testRunResults.data.length === 0}
                    >
                      {FILE_FORMATS.map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Export Button */}
                  <button 
                    onClick={handleExport}
                    disabled={isExporting || !testRunResults.data || testRunResults.data.length === 0}
                    className={`px-3 py-1 flex items-center bg-[#7E22CE] text-white rounded ${
                      isExporting || !testRunResults.data || testRunResults.data.length === 0 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-[#6B1FAF]'
                    }`}
                  >
                    <ArrowDownTrayIcon className="h-3 w-3 mr-1" />
                    {isExporting ? 'Exporting...' : `Export ${selectedFormat.toUpperCase()}`}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {testRunResults.columns.map((column) => (
                        <th
                          key={column}
                          onClick={() => handleSort(column)}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          {column}
                          {sortConfig.field === column && (
                            <span className="ml-1">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getSortedData()?.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {testRunResults.columns.map((column) => (
                          <td key={column} className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
                            {row[column]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, testRunResults.totalCount)} of {testRunResults.totalCount} results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!testRunResults.hasMore}
                    className="px-4 py-2 border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-between">
          <button
            onClick={onBack}
            disabled={isSaving || isTestRunning}
            className="px-4 py-2 bg-[#EAB308] text-white rounded hover:bg-[#CA9F07] disabled:opacity-50"
          >
            Back
          </button>
          <div className="space-x-4">
            <button
              onClick={handleTestRun}
              disabled={!isSaveEnabled() || isSaving || isTestRunning}
              className={`px-4 py-2 bg-[#7E22CE] text-white rounded ${
                !isSaveEnabled() || isSaving || isTestRunning 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-[#6B1FAF]'
              }`}
            >
              {isTestRunning ? 'Running Test...' : 'Save & Test Run'}
            </button>
            <button
              onClick={onClose}
              disabled={isSaving || isTestRunning}
              className="px-4 py-2 bg-[#EAB308] text-white rounded hover:bg-[#CA9F07] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={!isSaveEnabled() || isSaving || isTestRunning}
              className="px-4 py-2 bg-[#7E22CE] text-white rounded hover:bg-[#6B1FAF] disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={!isSaveEnabled() || isSaving || isTestRunning}
              className="px-4 py-2 bg-[#7E22CE] text-white rounded hover:bg-[#6B1FAF] disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save & Configure'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-red-100 border-t border-red-400 text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}