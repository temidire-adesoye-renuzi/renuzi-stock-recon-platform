var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// client/src/lib/apiTypes.ts
var ApiError, TOKEN_KEY;
var init_apiTypes = __esm({
  "client/src/lib/apiTypes.ts"() {
    "use strict";
    ApiError = class extends Error {
      code;
      status;
      constructor(code, status2, message) {
        super(message ?? code);
        this.name = "ApiError";
        this.code = code;
        this.status = status2;
      }
    };
    TOKEN_KEY = "renuzi_token";
  }
});

// client/src/lib/fuzzy.ts
function normalizeItemName(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}
function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = /* @__PURE__ */ new Map();
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2);
    const count = bigrams.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      bigrams.set(gram, count - 1);
    }
  }
  return 2 * overlap / (a.length - 1 + b.length - 1);
}
function bestMatch(sourceName, candidates) {
  const normalized = normalizeItemName(sourceName);
  if (normalized === "") return null;
  let best = null;
  for (const candidate of candidates) {
    const similarity = diceCoefficient(normalized, normalizeItemName(candidate.name));
    if (best === null || similarity > best.similarity) {
      best = { code: candidate.code, name: candidate.name, similarity };
    }
  }
  return best;
}
var FUZZY_THRESHOLD;
var init_fuzzy = __esm({
  "client/src/lib/fuzzy.ts"() {
    "use strict";
    FUZZY_THRESHOLD = 0.85;
  }
});

// client/src/lib/wat.ts
var wat_exports = {};
__export(wat_exports, {
  CUTOFF_HOUR: () => CUTOFF_HOUR,
  TIMEZONE: () => TIMEZONE,
  isBeforeCutoff: () => isBeforeCutoff,
  isSubmissionOpen: () => isSubmissionOpen,
  lagosClockLabel: () => lagosClockLabel,
  lagosDateString: () => lagosDateString,
  lagosHourMinute: () => lagosHourMinute,
  lastLagosDates: () => lastLagosDates,
  secondsUntilCutoff: () => secondsUntilCutoff
});
function lagosDateString(now = /* @__PURE__ */ new Date()) {
  return dateFormatter.format(now);
}
function lagosHourMinute(now = /* @__PURE__ */ new Date()) {
  const [hour, minute] = timeFormatter.format(now).split(":").map((part) => Number(part));
  return { hour, minute };
}
function lagosClockLabel(now = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(now);
}
function isBeforeCutoff(now = /* @__PURE__ */ new Date()) {
  return lagosHourMinute(now).hour < CUTOFF_HOUR;
}
function secondsUntilCutoff(now = /* @__PURE__ */ new Date()) {
  if (!isBeforeCutoff(now)) return 0;
  const { hour, minute } = lagosHourMinute(now);
  const nowSeconds = hour * 3600 + minute * 60 + now.getSeconds();
  return Math.max(0, CUTOFF_HOUR * 3600 - nowSeconds);
}
function isSubmissionOpen(date, now = /* @__PURE__ */ new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (!isBeforeCutoff(now)) return false;
  return date === lagosDateString(now);
}
function lastLagosDates(n, now = /* @__PURE__ */ new Date()) {
  const dates = [];
  for (let offset = n - 1; offset >= 0; offset -= 1) {
    const instant = new Date(now.getTime() - offset * 864e5);
    dates.push(lagosDateString(instant));
  }
  return dates;
}
var TIMEZONE, CUTOFF_HOUR, dateFormatter, timeFormatter;
var init_wat = __esm({
  "client/src/lib/wat.ts"() {
    "use strict";
    TIMEZONE = "Africa/Lagos";
    CUTOFF_HOUR = 18;
    dateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    timeFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
  }
});

