import { useState, useEffect } from 'react';
import { LineOfBusiness, SubLineOfBusiness, LookupField } from '@/types/api';
import axios from 'axios';
import { ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Step1ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNext: (formData: Step1FormData & { 
    lobName: string;
    subLobName: string;
  }) => void;
  isEditMode?: boolean;  // Add this prop
  initialData?: {        // Add this prop
    lobId: string;
    lobName: string;
    subLobId: string;
    subLobName: string;
    reportName: string;
    description: string;
    selectedFields: LookupField[];
  };
}

interface Step1FormData {
  lobId: string;
  subLobId: string;
  reportName: string;
  description: string;
  selectedFields: LookupField[];
}

export default function Step1Modal({ 
  isOpen, 
  onClose, 
  onNext,
  isEditMode = false,  // Add default value
  initialData         // Add to props
}: Step1ModalProps) {
  const [lob, setLob] = useState<LineOfBusiness[]>([]);
  const [subLob, setSubLob] = useState<SubLineOfBusiness[]>([]);
  const [availableFields, setAvailableFields] = useState<LookupField[]>([]);
  const [formData, setFormData] = useState({
    lobId: '',
    subLobId: '',
    reportName: '',
    description: '',
  });
  const [selectedFields, setSelectedFields] = useState<LookupField[]>([]);

  // New state for enhanced features
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [currentAvailablePage, setCurrentAvailablePage] = useState(1);
  const [currentSelectedPage, setCurrentSelectedPage] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);
  const itemsPerPage = 10;

  // Reset form function
  const resetForm = () => {
    setFormData({
      lobId: '',
      subLobId: '',
      reportName: '',
      description: '',
    });
    setSelectedFields([]);
    setSubLob([]);
    setAvailableFields([]);
    setSearchQuery('');
    setSelectedRowIndex(null);
    setCurrentAvailablePage(1);
    setCurrentSelectedPage(1);
  };

  // Fetch Line of Business data once on component mount
  useEffect(() => {
    const fetchLob = async () => {
      try {
        const response = await axios.get('/api/lines-of-business');
        setLob(response.data);
      } catch (error) {
        console.error('Error fetching LoB:', error);
      }
    };
    fetchLob();
  }, []);

  // Handle initial data and form initialization
  useEffect(() => {
    if (initialData && !isInitialized) {
      console.log('Initializing Step1Modal with data:', initialData);
      setFormData({
        lobId: initialData.lobId,
        subLobId: initialData.subLobId,
        reportName: initialData.reportName,
        description: initialData.description || '',
      });
      setSelectedFields(initialData.selectedFields || []);
      setIsInitialized(true);
    }
  }, [initialData, isInitialized]);

  // Fetch SubLOB and available fields when LOB changes
  useEffect(() => {
    // Skip empty lobId or first initialization if we have initialData
    if (!formData.lobId || (initialData && !isInitialized)) return;

    const fetchSubLob = async () => {
      try {
        const response = await axios.get(`/api/sub-lines-of-business/${formData.lobId}`);
        setSubLob(response.data);
      } catch (error) {
        console.error('Error fetching Sub LoB:', error);
      }
    };
    
    const fetchFields = async () => {
      try {
        const response = await axios.get(`/api/lookup-fields/${formData.lobId}`);
        setAvailableFields(response.data);
      } catch (error) {
        console.error('Error fetching fields:', error);
      }
    };

    fetchSubLob();
    fetchFields();
  }, [formData.lobId, initialData, isInitialized]);

  // Function for handling "Select All"
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newFields = availableFields.filter(
        field => !selectedFields.some(selected => selected.id === field.id)
      );
      setSelectedFields(prev => [...prev, ...newFields]);
    } else {
      setSelectedFields([]);
    }
    setSelectedRowIndex(null);
  };

  // Function to handle field reordering
  const handleReorder = (direction: 'up' | 'down') => {
    if (selectedRowIndex === null) return;

    const newSelectedFields = [...selectedFields];
    const currentIndex = selectedRowIndex;
    let newIndex: number;

    if (direction === 'up' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < selectedFields.length - 1) {
      newIndex = currentIndex + 1;
    } else {
      return;
    }

    // Swap elements
    [newSelectedFields[currentIndex], newSelectedFields[newIndex]] = 
    [newSelectedFields[newIndex], newSelectedFields[currentIndex]];
    
    setSelectedFields(newSelectedFields);
    setSelectedRowIndex(newIndex);
  };

  // Filter available fields based on search
  const filteredAvailableFields = availableFields.filter(field =>
    field.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination calculations
  const paginatedAvailableFields = filteredAvailableFields.slice(
    (currentAvailablePage - 1) * itemsPerPage,
    currentAvailablePage * itemsPerPage
  );

  const paginatedSelectedFields = selectedFields.slice(
    (currentSelectedPage - 1) * itemsPerPage,
    currentSelectedPage * itemsPerPage
  );

  const totalAvailablePages = Math.ceil(filteredAvailableFields.length / itemsPerPage);
  const totalSelectedPages = Math.ceil(selectedFields.length / itemsPerPage);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFieldSelection = (field: LookupField) => {
    const isSelected = selectedFields.some(f => f.id === field.id);
    if (isSelected) {
      setSelectedFields(prev => prev.filter(f => f.id !== field.id));
    } else {
      setSelectedFields(prev => [...prev, field]);
    }
  };

  const isNextEnabled = () => {
    return formData.lobId && 
           formData.subLobId && 
           formData.reportName && 
           selectedFields.length > 0;
  };

  const handleNext = () => {
    // Find the selected LoB and SubLoB names
    const selectedLob = lob.find(l => l.id.toString() === formData.lobId);
    const selectedSubLob = subLob.find(s => s.id.toString() === formData.subLobId);
    
    // Log the selected fields data (for debugging)
    console.log('#Step1Modal.tsx Selected Fields Data:', {
      selectedFields,
      totalFields: selectedFields.length,
      fieldNames: selectedFields.map(field => field.name),
    });

    // Log the complete data being passed to onNext
    console.log('Complete Data Passed to onNext:', {
      formData,
      lobId: formData.lobId,
      selectedFields,
      lobName: selectedLob?.name,
      subLobName: selectedSubLob?.name
    });
 
    onNext({
      ...formData,
      lobId: formData.lobId,  // Ensure lobId is included
      selectedFields,
      lobName: selectedLob?.name || '',
      subLobName: selectedSubLob?.name || ''
    });
  };
  
  const handleCancel = () => {
    resetForm(); // Reset form before closing
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-[75%] h-[800px] flex flex-col">
        {/* Header */}
        <div className="bg-[#581C87] text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-bold">
            {isEditMode ? 'Edit Extract: Step 1' : 'Create Extract: Step 1'}
          </h2>
        </div>

        {/* Content wrapper with scrolling */}
        <div className="flex-1 overflow-y-auto">
        {/* Extract Basics Grid */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Line of Business *</label>
            <select
              name="lobId"
              value={formData.lobId}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 ${
                isEditMode ? 'bg-gray-100' : ''
              }`}
              disabled={isEditMode}
            >
              <option value="">Select Line of Business</option>
              {lob.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Sub LoB *</label>
            <select
              name="subLobId"
              value={formData.subLobId}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            >
              <option value="">Select Sub LoB</option>
              {subLob.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Extract Name *</label>
            <input
              type="text"
              name="reportName"
              value={formData.reportName}
              onChange={handleInputChange}
              placeholder="Enter Extract Name..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Short Description</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter Extract Description..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Fields Selection */}
        <div className="p-4 grid grid-cols-2 gap-4">
          {/* Available Fields Section */}
          <div>
            <div className="bg-[#581C87] text-white p-2 flex items-center">
              <input
                type="checkbox"
                onChange={(e) => handleSelectAll(e.target.checked)}
                checked={availableFields.length > 0 && 
                  availableFields.every(field => 
                    selectedFields.some(selected => selected.id === field.id)
                  )}
                className="mr-2"
              />
              <h3 className="font-bold">AVAILABLE FIELDS</h3>
            </div>

            {/* Search Box */}
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded"
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            </div>

            {/* Available Fields List with fixed height */}
            <div className="border h-[325px] overflow-y-auto"> {/* Fixed height for 10 rows */}
              {paginatedAvailableFields.map((field, index) => (
                <div 
                  key={field.id} 
                  className={`p-2 flex items-center h-[30px] ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.some(f => f.id === field.id)}
                    onChange={() => handleFieldSelection(field)}
                    className="mr-2"
                  />
                  <span>{field.name}</span>
                </div>
              ))}
              {/* Add empty rows to maintain height when less than 10 items */}
              {paginatedAvailableFields.length < 10 && 
                Array.from({ length: 10 - paginatedAvailableFields.length }).map((_, index) => (
                  <div key={`empty-available-${index}`} className={`p-2 h-[30px] ${(paginatedAvailableFields.length + index) % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`} />
                ))
              }
            </div>
          </div>

          {/* Selected Fields Section */}
          <div className="flex">
            <div className="flex-1">
              <div className="bg-[#581C87] text-white p-2">
                <h3 className="font-bold">SELECTED FIELDS *</h3>
              </div>
              <div className="border h-[375px] overflow-y-auto"> {/* Fixed height for 10 rows */}
                {paginatedSelectedFields.map((field, index) => {
                  const actualIndex = index + (currentSelectedPage - 1) * itemsPerPage;
                  return (
                    <div 
                      key={field.id}
                      onClick={() => setSelectedRowIndex(actualIndex)}
                      className={`p-2 cursor-pointer h-[30px] ${
                        selectedRowIndex === actualIndex
                          ? 'bg-purple-100'
                          : index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      {field.name}
                    </div>
                  );
                })}
                {/* Add empty rows to maintain height when less than 10 items */}
                {paginatedSelectedFields.length < 10 && 
                  Array.from({ length: 10 - paginatedSelectedFields.length }).map((_, index) => (
                    <div key={`empty-selected-${index}`} className={`p-2 h-[30px] ${(paginatedSelectedFields.length + index) % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`} />
                  ))
                }
              </div>
              </div>

            {/* Reordering Buttons */}
            <div className="ml-2 flex flex-col justify-center gap-2">
              <button
                onClick={() => handleReorder('up')}
                disabled={selectedRowIndex === null || selectedRowIndex === 0}
                className={`p-2 rounded ${
                  selectedRowIndex === null || selectedRowIndex === 0
                    ? 'bg-gray-200 cursor-not-allowed'
                    : 'bg-[#581C87] text-white hover:bg-[#6B1FAF]'
                }`}
                disabled={isEditMode}
              >
                <ChevronUpIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleReorder('down')}
                disabled={
                  selectedRowIndex === null || 
                  selectedRowIndex === selectedFields.length - 1
                }
                className={`p-2 rounded ${
                  selectedRowIndex === null || 
                  selectedRowIndex === selectedFields.length - 1
                    ? 'bg-gray-200 cursor-not-allowed'
                    : 'bg-[#581C87] text-white hover:bg-[#6B1FAF]'
                }`}
              >
                <ChevronDownIcon className="h-5 w-5" />
              </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with pagination and action buttons - fixed at bottom */}
        <div className="border-t">
          {/* Pagination */}
          <div className="p-2 flex justify-between">
            <div className="flex gap-2">
              {totalAvailablePages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Available Fields:</span>
                  {Array.from({ length: totalAvailablePages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentAvailablePage(i + 1)}
                      className={`px-3 py-1 rounded text-sm ${
                        currentAvailablePage === i + 1
                          ? 'bg-[#581C87] text-white'
                          : 'bg-gray-200'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {totalSelectedPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Selected Fields:</span>
                  {Array.from({ length: totalSelectedPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSelectedPage(i + 1)}
                      className={`px-3 py-1 rounded text-sm ${
                        currentSelectedPage === i + 1
                          ? 'bg-[#581C87] text-white'
                          : 'bg-gray-200'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

        {/* Action Buttons */}
        <div className="p-4 flex justify-end space-x-4">
          <button
            onClick={handleCancel} 
            className="px-4 py-2 bg-[#EAB308] text-white rounded hover:bg-[#CA9F07]"
          >
            Cancel
          </button>
          <button
            onClick={handleNext}
            disabled={!isNextEnabled()}
            className={`px-4 py-2 bg-[#7E22CE] text-white rounded ${
              !isNextEnabled() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#6B1FAF]'
            }`}
          >
            Next
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}