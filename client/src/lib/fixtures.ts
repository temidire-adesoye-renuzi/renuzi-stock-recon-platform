/**
 * Mock dataset — deterministic, realistic FMCG distributor fixtures (Unilever
 * style lines: Closeup, Pepsodent, Knorr, Vaseline, Rexona, Royco…). Prices are
 * NGN in the tens of thousands, quantities in units, physical counts in
 * CS/DZ/PC with per-SKU conversion factors. Generated once at first load and
 * persisted to localStorage by mockApi.
 */
import type { AuditEntry, ReconciliationRow, SkuMappingEntry, UnmappedSku } from './apiTypes'
import { bestMatch } from './fuzzy'
import { lastLagosDates } from './wat'

export interface MockUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'executive' | 'warehouse_manager'
  location?: string
  password: string
}

/** Mock accepts any password; `password` documents the real seed value. */
export const MOCK_USERS: MockUser[] = [
  { id: 'usr_admin', email: 'admin@renuzi', name: 'Renuzi Admin', role: 'admin', password: 'Admin@2026' },
  {
    id: 'usr_exec',
    email: 'exec@renuzi',
    name: 'Chidinma Eze',
    role: 'executive',
    password: 'Exec@2026',
  },
  {
    id: 'usr_ketu',
    email: 'ketu@renuzi',
    name: 'Tunde Bakare',
    role: 'warehouse_manager',
    location: 'Ketu',
    password: 'Ketu@2026',
  },
  {
    id: 'usr_lekki',
    email: 'lekki@renuzi',
    name: 'Adaeze Okafor',
    role: 'warehouse_manager',
    location: 'Lekki',
    password: 'Lekki@2026',
  },
]

export const LOCATIONS = ['Ketu', 'Lekki']

interface SeedSku {
  code: string
  name: string
  xeroName: string
  csFactor: number
  dzFactor: number
  category: string
  price: number
  active?: boolean
}