// client/src/lib/fixtures.ts
function seedMappings() {
  return SEED_SKUS.map((sku) => ({
    leverEdgeSkuCode: sku.code,
    leverEdgeItemName: sku.name,
    xeroItemCode: sku.code,
    xeroItemName: sku.xeroName,
    csFactor: sku.csFactor,
    dzFactor: sku.dzFactor,
    category: sku.category,
    active: sku.active ?? true
  }));
}
function seedUnmapped(mappings3) {
  const candidates = mappings3.filter((entry) => entry.active).map((entry) => ({ code: entry.xeroItemCode, name: entry.xeroItemName }));
  return UNMAPPED_SOURCE_ITEMS.flatMap((item, index) => {
    const match = bestMatch(item.name, candidates);
    if (match === null || match.similarity < 0.55) return [];
    return [
      {
        id: `seed-u${index}`,
        sourceCode: item.code,
        sourceName: item.name,
        suggestionCode: match.code,
        suggestionName: match.name,
        confidence: Math.round(match.similarity * 100) / 100
      }
    ];
  });
}
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function round3(value) {
  return Math.round(value * 1e3) / 1e3;
}
function isoAt(date, hour, minute) {
  return (/* @__PURE__ */ new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+01:00`)).toISOString();
}
function generateSeedData(now = /* @__PURE__ */ new Date()) {
  const rng = mulberry32(20260922);
  const dates = lastLagosDates(14, now);
  const active = SEED_SKUS.filter((sku) => sku.active ?? true);
  const byCode = new Map(seedMappings().map((entry) => [entry.leverEdgeSkuCode, entry]));
  const rows = [];
  const audit2 = [];
  dates.forEach((date, dayIndex) => {
    const isToday = dayIndex === dates.length - 1;
    LOCATIONS.forEach((location, locationIndex) => {
      const manager = location === "Ketu" ? "usr_ketu" : "usr_lekki";
      const submittedAt = isoAt(date, isToday ? 11 + locationIndex : 17, isToday ? 12 + locationIndex * 21 : 5);
      const count = 26 + Math.floor(rng() * 4);
      const picked = [...active].sort(() => rng() - 0.5).slice(0, count);
      const discrepancyIndex = 2 + Math.floor(rng() * 8);
      const bigVarianceIndex = Math.floor(rng() * count);
      picked.forEach((sku, index) => {
        const entry = byCode.get(sku.code);
        const cases = 40 + Math.floor(rng() * 90);
        const dz = Math.floor(rng() * 3);
        const pc = Math.floor(rng() * 9);
        const units = round3(cases * entry.csFactor + dz * entry.dzFactor + pc);
        let dockedDelta = 0;
        let undockedDelta = 0;
        let status2 = "Matched";
        let needsReview = false;
        let notes = "";
        if (index === discrepancyIndex || index === bigVarianceIndex) {
          status2 = "Discrepancy";
          const big = index === bigVarianceIndex && dayIndex % 2 === 0;
          dockedDelta = big ? 12 + Math.floor(rng() * 14) : 1 + Math.floor(rng() * 8);
          undockedDelta = 1 + Math.floor(rng() * 6);
          if (big) notes = "Short-supply confirmed with loading bay";
        } else if (index === picked.length - 1) {
          status2 = "Discrepancy";
          undockedDelta = 2 + Math.floor(rng() * 5);
        }
        if (index === 5 && dayIndex % 3 !== 2) {
          needsReview = true;
          notes = "Auto-matched by name similarity 0.87 \u2014 verify";
        }
        const leverEdgeQty = round3(units + dockedDelta + undockedDelta);
        const xeroQty = round3(units - dockedDelta);
        const totalVariance = round3(leverEdgeQty - xeroQty);
        const shortage = round3(Math.max(xeroQty - leverEdgeQty, 0));
        const surplus = round3(Math.max(leverEdgeQty - xeroQty, 0));
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
          Status: needsReview && status2 === "Matched" ? "Discrepancy" : status2,
          Needs_Review: needsReview,
          Manager_ID: manager,
          Submitted_At: submittedAt,
          Notes: notes
        });
      });
      if (dayIndex % 2 === 1) {
        const item = UNMAPPED_SOURCE_ITEMS[locationIndex % UNMAPPED_SOURCE_ITEMS.length];
        const qty = 30 + Math.floor(rng() * 60);
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
          Status: "Unmapped",
          Needs_Review: true,
          Manager_ID: manager,
          Submitted_At: submittedAt,
          Notes: "No SKU mapping \u2014 add to SKUMapping"
        });
      }
      audit2.push({
        Timestamp: submittedAt,
        Actor_ID: manager,
        Actor_Email: location === "Ketu" ? "ketu@renuzi" : "lekki@renuzi",
        Action: "SUBMIT_RECONCILIATION",
        Date: date,
        Location: location,
        Details: JSON.stringify({ replacedRows: 0, rowCount: count + (dayIndex % 2 === 1 ? 1 : 0) })
      });
    });
  });
  audit2.push(
    {
      Timestamp: isoAt(dates[10], 9, 18),
      Actor_ID: "usr_admin",
      Actor_Email: "admin@renuzi",
      Action: "SKU_MAPPING_CHANGE",
      Date: null,
      Location: null,
      Details: "Created mapping 13012955"
    },
    {
      Timestamp: isoAt(dates[7], 14, 41),
      Actor_ID: "usr_admin",
      Actor_Email: "admin@renuzi",
      Action: "IMPORT_SKU_MAPPING",
      Date: null,
      Location: null,
      Details: "CSV import: 28 created, 0 updated (28 total)"
    }
  );
  return { reconRows: rows, audit: audit2, unmapped: seedUnmapped(seedMappings()) };
}
var MOCK_USERS, LOCATIONS, SEED_SKUS, UNMAPPED_SOURCE_ITEMS;
var init_fixtures = __esm({
  "client/src/lib/fixtures.ts"() {
    "use strict";
    init_fuzzy();
    init_wat();
    MOCK_USERS = [
      { id: "usr_admin", email: "admin@renuzi", name: "Renuzi Admin", role: "admin", password: "Admin@2026" },
      {
        id: "usr_exec",
        email: "exec@renuzi",
        name: "Chidinma Eze",
        role: "executive",
        password: "Exec@2026"
      },
      {
        id: "usr_ketu",
        email: "ketu@renuzi",
        name: "Tunde Bakare",
        role: "warehouse_manager",
        location: "Ketu",
        password: "Ketu@2026"
      },
      {
        id: "usr_lekki",
        email: "lekki@renuzi",
        name: "Adaeze Okafor",
        role: "warehouse_manager",
        location: "Lekki",
        password: "Lekki@2026"
      }
    ];
    LOCATIONS = ["Ketu", "Lekki"];
    SEED_SKUS = [
      // Oral Care
      { code: "65225884", name: "CLOSEUP CFP 36X130G RC PROMO", xeroName: "Closeup CFP 36x130g RC Promo", csFactor: 36, dzFactor: 12, category: "Oral Care", price: 41365 },
      { code: "69654190", name: "CLOSEUP COMP. FRESH PROTECT 36X130G", xeroName: "Closeup Fresh Protect 36x130g", csFactor: 36, dzFactor: 12, category: "Oral Care", price: 41366 },
      { code: "62768295", name: "CLOSEUP COMPLETE FRESH 72X35G", xeroName: "Closeup Complete Fresh 72x35g", csFactor: 72, dzFactor: 12, category: "Oral Care", price: 27941 },
      { code: "65439627", name: "CLOSEUP TF REDHOT RC PROMO 50X130G", xeroName: "Closeup TF Redhot RC Promo 50x130g", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 50875 },
      { code: "68275727", name: "CLOSEUP TP EVERFRESH GRN 50 X 140G", xeroName: "Closeup Everfresh Green 50x140g", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 50875 },
      { code: "65640762", name: "CLOSEUP TP TRIPLE FRESH RH 264X8.5", xeroName: "Closeup Triple Fresh RH 264x8.5g", csFactor: 264, dzFactor: 12, category: "Oral Care", price: 14403 },
      { code: "57300211", name: "PEPSODENT TRIPLE CLEAN 12X160G", xeroName: "Pepsodent Triple Clean 12x160g", csFactor: 12, dzFactor: 12, category: "Oral Care", price: 31560 },
      { code: "57311488", name: "PEPSODENT WHITENING 50X140G TUBE", xeroName: "Pepsodent Whitening 50x140g", csFactor: 50, dzFactor: 12, category: "Oral Care", price: 48220 },
      { code: "57333015", name: "PEPSODENT GUM CARE 6X9X80G FAMILY", xeroName: "Pepsodent Gum Care Family Pack", csFactor: 54, dzFactor: 12, category: "Oral Care", price: 33980 },
      // Seasonings & Food
      { code: "21033927", name: "KNORR CHICKEN 6 X 1KG", xeroName: "Knorr Chicken 6x1kg", csFactor: 6, dzFactor: 12, category: "Seasonings", price: 66349 },
      { code: "21060383", name: "KNORR BEEF BOULION CUBE FORTI 16X50X8G", xeroName: "Knorr Beef Bouillon Forti 16x50x8g", csFactor: 800, dzFactor: 12, category: "Seasonings", price: 29520 },
      { code: "21060394", name: "KNORR CHICKEN BOULION CUBE FORT 16X50X8G", xeroName: "Knorr Chicken Bouillon Forti 16x50x8g", csFactor: 800, dzFactor: 12, category: "Seasonings", price: 28890 },
      { code: "21890441", name: "KNORR COOKING SEASONING CUBE 400X10G", xeroName: "Knorr Cooking Cube 400x10g", csFactor: 400, dzFactor: 12, category: "Seasonings", price: 39750 },
      { code: "20011987", name: "ROYCO CHICKEN CUBES 100X10G CARTON", xeroName: "Royco Chicken Cubes 100x10g", csFactor: 100, dzFactor: 12, category: "Seasonings", price: 27430 },
      { code: "20012644", name: "ROYCO BEEF CUBES 100X10G CARTON", xeroName: "Royco Beef Cubes 100x10g", csFactor: 100, dzFactor: 12, category: "Seasonings", price: 26980 },
      // Skin Care
      { code: "13007761", name: "VASILINE INTENSIVE CARE LOTION 24X100ML", xeroName: "Vaseline Intensive Care 100ml", csFactor: 24, dzFactor: 12, category: "Skin Care", price: 44610 },
      { code: "13008904", name: "VASILINE PETROLEUM JELLY 12X250ML", xeroName: "Vaseline Petroleum Jelly 250ml", csFactor: 12, dzFactor: 12, category: "Skin Care", price: 52240 },
      { code: "13012955", name: "VASILINE ALOE FRESH 6X400ML", xeroName: "Vaseline Aloe Fresh 400ml", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 49870 },
      { code: "13466012", name: "LUX CREAMY PERFECTION 24X85G", xeroName: "Lux Creamy Perfection 24x85g", csFactor: 24, dzFactor: 12, category: "Skin Care", price: 30290 },
      { code: "13468107", name: "PEARS TRANSPARENT SOAP 72X90G", xeroName: "Pears Transparent 72x90g", csFactor: 72, dzFactor: 12, category: "Skin Care", price: 41560 },
      // Personal Care
      { code: "87003219", name: "REXONA WOMEN SHOWER CLEAN 48X45G", xeroName: "Rexona Women Shower Clean 48x45g", csFactor: 48, dzFactor: 12, category: "Personal Care", price: 38770 },
      { code: "87004866", name: "REXONA MEN ANTIPERSPIRANT 36X50G", xeroName: "Rexona Men Antiperspirant 36x50g", csFactor: 36, dzFactor: 12, category: "Personal Care", price: 45340 },
      { code: "87006431", name: "LIFEBUOY TOTAL 10 SOAP 120X105G", xeroName: "Lifebuoy Total 10 120x105g", csFactor: 120, dzFactor: 12, category: "Personal Care", price: 58210 },
      { code: "87007588", name: "LIFEBUOY HANDWASH REFILL 24X750ML", xeroName: "Lifebuoy Handwash Refill 750ml", csFactor: 24, dzFactor: 12, category: "Personal Care", price: 47630 },
      // Home Care
      { code: "44007156", name: "OMO MULTIACTIVE DETERGENT 12X900G", xeroName: "Omo Multiactive 900g", csFactor: 12, dzFactor: 12, category: "Home Care", price: 56480 },
      { code: "44008813", name: "OMO ULTRA POWDER 4X3KG", xeroName: "Omo Ultra 3kg", csFactor: 4, dzFactor: 12, category: "Home Care", price: 59800 },
      { code: "44015922", name: "SUNLIGHT DISHWASH 48X300G", xeroName: "Sunlight Dishwash 300g", csFactor: 48, dzFactor: 12, category: "Home Care", price: 33910 },
      { code: "44016477", name: "SURF EXCEL QUICK WASH 20X500G", xeroName: "Surf Quick Wash 500g", csFactor: 20, dzFactor: 12, category: "Home Care", price: 36140 },
      // Beverages
      { code: "35100338", name: "LIPTON YELLOW LABEL 24X50X2G", xeroName: "Lipton Yellow Label 24x50x2g", csFactor: 1200, dzFactor: 12, category: "Beverages", price: 41020 },
      { code: "35101795", name: "LIPTON GREEN TEA 60X2G X24", xeroName: "Lipton Green Tea 24 bags", csFactor: 24, dzFactor: 12, category: "Beverages", price: 37660 },
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
      { code: "LUX85GCP", name: "LUX BAR CREAMY PERFECTION PW 48X85G", xeroName: "Lux Bar Creamy Perfection Pw 48x85g", csFactor: 48, dzFactor: 12, category: "Skin Care", price: 35e3 },
      { code: "LUX85GDD", name: "LUX BAR DREAM DELIGHT 48X85G", xeroName: "Lux Bar Dream Delight 48x85g", csFactor: 48, dzFactor: 12, category: "Skin Care", price: 33e3 },
      { code: "UN10009", name: "LUX BLUE AQUA UI MP 24 X (6 X 80G)", xeroName: "Lux Blue Aqua Ui Mp 24 X (6 X 80g)", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 96e3 },
      { code: "UN10012", name: "LUX BRIGHT IMPRESS UI MP 24 X (6 X 80G)", xeroName: "Lux Bright Impress Ui Mp 24 X (6 X 80g)", csFactor: 6, dzFactor: 12, category: "Skin Care", price: 96e3 },
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
      { code: "7791293049250", name: "REXONA AP MEN B/SPRAY ACTIVE DRY 72HRS 200ML X 12", xeroName: "Rexona Ap Men B/Spray Active Dry 72hrs 200ml X 12", csFactor: 1, dzFactor: 12, category: "Personal Care", price: 3e4 },
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
      { code: "CDFG000491", name: "TGI-PEPPE TERRA 50G X 50", xeroName: "Tgi-Peppe Terra 50g X 50", csFactor: 1, dzFactor: 12, category: "Pantry", price: 7e3 },
      { code: "CDFG000464", name: "TGI-PEPPE TERRA 55G X 50", xeroName: "Tgi-Peppe Terra 55g X 50", csFactor: 1, dzFactor: 12, category: "Pantry", price: 7e3 },
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
      { code: "Total", name: "", xeroName: "", csFactor: 1, dzFactor: 12, category: "Pantry", price: 3e4 },
      { code: "Total", name: "", xeroName: "", csFactor: 1, dzFactor: 12, category: "Pantry", price: 3e4 },
      // Inactive mapping (recently retired promo pack)
      { code: "65225883", name: "CLOSEUP COMPLETE FRESH 72X35G RC PROMO", xeroName: "Closeup CF 72x35g RC Promo", csFactor: 72, dzFactor: 12, category: "Oral Care", price: 27941, active: false },
      { code: "20013201", name: "ROYCO SHRIMP CUBES 100X10G CARTON", xeroName: "Royco Shrimp Cubes 100x10g", csFactor: 100, dzFactor: 12, category: "Seasonings", price: 26110, active: false }
    ];
    UNMAPPED_SOURCE_ITEMS = [
      { code: "65990127", name: "CLOSEUP TP EVERFRESH GRN 50X140G XTRA" },
      { code: "13020748", name: "VASILINE INTENS CARE LOTION 24X100 N" },
      { code: "21084663", name: "KNORR SHRIMP CUBE FORTI 16X50X8G" }
    ];
  }
});

// client/src/lib/recon.ts
var recon_exports = {};
__export(recon_exports, {
  DEFAULT_CS_FACTOR: () => DEFAULT_CS_FACTOR,
  DEFAULT_DZ_FACTOR: () => DEFAULT_DZ_FACTOR,
  NOTE_VARIANCE_THRESHOLD: () => NOTE_VARIANCE_THRESHOLD,
  QTY_TOLERANCE: () => QTY_TOLERANCE,
  buildPreviewRows: () => buildPreviewRows,
  computePreviewRow: () => computePreviewRow,
  mergeManualCounts: () => mergeManualCounts,
  qtyEquals: () => qtyEquals,
  reconcile: () => reconcile,
  round3: () => round32,
  summarizePreview: () => summarizePreview,
  summarizeRows: () => summarizeRows
});
function round32(value) {
  return Math.round(value * 1e3) / 1e3;
}
function qtyEquals(a, b, tolerance = QTY_TOLERANCE) {
  return Math.abs(a - b) <= tolerance;
}
function reconcile(input) {
  const matcher = new Matcher(input.mapping);
  const groups = /* @__PURE__ */ new Map();
  const nameIndex = /* @__PURE__ */ new Map();
  const groupSources = /* @__PURE__ */ new Map();
  const resolve2 = (source, sku, name) => {
    const match = matcher.match(source, sku, name, nameIndex, groupSources);
    const key = match.key ?? `unmapped:${source}:${sku}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        rank: 0,
        fuzzyJoined: false,
        similarity: null,
        entry: match.entry,
        sources: /* @__PURE__ */ new Set(),
        leverEdge: null,
        xero: null,
        physical: null
      };
      groups.set(key, group);
    }
    group.rank = Math.max(group.rank, METHOD_RANK[match.method]);
    if (match.method === "fuzzy") {
      group.fuzzyJoined = true;
      if (group.similarity === null) group.similarity = match.similarity;
    }
    if (match.entry && !group.entry) group.entry = match.entry;
    group.sources.add(source);
    if (!groupSources.has(key)) groupSources.set(key, /* @__PURE__ */ new Set());
    groupSources.get(key).add(source);
    const normalized = normalizeItemName(name);
    if (normalized !== "" && !nameIndex.has(normalized)) nameIndex.set(normalized, key);
    return group;
  };
  for (const row of input.leveredge) {
    if (row.sku === "") continue;
    const group = resolve2("leveredge", row.sku, row.name);
    if (!group.leverEdge) {
      group.leverEdge = {
        sku: row.sku,
        name: row.name,
        qty: round32(row.qty ?? 0),
        unitPrice: row.unitPrice
      };
    } else {
      group.leverEdge.qty = round32(group.leverEdge.qty + (row.qty ?? 0));
      group.leverEdge.unitPrice ??= row.unitPrice;
    }
  }
  for (const row of input.xero) {
    if (row.sku === "") continue;
    const group = resolve2("xero", row.sku, row.name);
    if (!group.xero) {
      group.xero = {
        sku: row.sku,
        name: row.name,
        qty: round32(row.qty ?? 0),
        unitPrice: row.unitPrice
      };
    } else {
      group.xero.qty = round32(group.xero.qty + (row.qty ?? 0));
      group.xero.unitPrice ??= row.unitPrice;
    }
  }
  for (const row of input.physical) {
    if (row.sku === "") continue;
    const group = resolve2("physical", row.sku, row.name);
    if (!group.physical) {
      group.physical = {
        sku: row.sku,
        name: row.name,
        cs: round32(row.cs ?? 0),
        dz: round32(row.dz ?? 0),
        pc: round32(row.pc ?? 0),
        unitPrice: row.unitPrice
      };
    } else {
      group.physical.cs = round32(group.physical.cs + (row.cs ?? 0));
      group.physical.dz = round32(group.physical.dz + (row.dz ?? 0));
      group.physical.pc = round32(group.physical.pc + (row.pc ?? 0));
      group.physical.unitPrice ??= row.unitPrice;
    }
  }
  const rows = [...groups.values()].map((group) => buildRow(group, input));
  rows.sort(
    (a, b) => (a.Item_Name < b.Item_Name ? -1 : a.Item_Name > b.Item_Name ? 1 : 0) || (a.SKU_Code < b.SKU_Code ? -1 : a.SKU_Code > b.SKU_Code ? 1 : 0)
  );
  return rows;
}
function buildRow(group, input) {
  const entry = group.entry;
  const csFactor = entry?.csFactor ?? DEFAULT_CS_FACTOR;
  const dzFactor = entry?.dzFactor ?? DEFAULT_DZ_FACTOR;
  const leverEdgeQty = group.leverEdge?.qty ?? null;
  const xeroQty = group.xero?.qty ?? null;
  const physicalUnits = group.physical ? round32(
    (group.physical.cs ?? 0) * csFactor + (group.physical.dz ?? 0) * dzFactor + group.physical.pc
  ) : null;
  const docked = leverEdgeQty !== null && physicalUnits !== null ? round32(leverEdgeQty - physicalUnits) : null;
  const undocked = physicalUnits !== null && xeroQty !== null ? round32(physicalUnits - xeroQty) : null;
  const totalVariance = leverEdgeQty !== null && xeroQty !== null ? round32(leverEdgeQty - xeroQty) : null;
  const unitPrice = group.leverEdge?.unitPrice ?? group.xero?.unitPrice ?? group.physical?.unitPrice ?? null;
  const varianceValue = totalVariance !== null && unitPrice !== null ? round32(totalVariance * unitPrice) : null;
  const shortage = leverEdgeQty !== null && xeroQty !== null ? round32(Math.max(xeroQty - leverEdgeQty, 0)) : null;
  const surplus = leverEdgeQty !== null && xeroQty !== null ? round32(Math.max(leverEdgeQty - xeroQty, 0)) : null;
  let status2;
  if (group.rank === 0) {
    status2 = "Unmapped";
  } else if (leverEdgeQty !== null && xeroQty !== null && physicalUnits !== null && qtyEquals(leverEdgeQty, xeroQty) && qtyEquals(physicalUnits, xeroQty) && qtyEquals(physicalUnits, leverEdgeQty)) {
    status2 = "Matched";
  } else {
    status2 = "Discrepancy";
  }
  const notes = [];
  if (group.rank === 0) notes.push("No SKU mapping \u2014 add to SKUMapping");
  else if (group.fuzzyJoined && group.similarity !== null) {
    notes.push(`Auto-matched by name similarity ${group.similarity} \u2014 verify`);
  }
  if (input.notes) notes.push(input.notes);
  return {
    Date: input.date,
    Location: input.location,
    SKU_Code: group.leverEdge?.sku ?? group.xero?.sku ?? group.physical?.sku ?? entry?.leverEdgeSkuCode ?? "",
    Item_Name: group.leverEdge?.name ?? group.xero?.name ?? group.physical?.name ?? entry?.leverEdgeItemName ?? "",
    LeverEdge_Qty: leverEdgeQty,
    Xero_Qty: xeroQty,
    Physical_CS: group.physical?.cs ?? null,
    Physical_DZ: group.physical?.dz ?? null,
    Physical_PC: group.physical?.pc ?? null,
    Physical_Units: physicalUnits,
    Docked_Qty: docked,
    Undocked_Qty: undocked,
    Total_Variance: totalVariance,
    Unit_Price_NGN: unitPrice,
    Variance_Value_NGN: varianceValue,
    Shortage_Qty: shortage,
    Surplus_Qty: surplus,
    Sellable_Forward_Qty: surplus,
    Status: status2,
    Needs_Review: group.rank === 0 || group.fuzzyJoined,
    Manager_ID: input.managerId ?? null,
    Submitted_At: input.submittedAt ?? null,
    Notes: notes.join("; ")
  };
}
function mergeManualCounts(physical2, manual, location) {
  const notesBySku = /* @__PURE__ */ new Map();
  const merged = physical2.map((row) => ({ ...row }));
  const bySku = new Map(merged.map((row) => [row.sku, row]));
  for (const count of manual) {
    const existing = bySku.get(count.sku);
    if (existing) {
      if (count.cs !== null) existing.cs = count.cs;
      if (count.dz !== null) existing.dz = count.dz;
      if (count.pc !== null) existing.pc = count.pc;
    } else {
      const fresh = {
        sku: count.sku,
        name: "",
        cs: count.cs ?? 0,
        dz: count.dz ?? 0,
        pc: count.pc ?? 0,
        unitPrice: null,
        location
      };
      merged.push(fresh);
      bySku.set(count.sku, fresh);
    }
    if (count.notes) notesBySku.set(count.sku, count.notes);
  }
  return { merged, notesBySku };
}
function summarizeRows(rows) {
  const summary = {
    rowCount: rows.length,
    matched: 0,
    discrepancy: 0,
    unmapped: 0,
    needsReview: 0,
    atRiskSkus: 0,
    dockedQty: 0,
    dockedValueNGN: 0,
    undockedQty: 0,
    undockedValueNGN: 0,
    totalVarianceValueNGN: 0
  };
  for (const row of rows) {
    if (row.Status === "Matched") summary.matched += 1;
    else if (row.Status === "Discrepancy") summary.discrepancy += 1;
    else summary.unmapped += 1;
    if (row.Needs_Review) summary.needsReview += 1;
    if (row.Docked_Qty !== null) {
      summary.dockedQty = round32(summary.dockedQty + row.Docked_Qty);
      if (row.Unit_Price_NGN !== null) {
        summary.dockedValueNGN = round32(summary.dockedValueNGN + row.Docked_Qty * row.Unit_Price_NGN);
      }
    }
    if (row.Undocked_Qty !== null) {
      summary.undockedQty = round32(summary.undockedQty + row.Undocked_Qty);
      if (row.Unit_Price_NGN !== null) {
        summary.undockedValueNGN = round32(
          summary.undockedValueNGN + row.Undocked_Qty * row.Unit_Price_NGN
        );
      }
    }
    if (row.Variance_Value_NGN !== null) {
      summary.totalVarianceValueNGN = round32(summary.totalVarianceValueNGN + row.Variance_Value_NGN);
    }
  }
  summary.atRiskSkus = summary.needsReview;
  return summary;
}
function buildPreviewRows(sources, mapping) {
  const rows = reconcile({
    date: "preview",
    location: "preview",
    leveredge: sources.leveredge,
    xero: sources.xero,
    physical: sources.physical,
    mapping
  });
  const byCode = new Map(mapping.map((entry) => [entry.leverEdgeSkuCode, entry]));
  return rows.map((row) => {
    const entry = byCode.get(row.SKU_Code) ?? null;
    return {
      sku: row.SKU_Code,
      name: row.Item_Name,
      leverEdgeQty: row.LeverEdge_Qty,
      xeroQty: row.Xero_Qty,
      cs: row.Physical_CS ?? 0,
      dz: row.Physical_DZ ?? 0,
      pc: row.Physical_PC ?? 0,
      csFactor: entry?.csFactor ?? DEFAULT_CS_FACTOR,
      dzFactor: entry?.dzFactor ?? DEFAULT_DZ_FACTOR,
      unitPrice: row.Unit_Price_NGN,
      fromPhysical: row.Physical_Units !== null,
      unmapped: row.Status === "Unmapped",
      needsReview: row.Needs_Review,
      note: ""
    };
  });
}
function computePreviewRow(row) {
  const physicalUnits = round32(row.cs * row.csFactor + row.dz * row.dzFactor + row.pc);
  const docked = row.leverEdgeQty !== null ? round32(row.leverEdgeQty - physicalUnits) : 0;
  const undocked = row.xeroQty !== null ? round32(physicalUnits - row.xeroQty) : 0;
  const totalVariance = row.leverEdgeQty !== null && row.xeroQty !== null ? round32(row.leverEdgeQty - row.xeroQty) : 0;
  let status2 = "Unmapped";
  if (!row.unmapped) {
    if (row.leverEdgeQty !== null && row.xeroQty !== null && qtyEquals(physicalUnits, row.leverEdgeQty) && qtyEquals(physicalUnits, row.xeroQty)) {
      status2 = "Matched";
    } else {
      status2 = "Discrepancy";
    }
  }
  return {
    ...row,
    physicalUnits,
    docked,
    undocked,
    totalVariance,
    status: status2,
    noteRequired: Math.abs(totalVariance) >= NOTE_VARIANCE_THRESHOLD
  };
}
function summarizePreview(rows) {
  let dockedValue = 0;
  let unrecordedSales = 0;
  let atRiskSkus = 0;
  for (const row of rows) {
    if (row.docked > 0 && row.unitPrice !== null) dockedValue += row.docked * row.unitPrice;
    if (row.undocked > 0) unrecordedSales += row.undocked;
    if (row.status !== "Matched") atRiskSkus += 1;
  }
  return { dockedValue: round32(dockedValue), unrecordedSales: round32(unrecordedSales), atRiskSkus };
}
var DEFAULT_CS_FACTOR, DEFAULT_DZ_FACTOR, QTY_TOLERANCE, NOTE_VARIANCE_THRESHOLD, METHOD_RANK, Matcher;
var init_recon = __esm({
  "client/src/lib/recon.ts"() {
    "use strict";
    init_fuzzy();
    DEFAULT_CS_FACTOR = 1;
    DEFAULT_DZ_FACTOR = 12;
    QTY_TOLERANCE = 1e-3;
    NOTE_VARIANCE_THRESHOLD = 10;
    METHOD_RANK = { code: 3, name: 2, fuzzy: 1, none: 0 };
    Matcher = class {
      byCode = /* @__PURE__ */ new Map();
      mappingNames = /* @__PURE__ */ new Map();
      constructor(mapping) {
        for (const entry of mapping) {
          if (!entry.active) continue;
          for (const code of [entry.leverEdgeSkuCode, entry.xeroItemCode]) {
            const trimmed = code.trim();
            if (trimmed !== "" && !this.byCode.has(trimmed)) this.byCode.set(trimmed, entry);
          }
          const key = `mapping:${entry.leverEdgeSkuCode.trim()}`;
          for (const name of [entry.leverEdgeItemName, entry.xeroItemName]) {
            const normalized = normalizeItemName(name);
            if (normalized !== "" && !this.mappingNames.has(normalized)) {
              this.mappingNames.set(normalized, key);
            }
          }
        }
      }
      match(source, sku, name, nameIndex, groupSources) {
        const hasSource = (key) => groupSources.get(key)?.has(source) ?? false;
        const entry = this.byCode.get(sku.trim());
        if (entry) {
          return { method: "code", key: `mapping:${entry.leverEdgeSkuCode.trim()}`, similarity: null, entry };
        }
        const normalized = normalizeItemName(name);
        if (normalized !== "") {
          const nameKey = nameIndex.get(normalized) ?? this.mappingNames.get(normalized);
          if (nameKey && !hasSource(nameKey)) {
            return { method: "name", key: nameKey, similarity: null, entry: null };
          }
          let bestKey = null;
          let bestSimilarity = 0;
          for (const [candidate, key] of nameIndex) {
            if (candidate === "" || hasSource(key)) continue;
            const similarity = diceCoefficient(normalized, candidate);
            if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              bestKey = key;
            }
          }
          if (bestKey !== null && bestSimilarity >= FUZZY_THRESHOLD) {
            return { method: "fuzzy", key: bestKey, similarity: round32(bestSimilarity), entry: null };
          }
        }
        return { method: "none", key: null, similarity: null, entry: null };
      }
    };
  }
});

