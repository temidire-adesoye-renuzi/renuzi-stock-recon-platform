import type { SkuMapping, UnmappedSku } from '../types/recon';

export const skuMappings: SkuMapping[] = [
{
  id: 'm1',
  leverEdgeCode: 'LE-1145',
  leverEdgeName: 'RENUZI CLASSIC LAGER 60CL',
  xeroCode: 'XR-CLG-060',
  xeroName: 'Classic Lager 60cl',
  csFactor: 24,
  dzFactor: 12,
  category: 'Beverages',
  active: true
},
{
  id: 'm2',
  leverEdgeCode: 'LE-2718',
  leverEdgeName: 'MALTA GOLD CAN 33CL',
  xeroCode: 'XR-MLG-033',
  xeroName: 'Malta Gold Can 33cl',
  csFactor: 24,
  dzFactor: 12,
  category: 'Beverages',
  active: true
},
{
  id: 'm3',
  leverEdgeCode: 'LE-3380',
  leverEdgeName: 'SPARKLE TABLE WATER 75CL',
  xeroCode: 'XR-STW-075',
  xeroName: 'Sparkle Water 75cl',
  csFactor: 12,
  dzFactor: 12,
  category: 'Beverages',
  active: true
},
{
  id: 'm4',
  leverEdgeCode: 'LE-4021',
  leverEdgeName: 'RENUZI TOM PASTE 210G',
  xeroCode: 'XR-TMP-210',
  xeroName: 'Tomato Paste 210g',
  csFactor: 48,
  dzFactor: 12,
  category: 'Pantry',
  active: true
},
{
  id: 'm5',
  leverEdgeCode: 'LE-4552',
  leverEdgeName: 'NUZI COOKING OIL 3L',
  xeroCode: 'XR-OIL-3L',
  xeroName: 'Nuzi Cooking Oil 3 Litre',
  csFactor: 6,
  dzFactor: 12,
  category: 'Edible Oils',
  active: true
},
{
  id: 'm6',
  leverEdgeCode: 'LE-5090',
  leverEdgeName: 'RENUZI DETERGENT PWD 1KG',
  xeroCode: 'XR-DET-1KG',
  xeroName: 'Detergent Powder 1kg',
  csFactor: 20,
  dzFactor: 12,
  category: 'Home Care',
  active: true
},
{
  id: 'm7',
  leverEdgeCode: 'LE-6120',
  leverEdgeName: 'MILO REFILL SACHET 12G',
  xeroCode: 'XR-MLO-012',
  xeroName: 'Milo Refill Sachet 12g',
  csFactor: 240,
  dzFactor: 12,
  category: 'Beverages',
  active: false
},
{
  id: 'm8',
  leverEdgeCode: 'LE-6881',
  leverEdgeName: 'RENUZI RICE PREM 5KG',
  xeroCode: 'XR-RCE-5KG',
  xeroName: 'Premium Rice 5kg',
  csFactor: 4,
  dzFactor: 12,
  category: 'Grains',
  active: true
},
{
  id: 'm9',
  leverEdgeCode: 'LE-7314',
  leverEdgeName: 'FRESH YO YOGHURT 100ML',
  xeroCode: 'XR-FYO-100',
  xeroName: 'Fresh Yo Yoghurt 100ml',
  csFactor: 36,
  dzFactor: 12,
  category: 'Dairy',
  active: true
},
{
  id: 'm10',
  leverEdgeCode: 'LE-8025',
  leverEdgeName: 'RENUZI SEASONING CUBES PK',
  xeroCode: 'XR-SSN-PK',
  xeroName: 'Seasoning Cubes Pack',
  csFactor: 60,
  dzFactor: 12,
  category: 'Pantry',
  active: true
}];


export const unmappedSkus: UnmappedSku[] = [
{
  id: 'u1',
  sourceCode: 'LE-9012',
  sourceName: 'RENUZI LAGER 60CL PROMO PK',
  suggestionCode: 'XR-CLG-060',
  suggestionName: 'Classic Lager 60cl',
  confidence: 0.94
},
{
  id: 'u2',
  sourceCode: 'LE-9107',
  sourceName: 'NUZI OIL 3LTR (NEW LABEL)',
  suggestionCode: 'XR-OIL-3L',
  suggestionName: 'Nuzi Cooking Oil 3 Litre',
  confidence: 0.88
},
{
  id: 'u3',
  sourceCode: 'LE-9233',
  sourceName: 'SPARKLE WTR 75CL SHRINK 12',
  suggestionCode: 'XR-STW-075',
  suggestionName: 'Sparkle Water 75cl',
  confidence: 0.71
}];