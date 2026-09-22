export type RowStatus = 'matched' | 'discrepancy' | 'review';

export interface CountRow {
  id: string;
  sku: string;
  name: string;
  csFactor: number;
  dzFactor: number;
  cs: number;
  dz: number;
  pc: number;
  leverEdgeQty: number;
  xeroQty: number;
  unitPrice: number;
  locked?: boolean;
  note?: string;
}

export interface ComputedRow extends CountRow {
  physicalUnits: number;
  docked: number;
  undocked: number;
  totalVariance: number;
  status: RowStatus;
  noteRequired: boolean;
}

export interface VarianceRecord {
  id: string;
  sku: string;
  name: string;
  location: string;
  category: string;
  leverEdgeQty: number;
  physicalUnits: number;
  docked: number;
  undocked: number;
  dockedValue: number;
  status: RowStatus;
  flagged: boolean;
}

export interface SkuMapping {
  id: string;
  leverEdgeCode: string;
  leverEdgeName: string;
  xeroCode: string;
  xeroName: string;
  csFactor: number;
  dzFactor: number;
  category: string;
  active: boolean;
}

export interface UnmappedSku {
  id: string;
  sourceCode: string;
  sourceName: string;
  suggestionCode: string;
  suggestionName: string;
  confidence: number;
}