// client/src/lib/xlsx.ts
var xlsx_exports = {};
__export(xlsx_exports, {
  FileValidationError: () => FileValidationError,
  dateFromSheetName: () => dateFromSheetName,
  locationFromSheetName: () => locationFromSheetName,
  parseLeverEdgeFile: () => parseLeverEdgeFile,
  parsePhysicalFile: () => parsePhysicalFile,
  parseXeroFile: () => parseXeroFile
});
import * as XLSX from "xlsx";
import { z } from "zod";
function normalizeHeaderName(value) {
  if (typeof value !== "string") return "";
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}
function findHeaderRow(rows, fields) {
  for (let index = 0; index < rows.length; index += 1) {
    const positions = /* @__PURE__ */ new Map();
    rows[index].forEach((cell, col) => {
      const normalized = normalizeHeaderName(cell);
      if (normalized !== "" && !positions.has(normalized)) positions.set(normalized, col);
    });
    const columns = {};
    let complete = true;
    for (const field of fields) {
      const name = field.names.map(normalizeHeaderName).find((candidate) => positions.has(candidate));
      if (name === void 0) {
        complete = false;
        break;
      }
      columns[field.key] = positions.get(name);
    }
    if (complete) return { index, columns };
  }
  return null;
}
function isBlank(cell) {
  return cell === null || cell === void 0 || typeof cell === "string" && cell.trim() === "";
}
function isTotalRow(row) {
  for (const cell of row) {
    if (isBlank(cell)) continue;
    return typeof cell === "string" && /^(grand\s+)?total\b/i.test(cell.trim());
  }
  return false;
}
function cleanRows(rows, startIndex) {
  const cleaned = [];
  for (let i = startIndex; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.every((cell) => isBlank(cell))) continue;
    if (isTotalRow(row)) continue;
    cleaned.push(row);
  }
  return cleaned;
}
function toText(value) {
  if (value === null || value === void 0) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "-" ? null : trimmed;
  }
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (value instanceof Date) return value.toISOString();
  return null;
}
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "-") return null;
    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
