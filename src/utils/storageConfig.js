const DEFAULT_SCHEMAS = {
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
  test: import.meta.env.VITE_SUPABASE_TEST_SCHEMA?.trim() || DEFAULT_SCHEMAS.test,
  prod: import.meta.env.VITE_SUPABASE_PROD_SCHEMA?.trim() || DEFAULT_SCHEMAS.prod,
}
export const DEFAULT_DATASET = import.meta.env.VITE_DEFAULT_DATASET === 'prod' ? 'prod' : 'test'
export const ENABLE_PROD_DATASET = toBoolean(import.meta.env.VITE_ENABLE_PROD_DATASET, false)
export const ENABLE_TEST_RESET = toBoolean(import.meta.env.VITE_ENABLE_TEST_RESET, true)
export const ENABLE_PROD_RESET = toBoolean(import.meta.env.VITE_ENABLE_PROD_RESET, false)
export const SUPABASE_TIMEOUT_MS = Number(import.meta.env.VITE_SUPABASE_TIMEOUT_MS ?? 10000)

export const AVAILABLE_DATASETS = ENABLE_PROD_DATASET ? ['test', 'prod'] : ['test']

export const isSupabaseConfigured = () => STORAGE_PROVIDER === 'supabase' && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const resolveDataset = (dataset) => (AVAILABLE_DATASETS.includes(dataset) ? dataset : DEFAULT_DATASET)

export const canResetDataset = (dataset) => {
  if (dataset === 'test') return ENABLE_TEST_RESET
  if (dataset === 'prod') return ENABLE_PROD_RESET
  return false
}

export const getSchemaForDataset = (dataset) => SUPABASE_SCHEMAS[resolveDataset(dataset)]
