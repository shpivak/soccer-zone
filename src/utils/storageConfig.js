const DEFAULT_SCHEMAS = {
  dev: 'soccer_zone_dev',
  test: 'soccer_zone_test',
  prod: 'soccer_zone_prod',
}

const toBoolean = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return fallback
}

export const STORAGE_PROVIDER = import.meta.env.VITE_STORAGE_PROVIDER === 'supabase' ? 'supabase' : 'local'
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''
export const SUPABASE_SCHEMAS = {
  dev: import.meta.env.VITE_SUPABASE_DEV_SCHEMA?.trim() || DEFAULT_SCHEMAS.dev,
  test: import.meta.env.VITE_SUPABASE_TEST_SCHEMA?.trim() || DEFAULT_SCHEMAS.test,
  prod: import.meta.env.VITE_SUPABASE_PROD_SCHEMA?.trim() || DEFAULT_SCHEMAS.prod,
}

const resolveDefaultDataset = () => {
  const raw = import.meta.env.VITE_DEFAULT_DATASET?.trim()
  const enableProd = toBoolean(import.meta.env.VITE_ENABLE_PROD_DATASET, false)
  if (raw === 'prod' && enableProd) return 'prod'
  if (raw === 'prod') return 'dev'
  if (raw === 'test') return 'test'
  return 'dev'
}

/** Build-time Supabase dataset ("dev" | "test" | "prod"). Set via Vite env; no UI switching. */
export const DEFAULT_DATASET = resolveDefaultDataset()
export const ENABLE_PROD_DATASET = toBoolean(import.meta.env.VITE_ENABLE_PROD_DATASET, false)
export const ENABLE_DEV_RESET = toBoolean(import.meta.env.VITE_ENABLE_DEV_RESET, true)
export const ENABLE_TEST_RESET = toBoolean(import.meta.env.VITE_ENABLE_TEST_RESET, true)
export const ENABLE_PROD_RESET = toBoolean(import.meta.env.VITE_ENABLE_PROD_RESET, false)
export const SUPABASE_TIMEOUT_MS = Number(import.meta.env.VITE_SUPABASE_TIMEOUT_MS ?? 10000)

export const isSupabaseConfigured = () => STORAGE_PROVIDER === 'supabase' && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** Always the dataset baked into this build. Ignores any stale localStorage / caller hints. */
export const resolveDataset = (_ignored) => DEFAULT_DATASET

export const canResetDataset = (dataset) => {
  if (dataset === 'dev') return ENABLE_DEV_RESET
  if (dataset === 'test') return ENABLE_TEST_RESET
  if (dataset === 'prod') return ENABLE_PROD_RESET
  return false
}

export const getSchemaForDataset = (dataset) => SUPABASE_SCHEMAS[resolveDataset(dataset)]