async function readWorkbookRows(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets = /* @__PURE__ */ new Map();
  for (const name of workbook.SheetNames) {
    sheets.set(
      name,
      XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        raw: true,
        defval: null,
        blankrows: true
      })
    );
  }
  return sheets;
}
function validateHeader(fileLabel, fields, found) {
  const shape = {};
  for (const field of fields) {
    for (const name of field.names) shape[normalizeHeaderName(name)] = z.string();
  }
  const schema = z.object(shape).strict();
  const headerRecord = Object.fromEntries(found.map((name) => [name, name]));
  const result2 = schema.safeParse(headerRecord);
  if (result2.success) return [];
  const missing = /* @__PURE__ */ new Set();
  for (const issue of result2.error.issues) {
    const key = String(issue.path[0] ?? "");
    const field = fields.find(
      (candidate) => candidate.names.some((name) => normalizeHeaderName(name) === key)
    );
    if (field) missing.add(field.label);
  }
  return [...missing].map(
    (label) => `${fileLabel}: missing required column "${label}".`
  );
}
function validateRows(fileLabel, schema, rows) {
  const issues = [];
  for (let i = 0; i < rows.length; i += 1) {
    const result2 = schema.safeParse(rows[i]);
    if (!result2.success) {
      const detail = result2.error.issues.map((issue) => `${issue.path.join(".") || "row"} ${issue.message}`).join("; ");
      if (issues.length < MAX_ROW_ISSUES) {
        issues.push(`${fileLabel}: data row ${i + 1} \u2014 ${detail}.`);
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
async function parseLeverEdgeFile(file) {
  const sheets = await readWorkbookRows(file);
  const sheetName = [...sheets.keys()][0];
  const rows = sheets.get(sheetName ?? "") ?? [];
  if (!sheetName || rows.length === 0) {
    throw new FileValidationError(["LeverEdge export: workbook has no sheets."]);
  }
  const header = findHeaderRow(rows, LEVEREDGE_FIELDS);
  if (!header) {
    const present = /* @__PURE__ */ new Set();
    for (const row of rows.slice(0, 30)) {
      for (const cell of row) {
        const normalized = normalizeHeaderName(cell);
        if (normalized !== "") present.add(normalized);
      }
    }
    throw new FileValidationError([
      ...validateHeader("LeverEdge export", LEVEREDGE_FIELDS, [...present]),
      "LeverEdge export: header row not found \u2014 expected Item Code / Item Name / Unit Sale Price / Quantity On Hand."
    ]);
  }
  const items = [];
  for (const row of cleanRows(rows, header.index + 1)) {
    const sku = toText(row[header.columns.sku]);
    if (sku === null) continue;
    items.push({
      sku,
      name: toText(row[header.columns.name]) ?? "",
      qty: toNumber(row[header.columns.qty]) ?? 0,
      unitPrice: toNumber(row[header.columns.unitPrice])
    });
  }
  const check = validateRows("LeverEdge export", leverEdgeRowSchema, items);
  if (!check.ok) throw new FileValidationError(check.issues);
  return { rows: items, sheetName, headerRowIndex: header.index };
}
function locationFromSheetName(sheetName) {
  const word = sheetName.trim().split(/\s+/)[0] ?? "";
  if (word === "") return "Unknown";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
function dateFromSheetName(sheetName) {
  const match = sheetName.trim().match(/\b(\d{1,2})-([A-Za-z]{3})-(\d{2,4})\b/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS.indexOf(match[2].toUpperCase());
  let year = Number(match[3]);
  if (year < 100) year += 2e3;
  if (month < 0 || day < 1 || day > 31) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
async function parseXeroFile(file) {
  const sheets = await readWorkbookRows(file);
  if (sheets.size === 0) {
    throw new FileValidationError(["Xero export: workbook has no sheets."]);
  }
  const items = [];
  const sheetNames = [];
  for (const [sheetName, rows] of sheets) {
    const header = findHeaderRow(rows, XERO_FIELDS);
    if (!header) {
      throw new FileValidationError([
        `Xero export sheet "${sheetName.trim()}": header row not found \u2014 expected Item Code / Item Name / Unit Sale Price / XERO.`
      ]);
    }
    sheetNames.push(sheetName.trim());
    const location = locationFromSheetName(sheetName);
    const sheetDate = dateFromSheetName(sheetName);
    for (const row of cleanRows(rows, header.index + 1)) {
      const sku = toText(row[header.columns.sku]);
      if (sku === null) continue;
      items.push({
        sku,
        name: toText(row[header.columns.name]) ?? "",
        qty: toNumber(row[header.columns.qty]) ?? 0,
        unitPrice: toNumber(row[header.columns.unitPrice]),
        location,
        sheetDate
      });
    }
  }
  const check = validateRows("Xero export", xeroRowSchema, items);
  if (!check.ok) throw new FileValidationError(check.issues);
  return {
    rows: items,
    sheetName: sheetNames.join(", "),
    headerRowIndex: 0,
    sheetNames
  };
}
function locationFromTitleBlock(rows, headerIndex) {
  for (let r = 0; r < headerIndex; r += 1) {
    const row = rows[r];
    for (let c = 0; c < row.length; c += 1) {
      if (normalizeHeaderName(row[c]) !== "LOCATION") continue;
      for (let k = c + 1; k < row.length; k += 1) {
        const value = toText(row[k]);
        if (value !== null) return value;
      }
    }
  }
  return null;
}
async function parsePhysicalFile(file) {
  const sheets = await readWorkbookRows(file);
  const sheetName = [...sheets.keys()][0];
  const rows = sheets.get(sheetName ?? "") ?? [];
  if (!sheetName || rows.length === 0) {
    throw new FileValidationError(["Physical stock report: workbook has no sheets."]);
  }
  const header = findHeaderRow(rows, PHYSICAL_FIELDS);
  if (!header) {
    const present = /* @__PURE__ */ new Set();
    for (const row of rows.slice(0, 30)) {
      for (const cell of row) {
        const normalized = normalizeHeaderName(cell);
        if (normalized !== "") present.add(normalized);
      }
    }
    throw new FileValidationError([
      ...validateHeader("Physical stock report", PHYSICAL_FIELDS, [...present]),
      "Physical stock report: header row not found \u2014 expected SKU Code / SKU Description / CS / DZ / PC / List Price."
    ]);
  }
  const location = locationFromTitleBlock(rows, header.index);
  const items = [];
  for (const row of cleanRows(rows, header.index + 1)) {
    const sku = toText(row[header.columns.sku]);
    if (sku === null) continue;
    items.push({
      sku,
      name: toText(row[header.columns.name]) ?? "",
      cs: toNumber(row[header.columns.cs]) ?? 0,
      dz: toNumber(row[header.columns.dz]) ?? 0,
      pc: toNumber(row[header.columns.pc]) ?? 0,
      unitPrice: toNumber(row[header.columns.unitPrice]),
      location
    });
  }
  const check = validateRows("Physical stock report", physicalRowSchema, items);
  if (!check.ok) throw new FileValidationError(check.issues);
  return { rows: items, sheetName, headerRowIndex: header.index };
}
var FileValidationError, MAX_ROW_ISSUES, LEVEREDGE_FIELDS, leverEdgeRowSchema, XERO_FIELDS, xeroRowSchema, MONTHS, PHYSICAL_FIELDS, physicalRowSchema;
var init_xlsx = __esm({
  "client/src/lib/xlsx.ts"() {
    "use strict";
    FileValidationError = class extends Error {
      issues;
      constructor(issues) {
        super(issues[0] ?? "File could not be validated");
        this.name = "FileValidationError";
        this.issues = issues;
      }
    };
    MAX_ROW_ISSUES = 5;
    LEVEREDGE_FIELDS = [
      { key: "sku", names: ["Item Code"], label: "Item Code" },
      { key: "name", names: ["Item Name"], label: "Item Name" },
      { key: "unitPrice", names: ["Unit Sale Price"], label: "Unit Sale Price" },
      { key: "qty", names: ["Quantity On Hand"], label: "Quantity On Hand" }
    ];
    leverEdgeRowSchema = z.object({
      sku: z.string().min(1, "must not be empty"),
      name: z.string(),
      qty: z.number().nullable(),
      unitPrice: z.number().nullable()
    });
    XERO_FIELDS = [
      { key: "sku", names: ["Item Code"], label: "Item Code" },
      { key: "name", names: ["Item Name"], label: "Item Name" },
      { key: "unitPrice", names: ["Unit Sale Price"], label: "Unit Sale Price" },
      // Header case varies per sheet (XERO / xero).
      { key: "qty", names: ["XERO"], label: "XERO (tracked quantity)" }
    ];
    xeroRowSchema = leverEdgeRowSchema.extend({
      location: z.string(),
      sheetDate: z.string().nullable()
    });
    MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    PHYSICAL_FIELDS = [
      { key: "sku", names: ["SKU Code"], label: "SKU Code" },
      { key: "name", names: ["SKU Description"], label: "SKU Description" },
      { key: "cs", names: ["CS"], label: "CS" },
      { key: "dz", names: ["DZ"], label: "DZ" },
      { key: "pc", names: ["PC"], label: "PC" },
      { key: "unitPrice", names: ["List Price"], label: "List Price" }
    ];
    physicalRowSchema = z.object({
      sku: z.string().min(1, "must not be empty"),
      name: z.string(),
      cs: z.number().nullable(),
      dz: z.number().nullable(),
      pc: z.number().nullable(),
      unitPrice: z.number().nullable()
    });
  }
});

// client/src/lib/mockApi.ts
var mockApi_exports = {};
__export(mockApi_exports, {
  mockApi: () => mockApi,
  resetMockData: () => resetMockData
});
function readStore(key, seed) {
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    try {
      return JSON.parse(raw);
    } catch {
    }
  }
  const fresh = seed();
  localStorage.setItem(key, JSON.stringify(fresh));
  return fresh;
}
function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function reseed() {
  localStorage.removeItem(KEYS.recon);
  localStorage.removeItem(KEYS.audit);
  localStorage.removeItem(KEYS.unmapped);
}
function ensureSeeded() {
  reconRows = readStore(KEYS.recon, () => generateSeedData().reconRows);
  mappings = readStore(KEYS.mappings, () => seedMappings());
  auditLog = readStore(KEYS.audit, () => generateSeedData().audit);
  unmappedQueue = readStore(KEYS.unmapped, () => generateSeedData().unmapped);
}
function persistRecon() {
  writeStore(KEYS.recon, reconRows);
}
function persistMappings() {
  writeStore(KEYS.mappings, mappings);
}
function persistAudit() {
  writeStore(KEYS.audit, auditLog);
}
function persistUnmapped() {
  writeStore(KEYS.unmapped, unmappedQueue);
}
function delay(ms = 260 + Math.random() * 340) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
function toAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...user.location ? { location: user.location } : {}
  };
}
function currentUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token?.startsWith("mock.")) throw new ApiError("UNAUTHORIZED", 401);
  const user = MOCK_USERS.find((candidate) => candidate.id === token.slice("mock.".length));
  if (!user) throw new ApiError("UNAUTHORIZED", 401);
  return toAuthUser(user);
}
function requireRole(user, ...roles) {
  if (!roles.includes(user.role)) throw new ApiError("FORBIDDEN", 403);
}
function logAudit(user, action, details, date = null, location = null) {
  auditLog.push({
    Timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    Actor_ID: user.id,
    Actor_Email: user.email,
    Action: action,
    Date: date,
    Location: location,
    Details: details
  });
  persistAudit();
}
function trackUnmapped(rows) {
  const candidates = mappings.filter((entry) => entry.active).map((entry) => ({ code: entry.leverEdgeSkuCode, name: entry.leverEdgeItemName }));
  let added = 0;
  for (const row of rows) {
    if (added >= 12) break;
    if (row.Status !== "Unmapped" && !row.Needs_Review) continue;
    if (row.Item_Name === "") continue;
    if (unmappedQueue.some((item) => item.sourceCode === row.SKU_Code)) continue;
    const match = bestMatch(row.Item_Name, candidates);
    if (match === null) continue;
    unmappedQueue.push({
      id: `u-${row.SKU_Code}`,
      sourceCode: row.SKU_Code,
      sourceName: row.Item_Name,
      suggestionCode: match.code,
      suggestionName: match.name,
      confidence: Math.min(0.99, Math.round(match.similarity * 100) / 100)
    });
    added += 1;
  }
  persistUnmapped();
}
function coerceMapping(input) {
  if (typeof input !== "object" || input === null) {
    throw new ApiError("INVALID_SKU_MAPPING", 400);
  }
  const body = input;
  const code = typeof body.leverEdgeSkuCode === "string" ? body.leverEdgeSkuCode.trim() : "";
  if (code === "") throw new ApiError("INVALID_SKU_MAPPING", 400);
  const csFactor = Number(body.csFactor);
  const dzFactor = Number(body.dzFactor);
  return {
    leverEdgeSkuCode: code,
    leverEdgeItemName: typeof body.leverEdgeItemName === "string" ? body.leverEdgeItemName : "",
    xeroItemCode: typeof body.xeroItemCode === "string" ? body.xeroItemCode.trim() : "",
    xeroItemName: typeof body.xeroItemName === "string" ? body.xeroItemName : "",
    csFactor: Number.isFinite(csFactor) && csFactor > 0 ? csFactor : 1,
    dzFactor: Number.isFinite(dzFactor) && dzFactor > 0 ? dzFactor : 12,
    category: typeof body.category === "string" ? body.category : "",
    active: body.active === void 0 ? true : Boolean(body.active)
  };
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
function resetMockData() {
  reseed();
  ensureSeeded();
}
var KEYS, reconRows, mappings, auditLog, unmappedQueue, mockApi;
var init_mockApi = __esm({
  "client/src/lib/mockApi.ts"() {
    "use strict";
    init_apiTypes();
    init_fixtures();
    init_fuzzy();
    init_recon();
    init_wat();
    init_xlsx();
    KEYS = {
      recon: "renuzi.mock.recon",
      mappings: "renuzi.mock.skumap",
      audit: "renuzi.mock.audit",
      unmapped: "renuzi.mock.unmapped"
    };
    mockApi = {
      async login(email, password) {
        await delay();
        if (email.trim() === "" || password === "") {
          throw new ApiError("EMAIL_AND_PASSWORD_REQUIRED", 400);
        }
        const user = MOCK_USERS.find(
          (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase()
        );
        if (!user) throw new ApiError("INVALID_CREDENTIALS", 401);
        ensureSeeded();
        return { token: `mock.${user.id}`, user: toAuthUser(user) };
      },
      async me() {
        await delay(120);
        ensureSeeded();
        return currentUser();
      },
      async submitReconciliation(input) {
        await delay();
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "warehouse_manager", "admin");
        if (!input.leveredge || !input.xero) {
          throw new ApiError("MISSING_FILES", 400);
        }
        const { date, location } = input.counts;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || location.trim() === "") {
          throw new ApiError("INVALID_COUNTS_DATE", 400);
        }
        if (user.role === "warehouse_manager") {
          const own = user.location?.toLowerCase();
          if (!own || own !== location.toLowerCase()) {
            throw new ApiError("LOCATION_FORBIDDEN", 403);
          }
        }
        if (!isSubmissionOpen(date)) {
          throw new ApiError("LOCKED_FOR_AUDIT", 403, "Submissions lock at 6:00 PM WAT for executive audit.");
        }
        let leveredge2;
        let xeroAll;
        let physical2;
        try {
          leveredge2 = (await parseLeverEdgeFile(input.leveredge)).rows;
          xeroAll = (await parseXeroFile(input.xero)).rows;
          physical2 = input.physical ? (await parsePhysicalFile(input.physical)).rows : [];
        } catch (error) {
          throw new ApiError("UNPARSABLE_FILE", 422, error.message);
        }
        const xero2 = xeroAll.filter((row) => row.location.toLowerCase() === location.toLowerCase());
        const { merged, notesBySku } = mergeManualCounts(physical2, input.counts.rows, location);
        const submittedAt = (/* @__PURE__ */ new Date()).toISOString();
        const rows = reconcile({
          date,
          location,
          leveredge: leveredge2,
          xero: xero2,
          physical: merged,
          mapping: mappings,
          managerId: user.id,
          submittedAt,
          notes: input.counts.notes ?? null
        });
        for (const row of rows) {
          const manualNote = notesBySku.get(row.SKU_Code);
          if (manualNote) {
            row.Notes = row.Notes === "" ? `Manual: ${manualNote}` : `${row.Notes}; Manual: ${manualNote}`;
          }
        }
        const summary = summarizeRows(rows);
        const removed = reconRows.filter(
          (row) => row.Date === date && row.Location.toLowerCase() === location.toLowerCase()
        ).length;
        reconRows = reconRows.filter(
          (row) => !(row.Date === date && row.Location.toLowerCase() === location.toLowerCase())
        );
        reconRows.push(...rows);
        persistRecon();
        trackUnmapped(rows);
        logAudit(
          user,
          "SUBMIT_RECONCILIATION",
          JSON.stringify({
            replacedRows: removed,
            rowCount: summary.rowCount,
            matched: summary.matched,
            discrepancy: summary.discrepancy,
            unmapped: summary.unmapped
          }),
          date,
          location
        );
        return {
          date,
          location,
          replacedRows: removed,
          parsed: {
            leveredge: leveredge2.length,
            xero: xero2.length,
            physical: physical2.length,
            manualCounts: input.counts.rows.length
          },
          summary
        };
      },
      async getReconciliationStatus(date, location) {
        await delay();
        ensureSeeded();
        const user = currentUser();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || location.trim() === "") {
          throw new ApiError("DATE_AND_LOCATION_REQUIRED", 400);
        }
        if (user.role === "warehouse_manager") {
          const own = user.location?.toLowerCase();
          if (!own || own !== location.toLowerCase()) {
            throw new ApiError("LOCATION_FORBIDDEN", 403);
          }
        }
        const scoped = reconRows.filter(
          (row) => row.Date === date && row.Location.toLowerCase() === location.toLowerCase()
        );
        return {
          date,
          location,
          locked: !isSubmissionOpen(date),
          rowCount: scoped.length,
          summary: summarizeRows(scoped),
          rows: scoped
        };
      },
      async listMappings() {
        await delay(160);
        ensureSeeded();
        currentUser();
        return mappings.filter((entry) => entry.leverEdgeSkuCode !== "");
      },
      async createMapping(entry) {
        await delay();
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "admin");
        const coerced = coerceMapping(entry);
        if (mappings.some((existing) => existing.leverEdgeSkuCode === coerced.leverEdgeSkuCode)) {
          throw new ApiError("SKU_MAPPING_EXISTS", 409);
        }
        mappings.push(coerced);
        mappings.sort((a, b) => a.leverEdgeSkuCode.localeCompare(b.leverEdgeSkuCode));
        persistMappings();
        logAudit(user, "SKU_MAPPING_CHANGE", `Created mapping ${coerced.leverEdgeSkuCode}`);
        return coerced;
      },
      async updateMapping(code, patch) {
        await delay();
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "admin");
        const index = mappings.findIndex(
          (entry) => entry.leverEdgeSkuCode === code.trim()
        );
        if (index < 0) throw new ApiError("SKU_MAPPING_NOT_FOUND", 404);
        const merged = coerceMapping({ ...mappings[index], ...patch });
        if (mappings.some(
          (entry, i) => i !== index && entry.leverEdgeSkuCode === merged.leverEdgeSkuCode
        )) {
          throw new ApiError("SKU_MAPPING_EXISTS", 409);
        }
        mappings[index] = merged;
        persistMappings();
        logAudit(user, "SKU_MAPPING_CHANGE", `Updated mapping ${code.trim()}`);
        return merged;
      },
      async deleteMapping(code) {
        await delay();
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "admin");
        const index = mappings.findIndex(
          (entry) => entry.leverEdgeSkuCode === code.trim()
        );
        if (index < 0) throw new ApiError("SKU_MAPPING_NOT_FOUND", 404);
        const [removed] = mappings.splice(index, 1);
        persistMappings();
        logAudit(user, "SKU_MAPPING_CHANGE", `Deleted mapping ${code.trim()}`);
        return removed;
      },
      async importMappings(file) {
        await delay();
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "admin");
        const text = await file.text();
        const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ""));
        const result2 = { created: 0, updated: 0, total: 0, errors: [] };
        if (rows.length === 0) return result2;
        const headerIndex = {};
        rows[0].forEach((header, index) => {
          const name = header.trim();
          if (name !== "" && headerIndex[name] === void 0) headerIndex[name] = index;
        });
        if (headerIndex.LeverEdge_SKU_Code === void 0) {
          throw new ApiError("IMPORT_FAILED", 400, "CSV import: missing LeverEdge_SKU_Code header column");
        }
        const byCode = new Map(mappings.map((entry) => [entry.leverEdgeSkuCode, entry]));
        rows.slice(1).forEach((cells, offset) => {
          const at = (column) => cells[headerIndex[column]]?.trim() ?? "";
          const code = at("LeverEdge_SKU_Code");
          if (code === "") {
            result2.errors.push({ line: offset + 2, reason: "blank LeverEdge_SKU_Code" });
            return;
          }
          const csFactor = Number(at("CS_Factor"));
          const dzFactor = Number(at("DZ_Factor"));
          const entry = {
            leverEdgeSkuCode: code,
            leverEdgeItemName: at("LeverEdge_Item_Name"),
            xeroItemCode: at("Xero_Item_Code"),
            xeroItemName: at("Xero_Item_Name"),
            csFactor: Number.isFinite(csFactor) && csFactor > 0 ? csFactor : 1,
            dzFactor: Number.isFinite(dzFactor) && dzFactor > 0 ? dzFactor : 12,
            category: at("Category"),
            active: !["false", "0", "no"].includes(at("Active").toLowerCase())
          };
          if (byCode.has(code)) result2.updated += 1;
          else result2.created += 1;
          byCode.set(code, entry);
        });
        mappings = [...byCode.values()].sort(
          (a, b) => a.leverEdgeSkuCode.localeCompare(b.leverEdgeSkuCode)
        );
        result2.total = mappings.length;
        persistMappings();
        logAudit(
          user,
          "IMPORT_SKU_MAPPING",
          `CSV import: ${result2.created} created, ${result2.updated} updated (${result2.total} total)`
        );
        return result2;
      },
      async listAudit(query) {
        await delay(200);
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "executive", "admin");
        const limit = typeof query?.limit === "number" && query.limit > 0 && query.limit <= 1e3 ? query.limit : 200;
        const filtered = auditLog.filter((entry) => {
          if (query?.date && entry.Date !== query.date) return false;
          if (query?.location && (entry.Location ?? "").toLowerCase() !== query.location.toLowerCase()) return false;
          if (query?.action && entry.Action !== query.action) return false;
          return true;
        }).sort((a, b) => b.Timestamp.localeCompare(a.Timestamp));
        const result2 = { count: filtered.length, entries: filtered.slice(0, limit) };
        return result2;
      },
      async listUsers() {
        await delay(140);
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "admin");
        return MOCK_USERS.map(toAuthUser);
      },
      async listLocations() {
        await delay(80);
        ensureSeeded();
        const derived = new Set(LOCATIONS);
        for (const row of reconRows) {
          if (row.Location.trim() !== "") derived.add(row.Location.trim());
        }
        return [...derived];
      },
      async listUnmappedSkus() {
        await delay(200);
        ensureSeeded();
        currentUser();
        return unmappedQueue;
      },
      async resolveUnmappedSku(item) {
        await delay();
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "admin");
        const entry = coerceMapping({
          leverEdgeSkuCode: item.sourceCode,
          leverEdgeItemName: item.sourceName,
          xeroItemCode: item.suggestionCode,
          xeroItemName: item.suggestionName,
          csFactor: 1,
          dzFactor: 12,
          category: "Unclassified",
          active: true
        });
        if (mappings.some((existing) => existing.leverEdgeSkuCode === entry.leverEdgeSkuCode)) {
          throw new ApiError("SKU_MAPPING_EXISTS", 409);
        }
        mappings.push(entry);
        mappings.sort((a, b) => a.leverEdgeSkuCode.localeCompare(b.leverEdgeSkuCode));
        persistMappings();
        unmappedQueue = unmappedQueue.filter((candidate) => candidate.id !== item.id);
        persistUnmapped();
        logAudit(user, "SKU_MAPPING_CHANGE", `Accepted fuzzy mapping ${entry.leverEdgeSkuCode}`);
        return entry;
      },
      async dismissUnmappedSku(id) {
        await delay(160);
        ensureSeeded();
        const user = currentUser();
        requireRole(user, "admin");
        const previous = unmappedQueue.length;
        unmappedQueue = unmappedQueue.filter((item) => item.id !== id);
        persistUnmapped();
        if (unmappedQueue.length !== previous) {
          logAudit(user, "SKU_MAPPING_CHANGE", `Dismissed unmapped suggestion ${id}`);
        }
      }
    };
  }
});

