// src/components/CreateReportFlow.tsx
import { useState } from 'react';
import Step1Modal from './CreateReportModal/Step1Modal';
import Step2Modal from './CreateReportModal/Step2Modal';
import { useReports } from '@/hooks/useReports';
import ConfigureReportModal from './ConfigureReportModal/ConfigureReportModal';
import { CriteriaRowValue } from '@/types/api';

interface Step1Data {
  lobId: string;
  subLobId: string;
  reportName: string;
  description: string;
  selectedFields: Array<any>;
  lobName: string;
  subLobName: string;
}

interface CreateReportFlowProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateReportFlow({ onClose: parentOnClose, onSuccess }: CreateReportFlowProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const { fetchReports } = useReports();
  const [configureReportId, setConfigureReportId] = useState<string | null>(null);

  // Add state to store criteria rows between step navigations
  const [savedCriteriaRows, setSavedCriteriaRows] = useState<CriteriaRowValue[]>([]);

  const handleStep1Next = (data: Step1Data) => {
    setStep1Data(data);
    setCurrentStep(2);
  };

  // Updated to save criteria rows
  const handleBack = (criteriaRows: CriteriaRowValue[]) => {
    // Store the criteria rows when going back to step 1
    console.log("Saving criteria rows on back navigation:", criteriaRows);
    setSavedCriteriaRows(criteriaRows);
    setCurrentStep(1);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setCurrentStep(1);
    setStep1Data(null);
    setSavedCriteriaRows([]); // Clear saved criteria rows
    if (parentOnClose) {
      parentOnClose();
    }
  };

  const handleSaveSuccess = async () => {
    try {
      // Refresh the Extracts list
      await fetchReports(); // Changed from refreshReports to fetchReports
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Try to call the global refresh function if available
      if (typeof window !== 'undefined' && (window as any).refreshReportsTable) {
        // Add a small delay to ensure the API response is processed
        setTimeout(() => {
          (window as any).refreshReportsTable();
        }, 500);
      }

      // Close the modal
      handleClose();
    } catch (error) {
      console.error('Error refreshing Extracts:', error);
    }
  };

  const handleSaveAndConfigureSuccess = async (reportId: string) => {
    try {
      await fetchReports();

      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Try to call the global refresh function if available
      if (typeof window !== 'undefined' && (window as any).refreshReportsTable) {
        setTimeout(() => {
          (window as any).refreshReportsTable();
        }, 500);
      }
      
      setConfigureReportId(reportId);
      // Close Step2Modal but don't close the entire flow
      setIsModalOpen(false);
      setCurrentStep(1);
    } catch (error) {
      console.error('Error refreshing Extracts:', error);
    }
  };

  // Prevent modal from closing when clicking outside
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Handle the final close after configure modal closes
  const handleConfigureClose = () => {
    setConfigureReportId(null);
    // Now fully close the flow
    parentOnClose();
  };

  if (!isModalOpen && !configureReportId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4" onClick={handleModalClick}>
        {currentStep === 1 && !configureReportId && (
          <Step1Modal
            isOpen={true}
            onClose={handleClose}
            onNext={handleStep1Next}
            initialData={step1Data || undefined} // Pass saved data back to Step1Modal when navigating back
          />
        )}
        {currentStep === 2 && step1Data && !configureReportId && (
          <Step2Modal
            isOpen={true}
            onClose={handleClose}
            onBack={(criteriaRows) => handleBack(criteriaRows)} // Modified to capture criteria rows
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
            initialCriteriaRows={savedCriteriaRows.length > 0 ? savedCriteriaRows : undefined}
          />
        )}
      </div>

      {/* Add Configure Report Modal */}
      {configureReportId && (
        <ConfigureReportModal
          isOpen={true}
          onClose={() => {
            // Ensure reports are refreshed when configuration modal is closed
			handleConfigureClose();
            if (typeof window !== 'undefined' && (window as any).refreshReportsTable) {
              setTimeout(() => {
                (window as any).refreshReportsTable();
              }, 500);
            }
            setConfigureReportId(null);
            handleClose();
          }}
          reportId={configureReportId}
        />
      )}
    </div>
  );
}