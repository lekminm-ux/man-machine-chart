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
  startTime?: number;    // seconds (optional custom start time)
}

export interface ChartHeader {
  processName: string;
  partNumber: string;
  partName: string;
  model: string;
  moldNo: string;
  cycleTime: number; // seconds
  issueDate: string; // ISO date string
  revNo: string;
  preparedBy: string;
  approvedBy: string;
  operatorPositions?: Record<string, string>;
}

export interface WorkerSummary {
  operator: OperatorType;
  manTime: number;
  walkTime: number;
  lineTotal: number;
}

// Layout Diagram Types
export type LayoutElementType =
  // Original equipment
  | 'machine' | 'table' | 'rack' | 'worker' | 'label' | 'arrow_start' | 'conveyor'
  // Extended factory equipment
  | 'robot' | 'jig' | 'inspection' | 'buffer' | 'pallet' | 'door'
  // Basic geometric shapes
  | 'shape_rect' | 'shape_circle' | 'shape_diamond' | 'shape_ellipse';

/** How an element is drawn. Derived from its type unless overridden. */
export type LayoutShape = 'rect' | 'circle' | 'ellipse' | 'diamond';

export interface LayoutElement {
  id: string;
  type: LayoutElementType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  shape?: LayoutShape;   // overrides the default shape for the type
  fontSize?: number;     // label size in px (default 11)
  fontBold?: boolean;    // bold label (default true)
  rotation?: number;     // clockwise degrees, default 0
}

export type ConnStyle = 'solid' | 'dashed' | 'dotted';
export type ConnArrow = 'end' | 'both' | 'none';
export type ConnRouting = 'straight' | 'orthogonal';

export interface LayoutPoint { x: number; y: number; }

/**
 * A connector. Each end is either attached to an element (fromId/toId) or a
 * free floating point (fromPt/toPt). A "free arrow" has both ends floating and
 * belongs to no element, so it can be drawn and moved anywhere on the canvas.
 */
export interface LayoutConnection {
  id: string;
  fromId?: string;
  toId?: string;
  fromPt?: LayoutPoint;    // used when fromId is absent
  toPt?: LayoutPoint;      // used when toId is absent
  label?: string;
  color?: string;          // line + arrow colour (default slate)
  style?: ConnStyle;       // solid / dashed / dotted (default solid)
  arrow?: ConnArrow;       // arrowhead direction (default 'end')
  routing?: ConnRouting;   // straight or right-angle path (default 'straight')
}

export interface LayoutDiagram {
  elements: LayoutElement[];
  connections: LayoutConnection[];
}

// File & Folder
export interface LapTime {
  id: string;
  lapNumber: number;
  timeSeconds: number;
}

export interface TimeMeasurement {
  laps: LapTime[];
  minTime: number;
  maxTime: number;
  avgTime: number;
  fluctuation: number;
  taktTime: number;
}

export interface ChartFile {
  id: string;
  name: string;
  folderId: string;
  createdAt: string;
  updatedAt: string;
  header: ChartHeader;
  steps: ChartStep[];
  layoutDiagram: LayoutDiagram;
  timeMeasurement?: TimeMeasurement;
}

export interface ChartFolder {
  id: string;
  parentId?: string | null;
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
