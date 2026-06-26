// ============================================================
// Man-Machine Chart – Core Types
// ============================================================

export type ProcessType = 'blow_molding' | 'injection_molding' | 'assembly' | 'custom';

export type OperatorType =
  | 'Worker A' | 'Worker B' | 'Worker C' | 'Worker D' | 'Worker E'
  | 'Worker F' | 'Worker G' | 'Worker H' | 'Worker I' | 'Worker J'
  | 'Auto M/C';

export const ALL_WORKERS: OperatorType[] = [
  'Worker A', 'Worker B', 'Worker C', 'Worker D', 'Worker E',
  'Worker F', 'Worker G', 'Worker H', 'Worker I', 'Worker J',
];

export interface ChartStep {
  id: string;
  no: number;
  description: string;
  operator: OperatorType;
  manualTime: number;    // seconds
  machineTime: number;   // seconds (Auto M/C)
  walkingTime: number;   // seconds
  idleTime: number;      // seconds
}

export interface ChartHeader {
  processName: string;
  partNumber: string;
  model: string;
  cycleTime: number; // seconds
  issueDate: string; // ISO date string
  revNo: string;
  preparedBy: string;
  approvedBy: string;
}

export interface WorkerSummary {
  operator: OperatorType;
  manTime: number;
  walkTime: number;
  lineTotal: number;
}

// Layout Diagram Types
export type LayoutElementType = 'machine' | 'table' | 'rack' | 'worker' | 'label' | 'arrow_start' | 'conveyor';

export interface LayoutElement {
  id: string;
  type: LayoutElementType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface LayoutConnection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

export interface LayoutDiagram {
  elements: LayoutElement[];
  connections: LayoutConnection[];
}

// File & Folder
export interface ChartFile {
  id: string;
  name: string;
  folderId: string;
  createdAt: string;
  updatedAt: string;
  header: ChartHeader;
  steps: ChartStep[];
  layoutDiagram: LayoutDiagram;
}

export interface ChartFolder {
  id: string;
  name: string;
  processType: ProcessType;
  expanded: boolean;
  createdAt: string;
}

export interface AppDatabase {
  folders: ChartFolder[];
  files: ChartFile[];
  activeFileId: string | null;
}
