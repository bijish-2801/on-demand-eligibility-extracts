export interface ReportConfig {
  fileFormatId: string;
  fileDelimiterId: string;
  scheduleParameterId: string;
  reportRuntime: string;
  sftpServerId: string;
  sftpPath: string;
  emailDlList: string;
}

export interface DropdownOption {
  id: string;
  name: string;
  description?: string;
  emailDlList?: string;
}

export interface ReportConfigurationDetails {
  lobName: string;
  subLobName: string;
  reportName: string;
  description: string;
}