const SEED_SKUS: SeedSku[] = [
  // Oral Care
  { code: '65225884', name: 'CLOSEUP CFP 36X130G RC PROMO', xeroName: 'Closeup CFP 36x130g RC Promo', csFactor: 36, dzFactor: 12, category: 'Oral Care', price: 41365 },
  { code: '69654190', name: 'CLOSEUP COMP. FRESH PROTECT 36X130G', xeroName: 'Closeup Fresh Protect 36x130g', csFactor: 36, dzFactor: 12, category: 'Oral Care', price: 41366 },
  { code: '62768295', name: 'CLOSEUP COMPLETE FRESH 72X35G', xeroName: 'Closeup Complete Fresh 72x35g', csFactor: 72, dzFactor: 12, category: 'Oral Care', price: 27941 },
  { code: '65439627', name: 'CLOSEUP TF REDHOT RC PROMO 50X130G', xeroName: 'Closeup TF Redhot RC Promo 50x130g', csFactor: 50, dzFactor: 12, category: 'Oral Care', price: 50875 },
  { code: '68275727', name: 'CLOSEUP TP EVERFRESH GRN 50 X 140G', xeroName: 'Closeup Everfresh Green 50x140g', csFactor: 50, dzFactor: 12, category: 'Oral Care', price: 50875 },
  { code: '65640762', name: 'CLOSEUP TP TRIPLE FRESH RH 264X8.5', xeroName: 'Closeup Triple Fresh RH 264x8.5g', csFactor: 264, dzFactor: 12, category: 'Oral Care', price: 14403 },
  { code: '57300211', name: 'PEPSODENT TRIPLE CLEAN 12X160G', xeroName: 'Pepsodent Triple Clean 12x160g', csFactor: 12, dzFactor: 12, category: 'Oral Care', price: 31560 },
  { code: '57311488', name: 'PEPSODENT WHITENING 50X140G TUBE', xeroName: 'Pepsodent Whitening 50x140g', csFactor: 50, dzFactor: 12, category: 'Oral Care', price: 48220 },
  { code: '57333015', name: 'PEPSODENT GUM CARE 6X9X80G FAMILY', xeroName: 'Pepsodent Gum Care Family Pack', csFactor: 54, dzFactor: 12, category: 'Oral Care', price: 33980 },
  // Seasonings & Food
  { code: '21033927', name: 'KNORR CHICKEN 6 X 1KG', xeroName: 'Knorr Chicken 6x1kg', csFactor: 6, dzFactor: 12, category: 'Seasonings', price: 66349 },
  { code: '21060383', name: 'KNORR BEEF BOULION CUBE FORTI 16X50X8G', xeroName: 'Knorr Beef Bouillon Forti 16x50x8g', csFactor: 800, dzFactor: 12, category: 'Seasonings', price: 29520 },
  { code: '21060394', name: 'KNORR CHICKEN BOULION CUBE FORT 16X50X8G', xeroName: 'Knorr Chicken Bouillon Forti 16x50x8g', csFactor: 800, dzFactor: 12, category: 'Seasonings', price: 28890 },
  { code: '21890441', name: 'KNORR COOKING SEASONING CUBE 400X10G', xeroName: 'Knorr Cooking Cube 400x10g', csFactor: 400, dzFactor: 12, category: 'Seasonings', price: 39750 },
  { code: '20011987', name: 'ROYCO CHICKEN CUBES 100X10G CARTON', xeroName: 'Royco Chicken Cubes 100x10g', csFactor: 100, dzFactor: 12, category: 'Seasonings', price: 27430 },
  { code: '20012644', name: 'ROYCO BEEF CUBES 100X10G CARTON', xeroName: 'Royco Beef Cubes 100x10g', csFactor: 100, dzFactor: 12, category: 'Seasonings', price: 26980 },
  // Skin Care
  { code: '13007761', name: 'VASILINE INTENSIVE CARE LOTION 24X100ML', xeroName: 'Vaseline Intensive Care 100ml', csFactor: 24, dzFactor: 12, category: 'Skin Care', price: 44610 },
  { code: '13008904', name: 'VASILINE PETROLEUM JELLY 12X250ML', xeroName: 'Vaseline Petroleum Jelly 250ml', csFactor: 12, dzFactor: 12, category: 'Skin Care', price: 52240 },
  { code: '13012955', name: 'VASILINE ALOE FRESH 6X400ML', xeroName: 'Vaseline Aloe Fresh 400ml', csFactor: 6, dzFactor: 12, category: 'Skin Care', price: 49870 },
  { code: '13466012', name: 'LUX CREAMY PERFECTION 24X85G', xeroName: 'Lux Creamy Perfection 24x85g', csFactor: 24, dzFactor: 12, category: 'Skin Care', price: 30290 },
  { code: '13468107', name: 'PEARS TRANSPARENT SOAP 72X90G', xeroName: 'Pears Transparent 72x90g', csFactor: 72, dzFactor: 12, category: 'Skin Care', price: 41560 },
  // Personal Care
  { code: '87003219', name: 'REXONA WOMEN SHOWER CLEAN 48X45G', xeroName: 'Rexona Women Shower Clean 48x45g', csFactor: 48, dzFactor: 12, category: 'Personal Care', price: 38770 },
  { code: '87004866', name: 'REXONA MEN ANTIPERSPIRANT 36X50G', xeroName: 'Rexona Men Antiperspirant 36x50g', csFactor: 36, dzFactor: 12, category: 'Personal Care', price: 45340 },
  { code: '87006431', name: 'LIFEBUOY TOTAL 10 SOAP 120X105G', xeroName: 'Lifebuoy Total 10 120x105g', csFactor: 120, dzFactor: 12, category: 'Personal Care', price: 58210 },
  { code: '87007588', name: 'LIFEBUOY HANDWASH REFILL 24X750ML', xeroName: 'Lifebuoy Handwash Refill 750ml', csFactor: 24, dzFactor: 12, category: 'Personal Care', price: 47630 },
  // Home Care
  { code: '44007156', name: 'OMO MULTIACTIVE DETERGENT 12X900G', xeroName: 'Omo Multiactive 900g', csFactor: 12, dzFactor: 12, category: 'Home Care', price: 56480 },
  { code: '44008813', name: 'OMO ULTRA POWDER 4X3KG', xeroName: 'Omo Ultra 3kg', csFactor: 4, dzFactor: 12, category: 'Home Care', price: 59800 },
  { code: '44015922', name: 'SUNLIGHT DISHWASH 48X300G', xeroName: 'Sunlight Dishwash 300g', csFactor: 48, dzFactor: 12, category: 'Home Care', price: 33910 },
  { code: '44016477', name: 'SURF EXCEL QUICK WASH 20X500G', xeroName: 'Surf Quick Wash 500g', csFactor: 20, dzFactor: 12, category: 'Home Care', price: 36140 },
  // Beverages
  { code: '35100338', name: 'LIPTON YELLOW LABEL 24X50X2G', xeroName: 'Lipton Yellow Label 24x50x2g', csFactor: 1200, dzFactor: 12, category: 'Beverages', price: 41020 },
  { code: '35101795', name: 'LIPTON GREEN TEA 60X2G X24', xeroName: 'Lipton Green Tea 24 bags', csFactor: 24, dzFactor: 12, category: 'Beverages', price: 37660 },
// Real SKUs from samples/leveredge_sample.xlsx (enriched with physical list prices) so
  // the /samples files reconcile richly in the demo.
  { code: "64817465", name: "CLOSEUP TOOTHPASTE TRIPLE FRESH 4X8X175G", xeroName: "Closeup Toothpaste Triple Fresh 4x8x175g", csFactor: 4, dzFactor: 12, category: "Oral Care", price: 37332 },
  { code: "65762767", name: "CLOSEUP TP EVERFRESH GRN 50 X 140G LOCAL", xeroName: "Closeup Tp Everfresh Grn 50 X 140g Local", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 47326 },
  { code: "62729974", name: "CLOSEUP TRIPLE FRESH 72X35G", xeroName: "Closeup Triple Fresh 72x35g", csFactor: 72, dzFactor: 12, category: "Oral Care", price: 25019 },
  { code: "69790471", name: "CLOSEUP TRIPLE FRESH RED HOT 50X90G", xeroName: "Closeup Triple Fresh Red Hot 50x90g", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 33003 },
  { code: "69790460", name: "CLOSEUP TRIPLE FRESH REDHOT 50X130G", xeroName: "Closeup Triple Fresh Redhot 50x130g", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 47326 },
  { code: "FGDW013", name: "DE WAVE CITRUS BREEZE 170G X 26", xeroName: "De Wave Citrus Breeze 170g X 26", csFactor: 1, dzFactor: 12, category: "Pantry", price: 10550 },
  { code: "FGDW004", name: "DE WAVE CITRUS BREEZE 70G X 51", xeroName: "De Wave Citrus Breeze 70g X 51", csFactor: 1, dzFactor: 12, category: "Pantry", price: 9850 },
  { code: "FGDW006", name: "DE WAVE HIBISCUS BREEZE 70G X 51", xeroName: "De Wave Hibiscus Breeze 70g X 51", csFactor: 1, dzFactor: 12, category: "Pantry", price: 9850 },
  { code: "69578306", name: "KNORR BEEF 20X20X8G", xeroName: "Knorr Beef 20x20x8g", csFactor: 20, dzFactor: 12, category: "Seasonings", price: 15079 },
  { code: "64401562", name: "KNORR BEEF BTF 14X50X8G", xeroName: "Knorr Beef Btf 14x50x8g", csFactor: 14, dzFactor: 12, category: "Seasonings", price: 25514 },
  { code: "68137064", name: "KNORR BEEF CHAPPAL 40X12X8G", xeroName: "Knorr Beef Chappal 40x12x8g", csFactor: 40, dzFactor: 12, category: "Seasonings", price: 18220 },
  { code: "69578271", name: "KNORR CHICKEN 20X20X8G", xeroName: "Knorr Chicken 20x20x8g", csFactor: 20, dzFactor: 12, category: "Seasonings", price: 15883 },
  { code: "64401568", name: "KNORR CHICKEN BTF14X50X8G", xeroName: "Knorr Chicken Btf14x50x8g", csFactor: 14, dzFactor: 12, category: "Seasonings", price: 25635 },
  { code: "64888305", name: "KNORR CHICKEN POWDER 12X360G", xeroName: "Knorr Chicken Powder 12x360g", csFactor: 12, dzFactor: 12, category: "Seasonings", price: 17472 },
  { code: "67300841", name: "KNORR CHICKEN POWDER FORTI 12X400G", xeroName: "Knorr Chicken Powder Forti 12x400g", csFactor: 12, dzFactor: 12, category: "Seasonings", price: 16553 },
  { code: "65737461", name: "KNORR PARTY JOLLOF SEASONING 13X10X10G", xeroName: "Knorr Party Jollof Seasoning 13x10x10g", csFactor: 13, dzFactor: 12, category: "Seasonings", price: 18605 },
  { code: "32477042", name: "LIPTON YELLOW TEA 200X2 SACHET", xeroName: "Lipton Yellow Tea 200x2 Sachet", csFactor: 200, dzFactor: 12, category: "Beverages", price: 7438 },
  { code: "32008539", name: "LIPTON YL TEA NEW IDENTITY 80X(25X2G)", xeroName: "Lipton Yl Tea New Identity 80x(25x2g)", csFactor: 25, dzFactor: 12, category: "Beverages", price: 36192 },
  { code: "LUX85GCP", name: "LUX BAR CREAMY PERFECTION PW 48X85G", xeroName: "Lux Bar Creamy Perfection Pw 48x85g", csFactor: 48, dzFactor: 12, category: "Skin Care", price: 35000 },
  { code: "LUX85GDD", name: "LUX BAR DREAM DELIGHT 48X85G", xeroName: "Lux Bar Dream Delight 48x85g", csFactor: 48, dzFactor: 12, category: "Skin Care", price: 33000 },
  { code: "UN10009", name: "LUX BLUE AQUA UI MP 24 X (6 X 80G)", xeroName: "Lux Blue Aqua Ui Mp 24 X (6 X 80g)", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 96000 },
  { code: "UN10012", name: "LUX BRIGHT IMPRESS UI MP 24 X (6 X 80G)", xeroName: "Lux Bright Impress Ui Mp 24 X (6 X 80g)", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 96000 },
  { code: "67363284", name: "PEARS BABY JELLY 40X225G", xeroName: "Pears Baby Jelly 40x225g", csFactor: 40, dzFactor: 12, category: "Skin Care", price: 77780 },
  { code: "64997466", name: "PEARS BABY LOTION 4X(10X200ML) - PROMO", xeroName: "Pears Baby Lotion 4x(10x200ml) - Promo", csFactor: 10, dzFactor: 12, category: "Skin Care", price: 47660 },
  { code: "32797230", name: "PEARS BABY OIL RELAUNCH 4X(10x200ML)", xeroName: "Pears Baby Oil Relaunch 4x(10x200ml)", csFactor: 10, dzFactor: 12, category: "Skin Care", price: 68840 },
  { code: "FDPSNCH002", name: "PEP-CHEETOS CHEESE 25GM X 72", xeroName: "Pep-Cheetos Cheese 25gm X 72", csFactor: 1, dzFactor: 12, category: "Pantry", price: 10926 },
  { code: "FDPSNCH005", name: "PEP-CHEETOS COCONUT 25GM X 72", xeroName: "Pep-Cheetos Coconut 25gm X 72", csFactor: 1, dzFactor: 12, category: "Pantry", price: 10926 },
  { code: "FDPCOT058", name: "PEP-QUAKER ALUFOIL SAC MULTI-TRACK 100 X 30GM", xeroName: "Pep-Quaker Alufoil Sac Multi-Track 100 X 30gm", csFactor: 100, dzFactor: 12, category: "Pantry", price: 23166 },
  { code: "FDPCOT074", name: "PEP-QUAKER ALUFOIL SACHET SINGLE-TRACK 100 X 50GM", xeroName: "Pep-Quaker Alufoil Sachet Single-Track 100 X 50gm", csFactor: 100, dzFactor: 12, category: "Pantry", price: 35732 },
  { code: "FDPCOT064", name: "PEP-QUAKER ALUFOIL W/OAT FLOUR LUP 16 X 400GM", xeroName: "Pep-Quaker Alufoil W/Oat Flour Lup 16 X 400gm", csFactor: 16, dzFactor: 12, category: "Pantry", price: 36328 },
  { code: "FDPCOT070", name: "PEP-QUAKER ALUFOIL W/OAT LUP 4 X 1.8KG", xeroName: "Pep-Quaker Alufoil W/Oat Lup 4 X 1.8kg", csFactor: 4, dzFactor: 12, category: "Pantry", price: 41148 },
  { code: "FDPCOT073", name: "PEP-QUAKER ALUFOIL W/OAT LUP 8 X 850GM", xeroName: "Pep-Quaker Alufoil W/Oat Lup 8 X 850gm", csFactor: 8, dzFactor: 12, category: "Pantry", price: 42048 },
  { code: "FDPCOT055", name: "PEP-QUAKER W/OATS NEW - ALUFOIL 16X385GM", xeroName: "Pep-Quaker W/Oats New - Alufoil 16x385gm", csFactor: 16, dzFactor: 12, category: "Pantry", price: 39303 },
  { code: "FDPCOT043", name: "PEP-QUAKER W/OATS NEW-(TIN) 24 X 420GM", xeroName: "Pep-Quaker W/Oats New-(Tin) 24 X 420gm", csFactor: 24, dzFactor: 12, category: "Pantry", price: 71799 },
  { code: "65436912", name: "PEPSODENT 123 130G + PEP CHAR 50X120G", xeroName: "Pepsodent 123 130g + Pep Char 50x120g", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 53444 },
  { code: "64864641", name: "PEPSODENT 3 PROTECT COML. 24X2X130G", xeroName: "Pepsodent 3 Protect Coml. 24x2x130g", csFactor: 24, dzFactor: 12, category: "Oral Care", price: 45419 },
  { code: "69655756", name: "PEPSODENT CAVITY FIGHTER 240X8.5G", xeroName: "Pepsodent Cavity Fighter 240x8.5g", csFactor: 240, dzFactor: 12, category: "Oral Care", price: 10128 },
  { code: "69654208", name: "PEPSODENT CAVITY FIGHTER 50 X 130G", xeroName: "Pepsodent Cavity Fighter 50 X 130g", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 43378 },
  { code: "65436915", name: "PEPSODENT CF 264X8.5G +1STR PEP CHAR", xeroName: "Pepsodent Cf 264x8.5g +1str Pep Char", csFactor: 264, dzFactor: 12, category: "Oral Care", price: 12180 },
  { code: "64819114", name: "PEPSODENT THPASTE 123 COMPLETE 4X8X175G", xeroName: "Pepsodent Thpaste 123 Complete 4x8x175g", csFactor: 4, dzFactor: 12, category: "Oral Care", price: 42311 },
  { code: "64943267", name: "PEPSODENT TOOTHPASTE CHARCOAL 240 X 8.5G", xeroName: "Pepsodent Toothpaste Charcoal 240 X 8.5g", csFactor: 240, dzFactor: 12, category: "Oral Care", price: 12178 },
  { code: "64807107", name: "PEPSODENT TOOTHPASTE CHARCOAL 50X120G", xeroName: "Pepsodent Toothpaste Charcoal 50x120g", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 58140 },
  { code: "65640765", name: "PEPSODENT TP CAVITY FIGHTER 264X8.5G", xeroName: "Pepsodent Tp Cavity Fighter 264x8.5g", csFactor: 264, dzFactor: 12, category: "Oral Care", price: 13397 },
  { code: "62768303", name: "PEPSODENT TRIPLE COMPL 72X35G", xeroName: "Pepsodent Triple Compl 72x35g", csFactor: 72, dzFactor: 12, category: "Oral Care", price: 25992 },
  { code: "7791293049250", name: "REXONA AP MEN B/SPRAY ACTIVE DRY 72HRS 200ML X 12", xeroName: "Rexona Ap Men B/Spray Active Dry 72hrs 200ml X 12", csFactor: 1, dzFactor: 12, category: "Personal Care", price: 30000 },
  { code: "65623826", name: "REXONA BRIGHT BOUQUET RO 4X6X46ML", xeroName: "Rexona Bright Bouquet Ro 4x6x46ml", csFactor: 4, dzFactor: 12, category: "Personal Care", price: 29581 },
  { code: "65623814", name: "REXONA MEN SPORT DEF RO 4X6X46ML", xeroName: "Rexona Men Sport Def Ro 4x6x46ml", csFactor: 4, dzFactor: 12, category: "Personal Care", price: 29581 },
  { code: "69972130", name: "REXONA MEN SPORT DEF RO 4X6X50ML", xeroName: "Rexona Men Sport Def Ro 4x6x50ml", csFactor: 4, dzFactor: 12, category: "Personal Care", price: 29581 },
  { code: "65623820", name: "REXONA MEN XTRACOOL RO 4X6X46ML", xeroName: "Rexona Men Xtracool Ro 4x6x46ml", csFactor: 4, dzFactor: 12, category: "Personal Care", price: 29581 },
  { code: "69975975", name: "REXONA MEN XTRACOOL RO 4X6X50ML", xeroName: "Rexona Men Xtracool Ro 4x6x50ml", csFactor: 4, dzFactor: 12, category: "Personal Care", price: 29581 },
  { code: "65623832", name: "REXONA SHOWER FRESH RO 4X6X46ML", xeroName: "Rexona Shower Fresh Ro 4x6x46ml", csFactor: 4, dzFactor: 12, category: "Personal Care", price: 29581 },
  { code: "69972153", name: "REXONA WM BRIGHT BOUQUET 4X6X50ML", xeroName: "Rexona Wm Bright Bouquet 4x6x50ml", csFactor: 4, dzFactor: 12, category: "Personal Care", price: 29581 },
  { code: "64797692", name: "ROYCO BEEF BULK 5X500X4G", xeroName: "Royco Beef Bulk 5x500x4g", csFactor: 5, dzFactor: 12, category: "Seasonings", price: 28669 },
  { code: "67568581", name: "ROYCO BEEF MANDARA 20X100X4G", xeroName: "Royco Beef Mandara 20x100x4g", csFactor: 20, dzFactor: 12, category: "Seasonings", price: 24388 },
  { code: "CDFG000351", name: "TGI-BIG BULL RICE 2.25KG", xeroName: "Tgi-Big Bull Rice 2.25kg", csFactor: 1, dzFactor: 12, category: "Pantry", price: 12150 },
  { code: "CDFG000010", name: "TGI-BIG BULL RICE BAG 5KG", xeroName: "Tgi-Big Bull Rice Bag 5kg", csFactor: 1, dzFactor: 12, category: "Pantry", price: 6650 },
  { code: "CDFG000468", name: "TGI-BIG BULL RICE GOLD N300", xeroName: "Tgi-Big Bull Rice Gold N300", csFactor: 1, dzFactor: 12, category: "Pantry", price: 13500 },
  { code: "CDFG000495", name: "TGI-GOLDEN TERRA AMAANA OIL 750ML", xeroName: "Tgi-Golden Terra Amaana Oil 750ml", csFactor: 1, dzFactor: 12, category: "Pantry", price: 23600 },
  { code: "CDFG000377", name: "TGI-GOLDEN TERRA SOYA OIL 1.4 LTRS X 6", xeroName: "Tgi-Golden Terra Soya Oil 1.4 Ltrs X 6", csFactor: 1, dzFactor: 12, category: "Pantry", price: 33900 },
  { code: "CDFG000352", name: "TGI-GOLDEN TERRA SOYA OIL 1000ML X 12", xeroName: "Tgi-Golden Terra Soya Oil 1000ml X 12", csFactor: 1, dzFactor: 12, category: "Pantry", price: 30100 },
  { code: "CDFG000454", name: "TGI-GOLDEN TERRA SOYA OIL 3 LTRS X 6", xeroName: "Tgi-Golden Terra Soya Oil 3 Ltrs X 6", csFactor: 1, dzFactor: 12, category: "Pantry", price: 56400 },
  { code: "CDFG000488", name: "TGI-GOLDEN TERRA SOYA OIL 5 LTRS X 4 PROMO P", xeroName: "Tgi-Golden Terra Soya Oil 5 Ltrs X 4 Promo P", csFactor: 1, dzFactor: 12, category: "Home Care", price: 61200 },
  { code: "CDFG000322", name: "TGI-GOLDEN TERRA SOYA OIL 700ML X 12", xeroName: "Tgi-Golden Terra Soya Oil 700ml X 12", csFactor: 1, dzFactor: 12, category: "Pantry", price: 33900 },
  { code: "CDFG000491", name: "TGI-PEPPE TERRA 50G X 50", xeroName: "Tgi-Peppe Terra 50g X 50", csFactor: 1, dzFactor: 12, category: "Pantry", price: 7000 },
  { code: "CDFG000464", name: "TGI-PEPPE TERRA 55G X 50", xeroName: "Tgi-Peppe Terra 55g X 50", csFactor: 1, dzFactor: 12, category: "Pantry", price: 7000 },
  { code: "CDFG000494", name: "TGI-TERRA CHICKEN 20 X 60", xeroName: "Tgi-Terra Chicken 20 X 60", csFactor: 20, dzFactor: 12, category: "Pantry", price: 16500 },
  { code: "CDFG000504", name: "TGI-TERRA CHICKEN 50X20 (IN CTN 20+1) PROMO", xeroName: "Tgi-Terra Chicken 50x20 (In Ctn 20+1) Promo", csFactor: 50, dzFactor: 12, category: "Home Care", price: 14700 },
  { code: "GDFG000489", name: "TGI-TERRA CHICKEN POWDER 400GX12 TASTE MAKER", xeroName: "Tgi-Terra Chicken Powder 400gx12 Taste Maker", csFactor: 1, dzFactor: 12, category: "Pantry", price: 17400 },
  { code: "CDFG000485", name: "TGI-TERRA CRAYFISH 100 X 20", xeroName: "Tgi-Terra Crayfish 100 X 20", csFactor: 100, dzFactor: 12, category: "Pantry", price: 28300 },
  { code: "CDFG000486", name: "TGI-TERRA CRAYFISH 20 X 60", xeroName: "Tgi-Terra Crayfish 20 X 60", csFactor: 20, dzFactor: 12, category: "Pantry", price: 17200 },
  { code: "CDFG000403", name: "TGI-TERRA GOLD 100 X 20", xeroName: "Tgi-Terra Gold 100 X 20", csFactor: 100, dzFactor: 12, category: "Pantry", price: 21800 },
  { code: "65454451", name: "VASELINE ALOE FRESH 6X(6X220ML)", xeroName: "Vaseline Aloe Fresh 6x(6x220ml)", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 67554 },
  { code: "32050304", name: "VASELINE BLUESEAL ORIG PJ 24X12X50ML", xeroName: "Vaseline Blueseal Orig Pj 24x12x50ml", csFactor: 24, dzFactor: 12, category: "Skin Care", price: 146511 },
  { code: "69983845", name: "VASELINE BLUESEAL ORIGNL PJ 4X(6X400ML)", xeroName: "Vaseline Blueseal Orignl Pj 4x(6x400ml)", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 64228 },
  { code: "69983850", name: "VASELINE BLUESEAL ORIGNL PJ 6X(6X225ML)", xeroName: "Vaseline Blueseal Orignl Pj 6x(6x225ml)", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 61405 },
  { code: "21087115", name: "VASELINE BODY LOTION ADVANCE REPAIR 8X6X400ML", xeroName: "Vaseline Body Lotion Advance Repair 8x6x400ml", csFactor: 8, dzFactor: 12, category: "Skin Care", price: 195839 },
  { code: "21087112", name: "VASELINE BODY LOTION ALOE SOOTHE 8X6X400ML", xeroName: "Vaseline Body Lotion Aloe Soothe 8x6x400ml", csFactor: 8, dzFactor: 12, category: "Skin Care", price: 195839 },
  { code: "21087113", name: "VASELINE BODY LOTION COCOA GLOW 8X6X400ML", xeroName: "Vaseline Body Lotion Cocoa Glow 8x6x400ml", csFactor: 8, dzFactor: 12, category: "Skin Care", price: 195839 },
  { code: "21087111", name: "VASELINE BODY LOTION DRYSKINREP 8X6X400ML", xeroName: "Vaseline Body Lotion Dryskinrep 8x6x400ml", csFactor: 8, dzFactor: 12, category: "Skin Care", price: 195839 },
  { code: "20204888", name: "VASELINE BODY LOTION EVENTONE 8X6X400ML", xeroName: "Vaseline Body Lotion Eventone 8x6x400ml", csFactor: 8, dzFactor: 12, category: "Skin Care", price: 195839 },
  { code: "20268731", name: "VASELINE BODY LOTION MEN EXTSTRN 8X6X400ML", xeroName: "Vaseline Body Lotion Men Extstrn 8x6x400ml", csFactor: 8, dzFactor: 12, category: "Skin Care", price: 195839 },
  { code: "65596186", name: "VASELINE BS ALOE FRESH 24X12X45ML", xeroName: "Vaseline Bs Aloe Fresh 24x12x45ml", csFactor: 24, dzFactor: 12, category: "Skin Care", price: 146511 },
  { code: "65596179", name: "VASELINE BS COCOA BUTTER PJ 24X12X45ML", xeroName: "Vaseline Bs Cocoa Butter Pj 24x12x45ml", csFactor: 24, dzFactor: 12, category: "Skin Care", price: 146511 },
  { code: "65454443", name: "VASELINE COCOA BUTTER 6X(6X220ML)", xeroName: "Vaseline Cocoa Butter 6x(6x220ml)", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 67554 },
  { code: "Total", name: "", xeroName: "", csFactor: 1, dzFactor: 12, category: "Pantry", price: 30000 },
  { code: "Total", name: "", xeroName: "", csFactor: 1, dzFactor: 12, category: "Pantry", price: 30000 },
  // Inactive mapping (recently retired promo pack)
  { code: '65225883', name: 'CLOSEUP COMPLETE FRESH 72X35G RC PROMO', xeroName: 'Closeup CF 72x35g RC Promo', csFactor: 72, dzFactor: 12, category: 'Oral Care', price: 27941, active: false },
  { code: '20013201', name: 'ROYCO SHRIMP CUBES 100X10G CARTON', xeroName: 'Royco Shrimp Cubes 100x10g', csFactor: 100, dzFactor: 12, category: 'Seasonings', price: 26110, active: false },
]

