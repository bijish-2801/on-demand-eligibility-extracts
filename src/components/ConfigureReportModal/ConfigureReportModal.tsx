'use client'
import { useState, useEffect } from 'react';
import axios from 'axios';

interface ConfigureReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
}

interface ReportDetails {
  lobName: string;
  subLobName: string;
  reportName: string;
  description: string;
}

interface ReportConfig {
  fileFormatId: string;
  fileDelimiterId: string;
  scheduleParameterId: string;
  reportRuntime: string;
  sftpServerId: string;
  sftpPath: string;
  emailDlList: string;
}

interface DropdownOption {
  id: string;
  name: string;
  description?: string;
}

interface DropdownData {
  fileFormats: DropdownOption[];
  fileDelimiters: DropdownOption[];
  scheduleParameters: DropdownOption[];
  sftpServers: DropdownOption[];
}

export default function ConfigureReportModal({
  isOpen,
  onClose,
  reportId
}: ConfigureReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reportDetails, setReportDetails] = useState<ReportDetails | null>(null);
  const [config, setConfig] = useState<ReportConfig>({
    fileFormatId: '',
    fileDelimiterId: '',
    scheduleParameterId: '',
    reportRuntime: '',
    sftpServerId: '',
    sftpPath: '',
    emailDlList: ''
  });
  
  // Initialize all dropdown options in a single state object
  const [dropdownData, setDropdownData] = useState<DropdownData>({
    fileFormats: [],
    fileDelimiters: [],
    scheduleParameters: [],
    sftpServers: []
  });
  

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [
          configResponse,
          formatsResponse,
          delimitersResponse,
          scheduleResponse,
          serversResponse
        ] = await Promise.all([
          axios.get(`/api/reports/${reportId}/config`),
          axios.get('/api/file-formats'),
          axios.get('/api/file-delimiters'),
          axios.get('/api/schedule-parameters'),
          axios.get('/api/sftp-servers')
        ]);

        // Log responses for debugging
        console.log('********* Config Response:', configResponse.data);
        console.log('********* Formats Response:', formatsResponse.data);
        console.log('********* Delimiters Response:', delimitersResponse.data);
        console.log('********* Schedule Response:', scheduleResponse.data);
        console.log('********* Servers Response:', serversResponse.data);

        if (configResponse.data) {
          setReportDetails({
            lobName: configResponse.data.lobName || '',
            subLobName: configResponse.data.subLobName || '',
            reportName: configResponse.data.reportName || '',
            description: configResponse.data.description || ''
          });

          setConfig({
            fileFormatId: configResponse.data.fileFormatId || '',
            fileDelimiterId: configResponse.data.fileDelimiterId || '',
            scheduleParameterId: configResponse.data.scheduleParameterId || '',
            reportRuntime: configResponse.data.reportRuntime || '',
            sftpServerId: configResponse.data.sftpServerId || '',
            sftpPath: configResponse.data.sftpPath || '',
            emailDlList: configResponse.data.emailDlList || ''
          });
        }

        // Set all dropdown data
        setDropdownData({
          fileFormats: formatsResponse.data || [],
          fileDelimiters: delimitersResponse.data || [],
          scheduleParameters: scheduleResponse.data || [],
          sftpServers: serversResponse.data || []
        });

      } catch (err) {
        console.error('Error loading configuration:', err);
        setError('Failed to load configuration data');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && reportId) {
      fetchData();
    }
  }, [isOpen, reportId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const isFormValid = () => {
    return (
      config.fileFormatId &&
      config.fileDelimiterId &&
      config.scheduleParameterId &&
      config.reportRuntime &&
      config.sftpServerId &&
      config.sftpPath
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await axios.post(`/api/reports/${reportId}/config`, config);

      if (response.data.success) {
        onClose();
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (err) {
      setError('Failed to save configuration');
      console.error('Error saving configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[75%] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#581C87] text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-bold">Configure Extract</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-800"></div>
              <span className="ml-2">Loading...</span>
            </div>
          ) : (
            <>
              {/* Extract Details Section */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="bg-[#9CA3AF] text-white p-2 mb-4">
                  <h3 className="font-bold">Extract Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Line of Business</label>
                    <div className="mt-1 font-bold">{reportDetails?.lobName}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sub LoB</label>
                    <div className="mt-1 font-bold">{reportDetails?.subLobName}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Extract Name</label>
                    <div className="mt-1 font-bold">{reportDetails?.reportName}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <div className="mt-1 font-bold">{reportDetails?.description}</div>
                  </div>
                </div>
              </div>

              {/* Configuration Section */}
              <div className="bg-white p-4 rounded-lg">
                <div className="bg-[#9CA3AF] text-white p-2 mb-4">
                  <h3 className="font-bold">Extract Configuration</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* File Format */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Extract File Format *</label>
                    <select
                      name="fileFormatId"
                      value={config.fileFormatId}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    >
                      <option value="">Select Format</option>
                      {dropdownData.fileFormats.map(format => (
                        <option key={format.id} value={format.id}>
                          {format.name} {format.description ? `(${format.description})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* File Delimiter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Extract File Delimiter *</label>
                    <select
                      name="fileDelimiterId"
                      value={config.fileDelimiterId}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    >
                      <option value="">Select Delimiter</option>
                      {dropdownData.fileDelimiters.map(delimiter => (
                        <option key={delimiter.id} value={delimiter.id}>
                          {delimiter.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule Parameters */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Extract Frequency *</label>
                    <select
                      name="scheduleParameterId"
                      value={config.scheduleParameterId}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    >
                      <option value="">Select Frequency</option>
                      {dropdownData.scheduleParameters.map(param => (
                        <option key={param.id} value={param.id}>
                          {param.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Extract Time *</label>
                    <input
                      type="time"
                      name="reportRuntime"
                      value={config.reportRuntime}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  {/* Row 3 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SFTP Server *</label>
                    <select
                      name="sftpServerId"
                      value={config.sftpServerId}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    >
                      <option value="">Select Server</option>
                      {dropdownData.sftpServers.map(server => (
                        <option key={server.id} value={server.id}>
                          {server.name} {server.description ? `(${server.description})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SFTP Path *</label>
                    <input
                      type="text"
                      name="sftpPath"
                      value={config.sftpPath}
                      onChange={handleInputChange}
                      placeholder="/path/to/destination"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  {/* Row 4 */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Email Distribution List</label>
                    <input
                      type="text"
                      name="emailDlList"
                      value={config.emailDlList}
                      onChange={handleInputChange}
                      placeholder="email1@example.com, email2@example.com"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#EAB308] text-white rounded hover:bg-[#CA9F07]"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isFormValid() || isSaving}
            className={`px-4 py-2 bg-[#7E22CE] text-white rounded ${
              !isFormValid() || isSaving
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-[#6B1FAF]'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}