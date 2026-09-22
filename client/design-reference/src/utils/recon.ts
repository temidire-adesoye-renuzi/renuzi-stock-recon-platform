import type { ComputedRow, CountRow, RowStatus } from '../types/recon';

export function computeRow(row: CountRow): ComputedRow {
  const physicalUnits = row.cs * row.csFactor + row.dz * row.dzFactor + row.pc;
  const docked = Math.max(0, row.leverEdgeQty - physicalUnits);
  const undocked = Math.max(0, row.leverEdgeQty - row.xeroQty);
  const overage = Math.max(0, physicalUnits - row.leverEdgeQty);
  const totalVariance = docked + undocked + overage;

  let status: RowStatus = 'matched';
  if (docked > 0) status = 'discrepancy';else
  if (totalVariance > 0) status = 'review';

  return {
    ...row,
    physicalUnits,
    docked,
    undocked,
    totalVariance,
    status,
    noteRequired: totalVariance >= 10
  };
}

export function summarize(rows: ComputedRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.dockedValue += row.docked * row.unitPrice;
      acc.unrecordedSales += row.undocked;
      if (row.status !== 'matched') acc.atRiskSkus += 1;
      return acc;
    },
    { dockedValue: 0, unrecordedSales: 0, atRiskSkus: 0 }
  );
}