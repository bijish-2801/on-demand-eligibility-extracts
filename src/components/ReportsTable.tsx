'use client'
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/useDebounce';
import { useReports } from '@/hooks/useReports';
import EditReportFlow from './EditReportFlow/EditReportFlow';
import ConfigureReportModal from './ConfigureReportModal/ConfigureReportModal';

interface Report {
  id: string;
  name: string;
  description: string;
  lobName: string;
}

type SortField = 'id' | 'name' | 'lobName';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function ReportsTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { reports, loading, error, fetchReports } = useReports();
  const [configuringReportId, setConfiguringReportId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add a refresh trigger state

  // Initial load and when search changes
  useEffect(() => {
    const load = async () => {
      await fetchReports(debouncedSearchTerm);
    };
    load();
  }, [debouncedSearchTerm, fetchReports, refreshTrigger]); // Add refreshTrigger as a dependency

  // Reset to first page when search term, page size, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize, sortField, sortDirection]);

  // Function to force a refresh
  const forceRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    // First update sort direction if same field, then update field
    if (field === sortField) {
      setSortDirection(currentDirection => 
        currentDirection === 'asc' ? 'desc' : 'asc'
      );
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);  // Fix: Update the sort icon to be more visible and clear

  const getSortIcon = useCallback((field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return (
      <span className="text-white">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  }, [sortField, sortDirection]);

  const SortableHeader = useCallback(({ field, label }: { field: SortField, label: string }) => (
    <th 
      className={`px-4 py-2 text-left cursor-pointer hover:bg-purple-700 transition-colors ${
        sortField === field ? 'bg-purple-700' : ''
      }`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {label}
        <span className="text-xs">{getSortIcon(field)}</span>
      </div>
    </th>
  ), [handleSort, getSortIcon])

  const sortedReports = [...reports].sort((a, b) => {
    // Move direction calculation outside the switch for proper application
    const direction = sortDirection === 'asc' ? 1 : -1;
    let result = 0;
    
    switch (sortField) {
      case 'id':
        result = parseInt(a.id) - parseInt(b.id);
        break;
      case 'name':
        result = a.name.localeCompare(b.name);
        break;
      case 'lobName':
        result = a.lobName.localeCompare(b.lobName);
        break;
    }
    
    return result * direction;  // Apply direction after comparison
  });

  const handleEditClick = (reportId: string) => {
    setEditingReportId(reportId);
  };

  const handleEditClose = () => {
    setEditingReportId(null);
  };

  const handleEditSuccess = async () => {
    try {
      await fetchReports(debouncedSearchTerm);
      setEditingReportId(null);
      
      // Add a slight delay and force a second refresh to ensure UI is updated
      setTimeout(() => {
        forceRefresh();
      }, 500);
    } catch (error) {
      console.error('Error refreshing reports after edit:', error);
    }
  };

  const handleConfigureClick = (reportId: string) => {
    setConfiguringReportId(reportId);
  };

  const handleConfigureClose = () => {
    setConfiguringReportId(null);
    // Also refresh when configuration modal is closed
    forceRefresh();
  };

  // Pagination calculations
  const totalPages = Math.ceil(sortedReports.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentReports = sortedReports.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(event.target.value));
  };

  // Added to expose the refresh function to parent components
  useEffect(() => {
    // Expose refresh method to window for global access (if needed)
    if (typeof window !== 'undefined') {
      (window as any).refreshReportsTable = forceRefresh;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).refreshReportsTable;
      }
    };
  }, [forceRefresh]);

  // Pagination Controls Component
  const PaginationControls = () => (
    <div className="flex items-center justify-between mt-4 px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">Rows per page:</span>
        <select
          value={pageSize}
          onChange={handlePageSizeChange}
          className="border rounded px-2 py-1 text-sm"
        >
          {PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">
          {startIndex + 1}-{Math.min(endIndex, sortedReports.length)} of {sortedReports.length}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className={`px-2 py-1 rounded ${
              currentPage === 1 
                ? 'bg-gray-200 cursor-not-allowed' 
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {'<<'}
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-2 py-1 rounded ${
              currentPage === 1 
                ? 'bg-gray-200 cursor-not-allowed' 
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {'<'}
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNumber = currentPage - 2 + i
            if (pageNumber <= 0) pageNumber += 5
            if (pageNumber > totalPages) pageNumber -= 5
            if (pageNumber > 0 && pageNumber <= totalPages) {
              return (
                <button
                  key={pageNumber}
                  onClick={() => handlePageChange(pageNumber)}
                  className={`px-3 py-1 rounded ${
                    currentPage === pageNumber
                      ? 'bg-purple-700 text-white'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {pageNumber}
                </button>
              )
            }
            return null
          })}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-2 py-1 rounded ${
              currentPage === totalPages 
                ? 'bg-gray-200 cursor-not-allowed' 
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {'>'}
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={`px-2 py-1 rounded ${
              currentPage === totalPages 
                ? 'bg-gray-200 cursor-not-allowed' 
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {'>>'}
          </button>
        </div>
      </div>
    </div>
  )


  return (
    <div className="flex flex-col h-[calc(100vh-300px)] relative z-0">
      {/* Search bar section */}
      <div className="flex justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search extracts by name..."
              className="pl-10 pr-4 py-2 border rounded-lg w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {/* Add refresh button */}
          <button 
            onClick={forceRefresh}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-purple-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main content area with fixed height */}
      <div className="flex flex-col flex-grow border rounded-lg overflow-hidden bg-white"> {/* Added bg-white */}
        {/* Table container with internal scrolling */}
        <div className="relative flex-grow overflow-hidden">
          <div className="absolute inset-0 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-[#581C87] text-white z-10">{/* z-10 maintained for internal stacking */}
                <tr className="table-header">
                  <SortableHeader field="id" label="Extract ID"/>
                  <SortableHeader field="name" label="Extract Name"/>
                  <th className="px-4 py-2 text-left">Extract Description</th>
                  <SortableHeader field="lobName" label="Line of Business"/>
                  <th className="px-4 py-2 text-left">Sub LoB</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-800"></div>
                        <span className="ml-2">Loading...</span>
                      </div>
                    </td>
                  </tr>
                  ) : error ? ( // Add error handling condition
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-red-600">
                        {error}
                      </td>
                    </tr>
                ) : currentReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      {searchTerm 
                        ? `No extracts found matching "${searchTerm}"`
                        : 'No extracts to display'}
                    </td>
                  </tr>
                ) : (
                  currentReports.map((report) => (
                    <tr 
                      key={`report-${report.id}`}
                      className={`hover:bg-gray-100 transition-colors ${
                        parseInt(report.id) % 2 === 0 ? 'bg-[#F3F4F6]' : 'bg-[#F9FAFB]'
                      }`}
                    >
                      <td className="px-4 py-2">{report.extId}</td>
                      <td className="px-4 py-2">{report.name}</td>
                      <td className="px-4 py-2">
                        {report.description?.length > 50
                          ? `${report.description.substring(0, 50)}...`
                          : report.description}
                      </td>
                      <td className="px-4 py-2">{report.lobName}</td>
                      <td className="px-4 py-2">{report.subLobName}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => handleEditClick(report.id)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                        {' | '}
                        <button onClick={() => handleConfigureClick(report.id)} className="text-blue-600 hover:text-blue-800 ml-3">Configure</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination controls - always visible */}
        <div className="bg-white border-t py-4 px-4">
          {!loading && sortedReports.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-700 ml-4">
                  {startIndex + 1}-{Math.min(endIndex, sortedReports.length)} of {sortedReports.length}
                </span>
              </div>
              
              <div className="flex gap-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded ${
                    currentPage === 1 
                      ? 'bg-gray-200 cursor-not-allowed' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {'<<'}
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded ${
                    currentPage === 1 
                      ? 'bg-gray-200 cursor-not-allowed' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {'<'}
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber = currentPage - 2 + i;
                  if (pageNumber <= 0) pageNumber += 5;
                  if (pageNumber > totalPages) pageNumber -= 5;
                  if (pageNumber > 0 && pageNumber <= totalPages) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => handlePageChange(pageNumber)}
                        className={`px-3 py-1 rounded ${
                          currentPage === pageNumber
                            ? 'bg-purple-700 text-white'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  }
                  return null;
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-2 py-1 rounded ${
                    currentPage === totalPages 
                      ? 'bg-gray-200 cursor-not-allowed' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {'>'}
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`px-2 py-1 rounded ${
                    currentPage === totalPages 
                      ? 'bg-gray-200 cursor-not-allowed' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {'>>'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Extract Modal */}
      {editingReportId && (
        <EditReportFlow
          reportId={editingReportId}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Add Configure Report Modal */}
      {configuringReportId && (
        <ConfigureReportModal
          isOpen={true}
          onClose={handleConfigureClose}
          reportId={configuringReportId}
        />
      )}

    </div>
  );
}