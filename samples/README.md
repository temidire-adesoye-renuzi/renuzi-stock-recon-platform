# Samples

Place the following daily export sample files in this folder:

- `leveredge_sample.xlsx` — LeverEdge sales system export
- `xero_sample.xlsx` — Xero accounting export
- `physical_sample.xlsx` — Physical stock count report (CS/DZ/PC columns)

`sku_seed.csv` contains the SKU mapping seed (LeverEdge ↔ Xero item codes, CS/DZ conversion factors, category, active flag). It currently has headers only and will be populated later.

These sample files are used for parser development and mock-mode testing. They are intentionally NOT gitignored — commit redacted/sample exports only, never real customer data.
