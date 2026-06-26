import { v4 as uuidv4 } from 'uuid';
import type { ChartFile, ChartFolder, ChartStep, LayoutElement, LayoutConnection } from '@/types';

// ───────────────────────────────────────────────────────────
//  Seed Data: Blow Molding – Side Step LH, RH
// ───────────────────────────────────────────────────────────

const makeStep = (
  no: number,
  description: string,
  operator: ChartStep['operator'],
  manualTime: number,
  machineTime: number,
  walkingTime: number,
  idleTime: number
): ChartStep => ({
  id: uuidv4(),
  no,
  description,
  operator,
  manualTime,
  machineTime,
  walkingTime,
  idleTime,
});

const blowMoldingSteps: ChartStep[] = [
  makeStep(1,  'Open machine door & take out part',        'Worker A', 8,  0,  0,  0),
  makeStep(2,  'Machine blowing / clamping cycle',         'Auto M/C', 0,  90, 0,  0),
  makeStep(3,  'Close machine door & start auto cycle',    'Worker A', 3,  0,  0,  0),
  makeStep(4,  'Walk to deflashing station',               'Worker A', 0,  0,  4,  0),
  makeStep(5,  'Deflashing / Trimming flash',              'Worker A', 20, 0,  0,  0),
  makeStep(6,  'Visual inspection & weight check',         'Worker A', 8,  0,  0,  0),
  makeStep(7,  'Walk to packing station',                  'Worker A', 0,  0,  4,  0),
  makeStep(8,  'Packing parts into rack / box',            'Worker A', 12, 0,  0,  0),
  makeStep(9,  'Walk back to machine',                     'Worker A', 0,  0,  5,  0),
  makeStep(10, 'Wait for machine cycle to complete',       'Worker A', 0,  0,  0,  26),
];

const layoutElements: LayoutElement[] = [
  { id: uuidv4(), type: 'machine',   label: 'Blow Molding M/C', x: 280, y: 80,  width: 160, height: 80,  color: '#3b82f6' },
  { id: uuidv4(), type: 'table',     label: 'Deflashing Table',  x: 80,  y: 220, width: 130, height: 60,  color: '#6b7280' },
  { id: uuidv4(), type: 'rack',      label: 'Packing Rack',      x: 460, y: 220, width: 120, height: 60,  color: '#10b981' },
  { id: uuidv4(), type: 'worker',    label: 'Worker A',           x: 330, y: 220, width: 60,  height: 60,  color: '#f59e0b' },
  { id: uuidv4(), type: 'conveyor',  label: 'Parts Flow',         x: 200, y: 300, width: 280, height: 30,  color: '#8b5cf6' },
];

const layoutConnections: LayoutConnection[] = [];

export const seedBlowMoldingFile: Omit<ChartFile, 'folderId'> = {
  id: uuidv4(),
  name: 'Side Step LH, RH',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  header: {
    processName: 'Blow Molding',
    partNumber:  'BM-SS-001',
    model:       'Side Step LH, RH',
    cycleTime:   120,
    issueDate:   new Date().toISOString().split('T')[0],
    revNo:       'A',
    preparedBy:  'IE Dept.',
    approvedBy:  'Manager',
  },
  steps: blowMoldingSteps,
  layoutDiagram: {
    elements:    layoutElements,
    connections: layoutConnections,
  },
};

export function buildSeedDatabase() {
  const blowFolder: ChartFolder = {
    id:          uuidv4(),
    name:        'Blow Molding',
    processType: 'blow_molding',
    expanded:    true,
    createdAt:   new Date().toISOString(),
  };

  const injectionFolder: ChartFolder = {
    id:          uuidv4(),
    name:        'Injection Molding',
    processType: 'injection_molding',
    expanded:    false,
    createdAt:   new Date().toISOString(),
  };

  const assemblyFolder: ChartFolder = {
    id:          uuidv4(),
    name:        'Assembly',
    processType: 'assembly',
    expanded:    false,
    createdAt:   new Date().toISOString(),
  };

  const seedFile: ChartFile = {
    ...seedBlowMoldingFile,
    folderId: blowFolder.id,
  };

  return {
    folders:      [blowFolder, injectionFolder, assemblyFolder],
    files:        [seedFile],
    activeFileId: seedFile.id,
  };
}