export function seedMappings(): SkuMappingEntry[] {
  return SEED_SKUS.map((sku) => ({
    leverEdgeSkuCode: sku.code,
    leverEdgeItemName: sku.name,
    xeroItemCode: sku.code,
    xeroItemName: sku.xeroName,
    csFactor: sku.csFactor,
    dzFactor: sku.dzFactor,
    category: sku.category,
    active: sku.active ?? true,
  }))
}

/** Items that appear in exports but have no mapping (feed the admin review queue). */
const UNMAPPED_SOURCE_ITEMS: Array<{ code: string; name: string }> = [
  { code: '65990127', name: 'CLOSEUP TP EVERFRESH GRN 50X140G XTRA' },
  { code: '13020748', name: 'VASILINE INTENS CARE LOTION 24X100 N' },
  { code: '21084663', name: 'KNORR SHRIMP CUBE FORTI 16X50X8G' },
]

export function seedUnmapped(mappings: SkuMappingEntry[]): UnmappedSku[] {
  const candidates = mappings
    .filter((entry) => entry.active)
    .map((entry) => ({ code: entry.xeroItemCode, name: entry.xeroItemName }))
  return UNMAPPED_SOURCE_ITEMS.flatMap((item, index) => {
    const match = bestMatch(item.name, candidates)
    if (match === null || match.similarity < 0.55) return []
    return [
      {
        id: `seed-u${index}`,
        sourceCode: item.code,
        sourceName: item.name,
        suggestionCode: match.code,
        suggestionName: match.name,
        confidence: Math.round(match.similarity * 100) / 100,
      },
    ]
  })
}

