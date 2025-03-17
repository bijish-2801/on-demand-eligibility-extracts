// src/components/EditReportFlow/EditReportFlow.tsx
import { useState, useEffect } from 'react';
import Step1Modal from '../CreateReportModal/Step1Modal';
import Step2Modal from '../CreateReportModal/Step2Modal';
import { useReports } from '@/hooks/useReports';
import ConfigureReportModal from '../ConfigureReportModal/ConfigureReportModal';
import { CriteriaRowValue } from '@/types/api';

interface EditReportFlowProps {
  reportId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ReportData {
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
    fieldType: string;
    condition: string;
    value: string;
    connector: 'AND' | 'OR' | null;
    hasLookupValues: boolean;
  }>;
}

interface Step1FormData {
  lobId: string;
  lobName: string;
  subLobId: string;
  subLobName: string;
  reportName: string;
  description: string;
  selectedFields: Array<any>;
}

export default function EditReportFlow({ reportId, onClose: parentOnClose, onSuccess }: EditReportFlowProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [step1Data, setStep1Data] = useState<Step1FormData | null>(null);
  const { fetchReports } = useReports();
  // Add state to track if Configure modal should be shown
  const [configureReportId, setConfigureReportId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/reports/${reportId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch Extract data');
        }
        
        const data = await response.json();
        setReportData(data);
        
        // Initialize step1Data when report data is loaded
        setStep1Data({
          lobId: data.lob.id,
          lobName: data.lob.name,
          subLobId: data.subLob?.id || '',
          subLobName: data.subLob?.name || '',
          reportName: data.name,
          description: data.description,
          selectedFields: data.selectedFields
        });
      } catch (error) {
        console.error('Error fetching Extract:', error);
        setError('Failed to load Extract data');
      } finally {
        setIsLoading(false);
      }
    };

    if (reportId) {
      fetchReportData();
    }
  }, [reportId]);

  const handleStep1Next = (data: Step1FormData) => {
    // Update step1Data with new values from Step1Modal
    setStep1Data(data);
    
    // Also update the overall reportData to keep it in sync
    setReportData(prev => ({
      ...prev!,
      name: data.reportName,
      description: data.description,
      lob: {
        id: data.lobId,
        name: data.lobName
      },
      subLob: {
        id: data.subLobId,
        name: data.subLobName
      },
      selectedFields: data.selectedFields
    }));
    
    setCurrentStep(2);
  };

  const handleBack = (criteriaRows?: CriteriaRowValue[]) => {
    // When going back to step 1, we keep the current step1Data
    setCurrentStep(1);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    if (parentOnClose) {
      parentOnClose();
    }
  };

  const handleSaveSuccess = async () => {
    try {
      await fetchReports();
      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (error) {
      console.error('Error refreshing reports:', error);
      setError('Failed to save changes');
    }
  };

  // Add a new handler specifically for Save & Configure
  const handleSaveAndConfigureSuccess = async (configId: string) => {
    try {
      await fetchReports();
      if (onSuccess) {
        onSuccess();
      }
      
      // Set the configure report ID to show the configure modal
      console.log('Setting configureReportId to:', configId);
      setConfigureReportId(configId);
      
      // Hide the step modals but don't close the entire flow
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error refreshing reports:', error);
      setError('Failed to save changes');
    }
  };

  // Handle the final close after configure modal closes
  const handleConfigureClose = () => {
    setConfigureReportId(null);
    // Now fully close the flow
    parentOnClose();
  };

  if (!isModalOpen && !configureReportId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={configureReportId ? undefined : handleClose}>
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {isLoading && !configureReportId && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-800"></div>
          </div>
        )}
        
        {error && !configureReportId && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
            <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
              <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <title>Close</title>
                <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697L11.696 10l2.652 3.152a1.2 1.2 0 0 1 0 1.697z" />
              </svg>
            </span>
          </div>
        )}

        {!isLoading && reportData && step1Data && !configureReportId && (
          <>
            {currentStep === 1 && (
              <Step1Modal
                isOpen={true}
                onClose={handleClose}
                onNext={handleStep1Next}
                isEditMode={true}
                initialData={{
                  lobId: step1Data.lobId,
                  lobName: step1Data.lobName,
                  subLobId: step1Data.subLobId,
                  subLobName: step1Data.subLobName,
                  reportName: step1Data.reportName,
                  description: step1Data.description,
                  selectedFields: step1Data.selectedFields
                }}
              />
            )}
            
            {currentStep === 2 && (
              <Step2Modal
                isOpen={true}
                onClose={handleClose}
                onBack={handleBack}
                onSave={handleSaveSuccess}
                onSaveAndConfigure={handleSaveAndConfigureSuccess}
                formData={{
                  lobId: step1Data.lobId,
                  subLobId: step1Data.subLobId,
                  lobName: step1Data.lobName,
                  subLobName: step1Data.subLobName,
                  reportName: step1Data.reportName,
                  description: step1Data.description,
                  selectedFields: step1Data.selectedFields
                }}
                isEditMode={true}
                reportId={reportId}
                initialCriteriaRows={reportData.criteriaRows}
              />
            )}
          </>
        )}
      </div>

      {/* Configure Report Modal */}
      {configureReportId && (
        <ConfigureReportModal
          isOpen={true}
          onClose={handleConfigureClose}
          reportId={configureReportId}
        />
      )}
    </div>
  );
}