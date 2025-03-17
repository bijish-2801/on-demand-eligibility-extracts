// Add support for different delimiters
export const convertToCSV = (data: any[], columns: string[], delimiter: string = ','): string => {
  // Create header row
  const headerRow = columns.join(delimiter);
  
  // Process rows in chunks to avoid memory issues with large datasets
  const processRowsInChunks = (rows: any[], chunkSize = 1000): string => {
    let result = '';
    
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      
      const chunkRows = chunk.map(row => {
        return columns.map(column => {
          const cellData = row[column]?.toString() || '';
          // Need to handle escaping based on delimiter type
          if (delimiter === ',') {
            // For CSV, escape quotes and wrap in quotes if contains delimiter, quotes or newlines
            if (cellData.includes('"') || cellData.includes(delimiter) || cellData.includes('\n')) {
              return `"${cellData.replace(/"/g, '""')}"`;
            }
          } else {
            // For other delimiters, wrap in quotes if it contains the delimiter or newlines
            if (cellData.includes(delimiter) || cellData.includes('\n')) {
              return `"${cellData}"`;
            }
          }
          return cellData;
        }).join(delimiter);
      });
      
      result += chunkRows.join('\n') + (i + chunkSize < rows.length ? '\n' : '');
    }
    
    return result;
  };
  
  const csvBody = processRowsInChunks(data);
  return headerRow + (csvBody ? '\n' + csvBody : '');
};

export const downloadCSV = (csvContent: string, filename: string, fileExtension: string = 'csv'): void => {
  // Set the appropriate mime type based on file extension
  const mimeType = fileExtension === 'csv' ? 'text/csv' : 'text/plain'; 
  const blob = new Blob([csvContent], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.${fileExtension}`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // Clean up
};