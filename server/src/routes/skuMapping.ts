import { Router } from 'express'
import {
  createSkuMapping,
  deleteSkuMapping,
  listSkuMappings,
  updateSkuMapping,
  type SkuMappingOpResult,
} from '../services/skuMappingStore.js'

/**
 * Admin SKU mapping API. Mounted under /api/v1/admin/sku-mapping behind
 * requireAuth + requireRole('admin'). Operates on the CSV seed and persists
 * back to disk (Phase 3 migrates this to the Excel SKUMapping sheet).
 */
export const skuMappingRouter = Router()

function sendOpResult(
  res: import('express').Response,
  result: SkuMappingOpResult,
  created = false
): void {
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
  res.json({ mappings: listSkuMappings() })
})

skuMappingRouter.post('/', (req, res): void => {
  sendOpResult(res, createSkuMapping(req.body), true)
})

skuMappingRouter.put('/:code', (req, res): void => {
  sendOpResult(res, updateSkuMapping(req.params.code, req.body))
})

skuMappingRouter.delete('/:code', (req, res): void => {
  sendOpResult(res, deleteSkuMapping(req.params.code))
})
