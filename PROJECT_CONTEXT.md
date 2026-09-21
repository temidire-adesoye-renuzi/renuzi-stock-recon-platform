# PROJECT_CONTEXT — Permanent Project Memory

PROJECT: Automated Stock Reconciliation & Variance Platform for Renuzi Ventures.
PURPOSE: Warehouses (Ketu, Lekki) submit 3 daily sources: LeverEdge export (sales system), Xero export (accounting), Physical stock count. Backend reconciles them and appends rows to a Master Excel workbook on OneDrive via Microsoft Graph. Power BI reads that workbook.
GOAL: Expose docked sales (LeverEdge vs Physical), unrecorded sales (Physical vs Xero), total variance (LeverEdge vs Xero), auto-reorder risk, with a hard daily edit lock at 18:00 Africa/Lagos.
STACK: React+Vite+TS+Tailwind+React Hook Form+Zod / Express+TS+Multer+XLSX(SheetJS)+@azure/msal-node+@microsoft/microsoft-graph-client. NO DATABASE — Excel workbook is the source of truth. Free hosting: Render (server) + Vercel (client).
FILE QUIRKS (all 3 exports): title blocks above header row (scan for headers by name, skip "Total"/"Grand Total" rows); SKU codes mixed types (numeric, alphanumeric like LUX85GCP, 13-digit barcodes like 7791293049250 — always TEXT); fractional quantities possible (0.125); Physical report has CS/DZ/PC columns needing conversion via SKU mapping factors.
FORMULAS: Docked = LeverEdge − Physical_Units; Undocked = Physical_Units − Xero; Total Variance = LeverEdge − Xero; Legacy cols: Shortage = max(Xero−LeverEdge,0), Surplus = max(LeverEdge−Xero,0), Sellable_Forward = Surplus.
ROLES: warehouse_manager (own location only, edit until 18:00 WAT), executive (read-all + flag), admin (full).
DESIGN: dark default #0F172A, slate surfaces, accent #00B5D8, Lucide icons, minimalist.
WORKBOOK SHEETS: Reconciliation, SKUMapping, AuditLog (schemas defined in server code Phase 3).