/** Deterministic PRNG (mulberry32) so the demo dataset is stable per seed. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

export interface SeedData {
  reconRows: ReconciliationRow[]
  audit: AuditEntry[]
  unmapped: UnmappedSku[]
}

function isoAt(date: string, hour: number, minute: number): string {
  // WAT is UTC+1 with no DST — a fixed offset converts wall time to an instant.
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`).toISOString()
}

/**
 * 14 days of submissions for both warehouses. Most rows match; ~15% carry a
 * plausible discrepancy; most days include one |variance| >= 10 row (mandatory
 * note case), one unmapped row and one fuzzy-joined needs-review row.
 */
export function generateSeedData(now: Date = new Date()): SeedData {
  const rng = mulberry32(20260922)
  const dates = lastLagosDates(14, now)
  const active = SEED_SKUS.filter((sku) => sku.active ?? true)
  const byCode = new Map(seedMappings().map((entry) => [entry.leverEdgeSkuCode, entry]))
  const rows: ReconciliationRow[] = []
  const audit: AuditEntry[] = []

  dates.forEach((date, dayIndex) => {
    const isToday = dayIndex === dates.length - 1
    LOCATIONS.forEach((location, locationIndex) => {
      const manager = location === 'Ketu' ? 'usr_ketu' : 'usr_lekki'
      const submittedAt = isoAt(date, isToday ? 11 + locationIndex : 17, isToday ? 12 + locationIndex * 21 : 5)
      const count = 26 + Math.floor(rng() * 4)
      const picked = [...active].sort(() => rng() - 0.5).slice(0, count)
      const discrepancyIndex = 2 + Math.floor(rng() * 8)
      const bigVarianceIndex = Math.floor(rng() * count)
      picked.forEach((sku, index) => {
        const entry = byCode.get(sku.code)!
        const cases = 40 + Math.floor(rng() * 90)
        const dz = Math.floor(rng() * 3)
        const pc = Math.floor(rng() * 9)
        const units = round3(cases * entry.csFactor + dz * entry.dzFactor + pc)

        let dockedDelta = 0
        let undockedDelta = 0
        let status: ReconciliationRow['Status'] = 'Matched'
        let needsReview = false
        let notes = ''
        if (index === discrepancyIndex || index === bigVarianceIndex) {
          status = 'Discrepancy'
          const big = index === bigVarianceIndex && dayIndex % 2 === 0
          dockedDelta = big ? 12 + Math.floor(rng() * 14) : 1 + Math.floor(rng() * 8)
          undockedDelta = 1 + Math.floor(rng() * 6)
          if (big) notes = 'Short-supply confirmed with loading bay'
        } else if (index === picked.length - 1) {
          status = 'Discrepancy'
          undockedDelta = 2 + Math.floor(rng() * 5)
        }
        // One fuzzy-joined row most days (needs review).
        if (index === 5 && dayIndex % 3 !== 2) {
          needsReview = true
          notes = 'Auto-matched by name similarity 0.87 — verify'
        }

        const leverEdgeQty = round3(units + dockedDelta + undockedDelta)
        const xeroQty = round3(units - dockedDelta)
        const totalVariance = round3(leverEdgeQty - xeroQty)
        const shortage = round3(Math.max(xeroQty - leverEdgeQty, 0))
        const surplus = round3(Math.max(leverEdgeQty - xeroQty, 0))

        rows.push({
          Date: date,
          Location: location,
          SKU_Code: sku.code,
          Item_Name: sku.name,
          LeverEdge_Qty: leverEdgeQty,
          Xero_Qty: xeroQty,
          Physical_CS: cases,
          Physical_DZ: dz,
          Physical_PC: pc,
          Physical_Units: units,
          Docked_Qty: round3(leverEdgeQty - units),
          Undocked_Qty: round3(units - xeroQty),
          Total_Variance: totalVariance,
          Unit_Price_NGN: sku.price,
          Variance_Value_NGN: round3(totalVariance * sku.price),
          Shortage_Qty: shortage,
          Surplus_Qty: surplus,
          Sellable_Forward_Qty: surplus,
          Status: needsReview && status === 'Matched' ? 'Discrepancy' : status,
          Needs_Review: needsReview,
          Manager_ID: manager,
          Submitted_At: submittedAt,
          Notes: notes,
        })
      })

      // One unmapped row per location every other day.
      if (dayIndex % 2 === 1) {
        const item = UNMAPPED_SOURCE_ITEMS[locationIndex % UNMAPPED_SOURCE_ITEMS.length]
        const qty = 30 + Math.floor(rng() * 60)
        rows.push({
          Date: date,
          Location: location,
          SKU_Code: item.code,
          Item_Name: item.name,
          LeverEdge_Qty: qty,
          Xero_Qty: qty,
          Physical_CS: null,
          Physical_DZ: null,
          Physical_PC: null,
          Physical_Units: null,
          Docked_Qty: null,
          Undocked_Qty: null,
          Total_Variance: 0,
          Unit_Price_NGN: null,
          Variance_Value_NGN: null,
          Shortage_Qty: 0,
          Surplus_Qty: 0,
          Sellable_Forward_Qty: 0,
          Status: 'Unmapped',
          Needs_Review: true,
          Manager_ID: manager,
          Submitted_At: submittedAt,
          Notes: 'No SKU mapping — add to SKUMapping',
        })
      }

      audit.push({
        Timestamp: submittedAt,
        Actor_ID: manager,
        Actor_Email: location === 'Ketu' ? 'ketu@renuzi' : 'lekki@renuzi',
        Action: 'SUBMIT_RECONCILIATION',
        Date: date,
        Location: location,
        Details: JSON.stringify({ replacedRows: 0, rowCount: count + (dayIndex % 2 === 1 ? 1 : 0) }),
      })
    })
  })

  audit.push(
    {
      Timestamp: isoAt(dates[10], 9, 18),
      Actor_ID: 'usr_admin',
      Actor_Email: 'admin@renuzi',
      Action: 'SKU_MAPPING_CHANGE',
      Date: null,
      Location: null,
      Details: 'Created mapping 13012955',
    },
    {
      Timestamp: isoAt(dates[7], 14, 41),
      Actor_ID: 'usr_admin',
      Actor_Email: 'admin@renuzi',
      Action: 'IMPORT_SKU_MAPPING',
      Date: null,
      Location: null,
      Details: 'CSV import: 28 created, 0 updated (28 total)',
    },
  )

  return { reconRows: rows, audit, unmapped: seedUnmapped(seedMappings()) }
}
