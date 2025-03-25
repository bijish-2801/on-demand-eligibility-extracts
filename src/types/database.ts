// Define database schema interfaces
export interface FileDelimiter {
  ID: string;
  DELIMITER_NAME: string;
  id?: string;
  name?: string;
  NAME?: string;
}

export interface FileFormat {
  ID: string;
  FORMAT_NAME: string;
  DESCRIPTION: string;
  id?: string;
  name?: string;
  description?: string;
  NAME?: string;
}

export interface SftpServer {
  ID: string;
  SERVER_NAME: string;
  DESCRIPTION: string;
  id?: string;
  name?: string;
  description?: string;
  NAME?: string;
}

// Add more interfaces as needed