// smoke.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
var backing = /* @__PURE__ */ new Map();
globalThis.localStorage = {
  getItem: (key) => backing.has(key) ? backing.get(key) : null,
  setItem: (key, value) => backing.set(key, String(value)),
  removeItem: (key) => backing.delete(key),
  clear: () => backing.clear()
};
var { mockApi: mockApi2 } = await Promise.resolve().then(() => (init_mockApi(), mockApi_exports));
var { parseLeverEdgeFile: parseLeverEdgeFile2, parseXeroFile: parseXeroFile2, parsePhysicalFile: parsePhysicalFile2 } = await Promise.resolve().then(() => (init_xlsx(), xlsx_exports));
var { buildPreviewRows: buildPreviewRows2, computePreviewRow: computePreviewRow2, summarizePreview: summarizePreview2 } = await Promise.resolve().then(() => (init_recon(), recon_exports));
var { isSubmissionOpen: isSubmissionOpen2, lagosDateString: lagosDateString2, secondsUntilCutoff: secondsUntilCutoff2 } = await Promise.resolve().then(() => (init_wat(), wat_exports));
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}
function fakeFile(path) {
  const buffer = readFileSync(resolve(path));
  return {
    name: path.split(/[\\/]/).pop(),
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    text: async () => buffer.toString("utf-8")
  };
}
var today = lagosDateString2();
console.log(`today(Lagos)=${today} cutoffSeconds=${secondsUntilCutoff2()}`);
assert(/^\d{4}-\d{2}-\d{2}$/.test(today), "lagosDateString returns YYYY-MM-DD");
assert(isSubmissionOpen2(today) === secondsUntilCutoff2() > 0, "cutoff helpers agree");
function setSession(token) {
  ;
  globalThis.localStorage.setItem("renuzi_token", token);
}
var admin = await mockApi2.login("admin@renuzi", "anything");
setSession(admin.token);
assert(admin.user.role === "admin" && admin.token === "mock.usr_admin", "admin login (any password)");
var failed = false;
try {
  await mockApi2.login("nobody@renuzi", "x");
} catch {
  failed = true;
}
assert(failed, "unknown email rejected with 401");
var leveredge = await parseLeverEdgeFile2(fakeFile("samples/leveredge_sample.xlsx"));
assert(leveredge.rows.length > 50, `leveredge parsed (${leveredge.rows.length} rows)`);
assert(leveredge.rows.every((row) => typeof row.sku === "string"), "SKUs survive as strings");
var xero = await parseXeroFile2(fakeFile("samples/xero_sample.xlsx"));
assert(xero.rows.length > 50, `xero parsed (${xero.rows.length} rows)`);
assert(xero.sheetNames.some((name) => /KETU/i.test(name)), "xero sheet names carry locations");
var physical = await parsePhysicalFile2(fakeFile("samples/physical_sample.xlsx"));
assert(physical.rows.length > 100, `physical parsed (${physical.rows.length} rows)`);
var bad = fakeFile("samples/sku_seed.csv");
var rejected = false;
try {
  await parseLeverEdgeFile2(bad);
} catch (error) {
  rejected = error.issues !== void 0;
}
assert(rejected, "wrong file rejected with column-level issues");
var mappings2 = await mockApi2.listMappings();
assert(mappings2.length >= 30, `mappings seeded (${mappings2.length})`);
var xeroKetu = xero.rows.filter((row) => row.location === "Ketu");
var preview = buildPreviewRows2(
  { leveredge: leveredge.rows, xero: xeroKetu, physical: [] },
  mappings2
);
assert(preview.length > 30, `preview rows joined (${preview.length})`);
var computedRows = preview.map(computePreviewRow2);
var summarized = summarizePreview2(computedRows);
console.log("preview summary", summarized);
assert(summarized.atRiskSkus > 0, "preview flags at-risk SKUs");
var bigVariance = computedRows.filter((row) => row.noteRequired);
console.log(`note-required rows: ${bigVariance.length}`);
var ketu = await mockApi2.login("ketu@renuzi", "demo");
setSession(ketu.token);
var result = await mockApi2.submitReconciliation({
  leveredge: fakeFile("samples/leveredge_sample.xlsx"),
  xero: fakeFile("samples/xero_sample.xlsx"),
  physical: fakeFile("samples/physical_sample.xlsx"),
  counts: {
    date: today,
    location: "Ketu",
    rows: computedRows.map((row) => ({
      sku: row.sku,
      cs: row.cs,
      dz: row.dz,
      pc: row.pc,
      notes: row.noteRequired ? "Short-supply confirmed with loading bay" : null
    }))
  }
});
console.log("submit summary", result.summary);
assert(result.summary.rowCount > 30, `submit reconciled ${result.summary.rowCount} rows`);
assert(result.parsed.leveredge === leveredge.rows.length, "submit parsed leveredge count matches");
var status = await mockApi2.getReconciliationStatus(today, "Ketu");
assert(status.rowCount === result.summary.rowCount, "status rows match submit");
assert(status.summary.discrepancy > 0, "status contains Discrepancies");
var seededDate = new Date(Date.now() - 3 * 864e5);
var seeded = await mockApi2.getReconciliationStatus(
  seededDate.toISOString().slice(0, 10),
  "Ketu"
);
assert(
  seeded.summary.matched > 0 && seeded.summary.discrepancy > 0,
  `seeded history mixes Matched (${seeded.summary.matched}) + Discrepancy (${seeded.summary.discrepancy})`
);
var unmapped = await mockApi2.listUnmappedSkus();
assert(unmapped.length > 0, `unmapped queue populated (${unmapped.length})`);
failed = false;
try {
  await mockApi2.getReconciliationStatus(today, "Lekki");
} catch (error) {
  failed = error.code === "LOCATION_FORBIDDEN";
}
assert(failed, "manager cannot read another location");
setSession(admin.token);
var created = await mockApi2.createMapping({
  leverEdgeSkuCode: "99990001",
  leverEdgeItemName: "SMOKE TEST SKU",
  xeroItemCode: "99990001",
  xeroItemName: "Smoke Test SKU",
  csFactor: 12,
  dzFactor: 12,
  category: "Test",
  active: true
});
assert(created.leverEdgeSkuCode === "99990001", "mapping created");
var updated = await mockApi2.updateMapping("99990001", { category: "Smoke" });
assert(updated.category === "Smoke", "mapping inline-updated");
await mockApi2.deleteMapping("99990001");
assert(!(await mockApi2.listMappings()).some((entry) => entry.leverEdgeSkuCode === "99990001"), "mapping deleted");
var csv = "LeverEdge_SKU_Code,LeverEdge_Item_Name,Xero_Item_Code,Xero_Item_Name,CS_Factor,DZ_Factor,Category,Active\n99990002,SMOKE CSV SKU,99990002,Smoke CSV,24,12,Test,true\n";
var imported = await mockApi2.importMappings({
  name: "smoke.csv",
  text: async () => csv,
  arrayBuffer: async () => new TextEncoder().encode(csv).buffer
});
assert(imported.created === 1, "CSV import created 1");
await mockApi2.deleteMapping("99990002");
var exec = await mockApi2.login("exec@renuzi", "demo");
setSession(exec.token);
var audit = await mockApi2.listAudit({ limit: 50 });
assert(
  audit.count > 0 && audit.entries.some((entry) => entry.Action === "SUBMIT_RECONCILIATION"),
  "audit trail lists submissions"
);
setSession(exec.token);
failed = false;
try {
  await mockApi2.createMapping({
    leverEdgeSkuCode: "x",
    leverEdgeItemName: "",
    xeroItemCode: "",
    xeroItemName: "",
    csFactor: 1,
    dzFactor: 12,
    category: "",
    active: true
  });
} catch (error) {
  failed = error.code === "FORBIDDEN";
}
assert(failed, "executive blocked from mapping writes");
console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE PASSED");
