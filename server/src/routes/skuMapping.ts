import { Router, type Response } from 'express'
import multer from 'multer'
import {
  createMapping,
  deleteMapping,
  importMappingsFromCsv,
  listMappings,
  updateMapping,
  type SkuMappingOpResult,
} from '../services/skuMapService.js'

/**
 * Admin SKU mapping API. Mounted under /api/v1/admin/sku-mapping behind
 * requireAuth + requireRole('admin'). Since Phase 3 the source of truth is
 * the SkuMap table in the master workbook; the Phase 2 CSV seed survives as
 * a bulk-import source via POST /import.
 */
export const skuMappingRouter = Router()

function sendOpResult(res: Response, result: SkuMappingOpResult, created = false): void {
  if (result.ok) {
    res.status(created ? 201 : 200).json({ mapping: result.entry })
    return
  }
  const status =
    result.error === 'SKU_MAPPING_NOT_FOUND'
      ? 404
      : result.error === 'SKU_MAPPING_EXISTS'
        ? 409
        : 400
  res.status(status).json({ error: result.error })
}

skuMappingRouter.get('/', (_req, res): void => {
  listMappings()
    .then((mappings) => res.json({ mappings }))
    .catch((error: unknown) => {
      res.status(500).json({ error: 'STORAGE_ERROR', message: (error as Error).message })
    })
})

skuMappingRouter.post('/', (req, res): void => {
  createMapping(req.body, req.user).then((result) => sendOpResult(res, result, true))
})

skuMappingRouter.put('/:code', (req, res): void => {
  updateMapping(req.params.code, req.body, req.user).then((result) => sendOpResult(res, result))
})

skuMappingRouter.delete('/:code', (req, res): void => {
  deleteMapping(req.params.code, req.user).then((result) => sendOpResult(res, result))
})

const uploadCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

/** Bulk import of SKU mappings from a CSV upload (Phase 2 seed format). */
skuMappingRouter.post('/import', uploadCsv.single('file'), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: 'CSV_FILE_REQUIRED', field: 'file' })
    return
  }
  importMappingsFromCsv(req.file.buffer.toString('utf-8'), req.user)
    .then((result) => res.status(200).json(result))
    .catch((error: unknown) => {
      res.status(400).json({ error: 'IMPORT_FAILED', message: (error as Error).message })
    })
})
