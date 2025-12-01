import axios, { AxiosResponse, AxiosError, AxiosRequestConfig, AxiosHeaders } from 'axios';
import { type ZodTypeAny } from 'zod';
import { apiResponseSchema, paginatedResponseSchema } from '@/schemas/api';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { useOfflineStore } from '@/store/offlineStore';


// Configuración base de axios
const RAW_ENV_API_URL = import.meta.env.VITE_API_URL as string | undefined;
// Normalizar ENV_API_URL para asegurar sufijo '/api' cuando el backend lo usa con prefijo
function normalizeEnvApiUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.replace(/\/+$/, '');
  // Si ya termina en '/api', respetar tal cual
  if (trimmed.endsWith('/api')) return trimmed;
  // Si el backend expone rutas bajo '/api', añadirlo por defecto
  return `${trimmed}/api`;
}
const ENV_API_URL = normalizeEnvApiUrl(RAW_ENV_API_URL);
const DEFAULT_BASE_URL = ENV_API_URL || '/api';
// Habilitación de mocks: configurable por ENV y override en runtime (localStorage)
function isMocksEnabled(): boolean {
  try {
    const envVal = String((import.meta as any).env?.VITE_USE_MOCKS || '').toLowerCase() === 'true';
    let lsVal = false;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      lsVal = String(localStorage.getItem('observability:useMocks')).toLowerCase() === 'true';
    }
    return envVal || lsVal;
  } catch {
    return String((import.meta as any).env?.VITE_USE_MOCKS || '').toLowerCase() === 'true';
  }
}

export const api = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ====== SISTEMA DE DRIVER DUAL (HTTP | INVOKE) ======
/**
 * Configuración del driver dual
 * Permite alternar entre HTTP (backend Node.js) e Invoke (Tauri nativo)
 */
export interface DualDriverConfig {
  preferredDriver: 'http' | 'invoke';
  fallbackToHttp: boolean;
  fallbackToInvoke: boolean;
}

const DEFAULT_DUAL_DRIVER_CONFIG: DualDriverConfig = {
  preferredDriver: 'http',
  fallbackToHttp: true,
  fallbackToInvoke: false,
};

if (import.meta.env.PROD) {
  DEFAULT_DUAL_DRIVER_CONFIG.preferredDriver = 'http';
  DEFAULT_DUAL_DRIVER_CONFIG.fallbackToHttp = true;
  DEFAULT_DUAL_DRIVER_CONFIG.fallbackToInvoke = false;
}

let dualDriverConfig: DualDriverConfig = { ...DEFAULT_DUAL_DRIVER_CONFIG };

/**
 * Configura el driver dual
 */
export function configureDualDriver(config: Partial<DualDriverConfig>): void {
  dualDriverConfig = { ...dualDriverConfig, ...config };
}

/**
 * Obtiene la configuración actual del driver dual
 */
export function getDualDriverConfig(): DualDriverConfig {
  return { ...dualDriverConfig };
}



/**
 * Determina si un comando debe usar Tauri invoke basado en la configuración y disponibilidad
 */
function shouldUseInvoke(method: string, url: string): boolean {
  return false;
}

/**
 * Verifica si el backend HTTP está saludable
 */
function isBackendHealthy(): boolean {
  try {
    const status = backendStatus.getLastStatus();
    return status === 'ok' || status === 'no_health';
  } catch {
    return false;
  }
}

/**
 * Coincide patrones de URL con rutas reales
 */
function matchUrlPattern(pattern: string, url: string): boolean {
  // Convertir patrones como "GET:/products/*" a expresiones regulares
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(url);
}

/**
 * Extrae parámetros de la URL para comandos Tauri
 */
function extractCommandParams(method: string, url: string, config?: AxiosRequestConfig): any {
  const urlParts = url.split('?');
  const path = urlParts[0];
  const queryString = urlParts[1];
  
  const params: any = {};
  
  // Extraer parámetros de query
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }
  
  // Extraer parámetros de la configuración
  if (config?.params) {
    Object.assign(params, config.params);
  }
  
  // Extraer ID de la URL para comandos específicos
  if (url.includes('/products/')) {
    const match = path.match(/\/products\/(\d+)/);
    if (match) {
      params.id = parseInt(match[1], 10);
    }
  } else if (url.includes('/clients/')) {
    const match = path.match(/\/clients\/(\d+)/);
    if (match) {
      params.id = parseInt(match[1], 10);
    }
  } else if (url.includes('/sales/')) {
    const match = path.match(/\/sales\/(\d+)/);
    if (match) {
      params.id = parseInt(match[1], 10);
    }
  } else if (url.includes('/inventory/stock/')) {
    const match = path.match(/\/inventory\/stock\/(\d+)/);
    if (match) {
      params.id = parseInt(match[1], 10);
    }
  }
  
  // Extraer UUIDs de la URL
  const uuidMatch = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) {
    params.uuid = uuidMatch[0];
  }

  // Payload para mutaciones
  const m = method.toUpperCase();
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    const raw = config?.data;
    try {
      params.payload = typeof raw === 'string' ? JSON.parse(raw as string) : raw;
    } catch {
      params.payload = raw;
    }
  }

  return params;
}



// ====== DeduplicaciÃ³n de GETs (evita mÃºltiples llamadas idÃ©nticas simultÃ¡neas) ======
const inflightGetRequests = new Map<string, Promise<AxiosResponse<unknown>>>();

async function performDedupedGet<T = unknown, D = unknown>(url: string, config?: AxiosRequestConfig<D>): Promise<AxiosResponse<T, D>> {
  const reqConfig: AxiosRequestConfig = {
    ...(config || {}),
    method: 'get',
    url,
  };
  const key = getCacheKey(reqConfig);
  const existing = inflightGetRequests.get(key);
  if (existing) return existing as Promise<AxiosResponse<T, D>>;

  

  // Usar HTTP normal
  const promise = api.request<T, AxiosResponse<T, D>>(reqConfig);
  inflightGetRequests.set(key, promise as unknown as Promise<AxiosResponse<unknown>>);
  try {
    const res = await promise;
    return res;
  } finally {
    inflightGetRequests.delete(key);
  }
}

// Sobrescribir api.get para usar deduplicaciÃ³n de GETs
api.get = function <T = unknown, R = AxiosResponse<T, unknown>, D = unknown>(
  url: string,
  config?: AxiosRequestConfig<D>
): Promise<R> {
  return performDedupedGet<T, D>(url, config) as unknown as Promise<R>;
};

// ====== AutodetecciÃƒÂ³n del backend y fallback de puerto ======
let apiInitialized = false;

async function tryHealth(baseUrl: string): Promise<boolean> {
  // En modo mocks, siempre reportar salud OK sin golpear la red
  if (isMocksEnabled()) return true;
  try {
    const client = axios.create({ baseURL: baseUrl, timeout: 8000 });
    // Primer intento: endpoint estÃ¡ndar
    const resp = await client.get('/health');
    if (resp.status === 200) return true;
  } catch (e) {
    console.debug('[tryHealth] /health falló, probando fallback', {
      baseUrl,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    const client = axios.create({ baseURL: baseUrl, timeout: 8000 });
    // Fallback: endpoint usado por el arranque de Tauri
    const resp = await client.get('/test-health');
    return resp.status === 200;
  } catch (e1) {
    // Intentos alternativos: endpoints públicos de settings
    try {
      const client = axios.create({ baseURL: baseUrl, timeout: 8000 });
      const resp = await client.get('/settings/system-info');
      return resp.status === 200;
    } catch (e2) {
      console.debug('[tryHealth] /settings/system-info falló', {
        baseUrl,
        error: e2 instanceof Error ? e2.message : String(e2),
      });
    }
    try {
      const client = axios.create({ baseURL: baseUrl, timeout: 8000 });
      const resp = await client.get('/settings/public');
      return resp.status === 200;
    } catch (e3) {
      console.debug('[tryHealth] /settings/public falló', {
        baseUrl,
        error: e3 instanceof Error ? e3.message : String(e3),
      });
    }
    console.warn('[tryHealth] No se pudo verificar salud del backend con ninguno de los endpoints', {
      baseUrl,
      firstError: e1 instanceof Error ? e1.message : String(e1),
    });
    return false;
  }
}

export async function initializeApiBaseUrl(): Promise<string> {
  if (apiInitialized) return api.defaults.baseURL || DEFAULT_BASE_URL;

  // 🚨 MODO OFFLINE EXTREMO - NUNCA intentar conectar a ningún servidor
  if ((window as any).__FORCE_OFFLINE_MODE__) {
    api.defaults.baseURL = '/api';
    apiInitialized = true;
    return '/api';
  }

  // Construir candidatos tanto para desarrollo como producción
  let sameOriginApi: string | undefined;
  try {
    if (typeof window !== 'undefined') {
      const host = window.location.host || '';
      const proto = (window.location as any).protocol || '';
      const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
      const isTauri = proto.startsWith('tauri');
      if (isLocalHost || isTauri) {
        sameOriginApi = '/api';
      }
    }
  } catch { /* noop */ }

  const candidates = Array.from(
    new Set([
      '/api',
      ENV_API_URL,
      sameOriginApi || (import.meta.env.DEV ? '/api' : undefined),
      DEFAULT_BASE_URL,
    ].filter(Boolean))
  ) as string[];

  for (const candidate of candidates) {
    const ok = await tryHealth(candidate);
    if (ok) {
      api.defaults.baseURL = candidate;
      apiInitialized = true;
      return candidate;
    }
  }

  // Si ninguna responde, mantener DEFAULT_BASE_URL con preferencia de ENV
  api.defaults.baseURL = ENV_API_URL || DEFAULT_BASE_URL;
  apiInitialized = true;
  return api.defaults.baseURL as string;
}

// Estado detallado de backend para la UI
export type BackendStatus = 'ok' | 'no_health' | 'down';

export async function checkBackendStatus(baseUrl?: string): Promise<BackendStatus> {
  // En modo mocks, considerar backend OK
  if (isMocksEnabled()) return 'ok';
  const url = baseUrl || api.defaults.baseURL || DEFAULT_BASE_URL;
  let rateLimitedHit = false;
  let authRequiredHit = false;
  try {
    const client = axios.create({ baseURL: url, timeout: 8000 });
    const resp = await client.get('/health');
    if (resp.status === 200 && (resp.data?.success ?? true)) return 'ok';
  } catch (err: unknown) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 429) rateLimitedHit = true;
    if (status === 401) authRequiredHit = true; // health requiere auth pero servidor accesible
  }
  try {
    const client = axios.create({ baseURL: url, timeout: 8000 });
    const resp = await client.get('/test-health');
    if (resp.status === 200 && (resp.data?.success ?? true)) return 'ok';
  } catch (err: unknown) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 429) rateLimitedHit = true;
    if (status === 401) authRequiredHit = true;
  }
  // Endpoints públicos alternativos: servidor activo sin health
  try {
    const client = axios.create({ baseURL: url, timeout: 8000 });
    const resp = await client.get('/settings/system-info');
    if (resp.status === 200) return 'no_health';
  } catch (err: unknown) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 429) rateLimitedHit = true;
    if (status === 401) authRequiredHit = true; // endpoint requiere auth, servidor accesible
  }
  try {
    const client = axios.create({ baseURL: url, timeout: 8000 });
    const resp = await client.get('/settings/public');
    if (resp.status === 200) return 'no_health';
  } catch (err: unknown) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 429) rateLimitedHit = true;
    if (status === 401) authRequiredHit = true;
  }
  // Si hubo algún 429, consideramos el servidor accesible (no bloquear la UI)
  if (rateLimitedHit) return 'ok';
  // Si hubo 401 en cualquiera de los checks, asumimos servidor accesible pero con auth requerida
  if (authRequiredHit) return 'no_health';
  return 'down';
}

export function parseApiResponse<T>(resp: any): { success: boolean; data: T } {
  if (resp && typeof resp === 'object') {
    if (resp.success === true && 'data' in resp) return resp as any
    if (resp.data && typeof resp.data === 'object' && 'success' in resp.data) return resp.data as any
    if ('data' in resp) return { success: true, data: resp.data }
  }
  return { success: true, data: resp as T }
}

// ====== Helper de estado de backend con polling y suscripción ======
export type BackendStatusListener = (status: BackendStatus) => void;
let __backendStatusInterval: number | null = null;
let __lastBackendStatus: BackendStatus = 'ok'; // Force reset to ok
const __backendStatusListeners = new Set<BackendStatusListener>();

function __notifyBackendStatus(status: BackendStatus) {
  __lastBackendStatus = status;
  try {
    __backendStatusListeners.forEach((cb) => {
      try { cb(status); } catch (e) {
        console.warn('[backendStatus] Listener lanzó excepción', e);
      }
    });
    // Emitir evento global para otros consumidores
    try {
      window.dispatchEvent(new CustomEvent('backend:status', { detail: { status } }));
    } catch (e) {
      console.warn('[backendStatus] Error al despachar evento global', e);
    }
  } catch (e) {
    console.warn('[backendStatus] Error inesperado notificando estado', e);
  }
}

async function __pollBackendStatusOnce() {
  // Soporte de override manual desde localStorage para simulaciones en Observability
  try {
    const overrideRaw = (typeof window !== 'undefined' && typeof localStorage !== 'undefined') ? localStorage.getItem('observability:backendOverride') : null;
    const override = overrideRaw === 'ok' || overrideRaw === 'no_health' || overrideRaw === 'down' ? (overrideRaw as BackendStatus) : null;
    if (override) {
      __notifyBackendStatus(override);
      return;
    }
  } catch { /* noop */ }
  try {
    const status = await checkBackendStatus();
    __notifyBackendStatus(status);
  } catch {
    __notifyBackendStatus('down');
  }
}

export const backendStatus = {
  startPolling(intervalMs: number = 30000) {
    if (__backendStatusInterval !== null) return;
    let current = Math.max(5000, intervalMs);
    const min = 5000;
    const max = 60000;
    let timeoutId: number | null = null;
    const loop = async () => {
      await __pollBackendStatusOnce();
      const s = backendStatus.getLastStatus();
      if (s === 'ok' || s === 'no_health') {
        current = intervalMs;
      } else {
        current = Math.min(Math.floor(current * 1.6), max);
      }
      try { __attemptBaseSwitch(); } catch { void 0 }
      timeoutId = window.setTimeout(loop, Math.max(min, current));
    };
    __backendStatusInterval = 1 as any;
    loop();
    (backendStatus as any).__timeoutId = timeoutId;
    (backendStatus as any).__baseInterval = intervalMs;
  },
  stopPolling() {
    if (__backendStatusInterval !== null) {
      try { clearInterval(__backendStatusInterval); } catch {}
      __backendStatusInterval = null;
    }
    try {
      const tid = (backendStatus as any).__timeoutId as number | null;
      if (tid) clearTimeout(tid);
      (backendStatus as any).__timeoutId = null;
    } catch {}
  },
  onStatus(cb: BackendStatusListener) {
    __backendStatusListeners.add(cb);
    // Emitir estado actual de inmediato para coherencia
    try { cb(__lastBackendStatus); } catch (error) {
      console.warn('BackendStatus listener callback threw:', error);
    }
  },
  offStatus(cb: BackendStatusListener) {
    __backendStatusListeners.delete(cb);
  },
  getLastStatus(): BackendStatus {
    return __lastBackendStatus;
  },
  // Aplica un override manual del estado del backend; si es null, limpia el override
  applyOverride(status?: BackendStatus | null) {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        if (!status) {
          localStorage.removeItem('observability:backendOverride');
        } else {
          localStorage.setItem('observability:backendOverride', status);
        }
      }
    } catch { /* noop */ }
    // Notificar inmediatamente según override, o re-sondear si se limpió
    try {
      const overrideRaw = (typeof window !== 'undefined' && typeof localStorage !== 'undefined') ? localStorage.getItem('observability:backendOverride') : null;
      const override = overrideRaw === 'ok' || overrideRaw === 'no_health' || overrideRaw === 'down' ? (overrideRaw as BackendStatus) : null;
      if (override) {
        __notifyBackendStatus(override);
      } else {
        __pollBackendStatusOnce();
      }
    } catch { /* noop */ }
  },
};

// Iniciar polling de estado del backend desde la capa de API (idempotente)
    try { backendStatus.startPolling(30000); } catch (e) { void 0 }

async function __attemptBaseSwitch() {
  if (isMocksEnabled()) return;
  const current = api.defaults.baseURL || DEFAULT_BASE_URL;
  const candidates = Array.from(new Set([
    '/api',
    ENV_API_URL,
    current,
  ].filter(Boolean))) as string[];
  for (const c of candidates) {
    try {
      const ok = await tryHealth(c);
      if (ok) {
        api.defaults.baseURL = c;
        return;
      }
    } catch {}
  }
}

// ====== Control de cachÃ© (desactivado por defecto) ======
type CacheRecord = { timestamp: number; data: unknown };

const CACHE_PREFIX = 'api-cache:';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos
// Por defecto desactivamos el cache; solo se activa si el request lo permite explÃ­citamente
// Endpoints que nunca deben cachearse (sensibles o tiempo real)
const NO_CACHE_PATHS = [
  '/reports/dashboard',
  '/auth',
  '/sales',
  '/inventory',
  '/suppliers',
];

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      usp.append(k, String(v));
    }
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

function getCacheKey(config: AxiosRequestConfig): string {
  const base = (config.baseURL || '') + (config.url || '');
  const qs = buildQueryString(config.params as Record<string, unknown> | undefined);
  return `${CACHE_PREFIX}${config.method || 'get'}:${base}${qs}`;
}

function readCache(key: string, ttlMs = DEFAULT_TTL_MS): CacheRecord | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: CacheRecord = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== 'number') return null;
    const isFresh = Date.now() - parsed.timestamp < ttlMs;
    return isFresh ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown): void {
  try {
    const record: CacheRecord = { timestamp: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function buildAxiosResponse(config: AxiosRequestConfig, data: unknown): AxiosResponse<unknown> {
  return {
    data,
    status: 200,
    statusText: 'OK (cached)',
    headers: {},
    config,
  } as AxiosResponse<unknown>;
}

// Última notificación para circuit breaker (evitar spam)
let __lastCircuitWarnAt = 0;
let __lastConnectionErrorAt = 0;
let __isRefreshing = false;
let __refreshPromise: Promise<string> | null = null;

async function __performTokenRefresh(): Promise<string> {
  if (__refreshPromise) return __refreshPromise;
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) throw new AxiosError('No refresh token');
  if (isMocksEnabled()) {
    const st = useAuthStore.getState();
    st.setToken('new-token', refreshToken);
    return Promise.resolve('new-token');
  }
  const base = api.defaults.baseURL || DEFAULT_BASE_URL;
  const client = axios.create({ baseURL: base, timeout: 10000, headers: { 'Content-Type': 'application/json' } });
  __isRefreshing = true;
  __refreshPromise = client.post('/auth/refresh', { refreshToken }).then((res) => {
    const data = (res.data?.data ?? res.data) as any;
    const nextToken = data?.token || data;
    const rt = data?.refreshToken ?? refreshToken;
    const st = useAuthStore.getState();
    st.setToken(nextToken, rt);
    return String(nextToken);
  }).finally(() => { __isRefreshing = false; __refreshPromise = null; });
  return __refreshPromise;
}

// Interceptor de request
api.interceptors.request.use(
  (config) => {
    // Mock de endpoints básicos cuando USE_MOCKS=true
    try {
      if (isMocksEnabled()) {
        const method = (config.method || 'get').toLowerCase();
        const urlPath = (config.url || '').toString();
        const respond = (payload: any) => {
          config.adapter = async () => ({
            data: { success: true, data: payload },
            status: 200,
            statusText: 'OK (mock)',
            headers: {},
            config,
          } as any);
        };
        // Health general
        if (method === 'get' && (urlPath.includes('/health') || urlPath.includes('/test-health'))) {
          respond({
            success: true,
            message: 'OK (mock)',
            version: 'dev-mock',
            timestamp: new Date().toISOString(),
            db: { healthy: true, latency: Math.floor(30 + Math.random() * 50) },
            config: { ok: true, errors: 0, warnings: 0 },
          });
          return config;
        }
        // Endpoints públicos
        if (method === 'get' && urlPath.includes('/settings/system-info')) {
          respond({
            os: 'Windows',
            node: '18.x',
            version: 'dev-mock',
            uptimeSec: Math.floor(performance.now()/1000),
          });
          return config;
        }
        if (method === 'get' && urlPath.includes('/settings/public')) {
          respond({
            appName: 'POS Sistema (mock)',
            features: { observability: true },
          });
          return config;
        }
        // Subsistemas de observabilidad
        if (method === 'get' && urlPath.includes('/inventory/health')) {
          respond({
            success: true,
            tablesExist: true,
            latencyMs: Math.floor(80 + Math.random() * 70),
            ledgerCount: Math.floor(200 + Math.random() * 200),
          });
          return config;
        }
        if (method === 'get' && urlPath.includes('/inventory/metrics')) {
          respond({ last30DaysMovements: Math.floor(500 + Math.random() * 1000) });
          return config;
        }
        if (method === 'get' && urlPath.includes('/sales/health')) {
          respond({
            success: true,
            status: 'ok',
            dbLatencyMs: Math.floor(60 + Math.random() * 60),
            salesCount: Math.floor(10 + Math.random() * 50),
            saleItemsCount: Math.floor(30 + Math.random() * 120),
          });
          return config;
        }
        if (method === 'get' && urlPath.includes('/jobs/health')) {
          respond({
            success: true,
            running: true,
            intervalMs: Math.floor(60000 + Math.random() * 90000),
            lastJobTime: new Date(Date.now() - Math.floor(Math.random()*600000)).toISOString(),
          });
          return config;
        }
        if (method === 'get' && urlPath.includes('/offline/status')) {
          respond({ success: true, status: 'online', storage: { available: true } });
          return config;
        }
      }
    } catch { /* noop */ }
    // Adjuntar token siempre que exista en el store
    try {
      const { token } = useAuthStore.getState();
      if (token) {
        const headers = AxiosHeaders.from(config.headers);
        const methodIsGet = (config.method || 'get').toLowerCase() === 'get';
        const publicGet = methodIsGet && String(headers.get('x-public-get')) === '1';
        if (import.meta.env.DEV && methodIsGet) {
          headers.set('x-public-get', '1');
          if (!headers.get('x-cache-permit')) headers.set('x-cache-permit', '1');
          if (!headers.get('x-cache-ttl-ms')) headers.set('x-cache-ttl-ms', '180000');
        }
        // En desarrollo, evitar enviar Authorization en GET para permitir ALLOW_READ_WITHOUT_AUTH del backend
        const devBypass = import.meta.env.DEV && methodIsGet;
        if (publicGet) {
          try { headers.delete('Authorization'); } catch {}
        }
        if (devBypass) {
          try { headers.delete('Authorization'); } catch {}
        }
        if (!headers.has('Authorization') && !publicGet && !devBypass) {
          headers.set('Authorization', `Bearer ${token}`);
          config.headers = headers;
        }
        config.headers = headers;
      }
    } catch (e) {
      console.debug('[api] No se pudo leer token del store', e);
    }
    // Forzar no-cache en GET y habilitar modo público/caché en DEV para resiliencia
    if ((config.method || 'get').toLowerCase() === 'get') {
      const hdrs = AxiosHeaders.from(config.headers);
      hdrs.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      hdrs.set('Pragma', 'no-cache');
      if (import.meta.env.DEV) {
        hdrs.set('x-public-get', '1');
        if (!hdrs.get('x-cache-permit')) hdrs.set('x-cache-permit', '1');
        if (!hdrs.get('x-cache-ttl-ms')) hdrs.set('x-cache-ttl-ms', '180000');
      }
      config.headers = hdrs;
    }

    // Circuit breaker: si el backend está caído, evitar golpear la red.
    try {
      const method = (config.method || 'get').toLowerCase();
      if (method === 'get') {
        const status = typeof backendStatus.getLastStatus === 'function' ? backendStatus.getLastStatus() : 'ok';
        // En desarrollo, no activar breaker aunque el estado marque "down"
        if (import.meta.env.DEV) {
          return config;
        }
        if (status === 'down') {
          const urlPath = (config.url || '').toString();
          const excluded = NO_CACHE_PATHS.some((p) => urlPath.includes(p));
          const cacheHeader = String(AxiosHeaders.from(config.headers).get('x-cache-permit')) === '1';
          const ttlHeader = Number(String(AxiosHeaders.from(config.headers).get('x-cache-ttl-ms') || '')); 
          if (cacheHeader && !excluded) {
            const key = getCacheKey(config);
            const cached = readCache(key, Number.isFinite(ttlHeader) && ttlHeader > 0 ? ttlHeader : undefined as any);
            if (cached) {
              // Servir respuesta desde caché sin solicitar a la red
              config.adapter = async () => buildAxiosResponse(config, cached.data);
              const now = Date.now();
              if (!__lastCircuitWarnAt || now - __lastCircuitWarnAt > 10000) {
                try {
                  const notificationStore = useNotificationStore.getState();
                  notificationStore.showWarning('Servidor no disponible', 'Circuit breaker activo: mostrando datos en caché.');
                } catch { /* noop */ }
                __lastCircuitWarnAt = now;
              }
              return config;
            }
          }
          // Sin caché permitido o disponible: abortar rápido para no saturar backend
          config.adapter = async () => Promise.reject(new AxiosError('Circuit breaker activo (backend caído)', 'ERR_CIRCUIT_OPEN', config));
          const now = Date.now();
          if (!__lastCircuitWarnAt || now - __lastCircuitWarnAt > 10000) {
            try {
              const notificationStore = useNotificationStore.getState();
              notificationStore.showWarning('Servidor no disponible', 'Circuit breaker activo: solicitudes GET bloqueadas temporalmente.');
            } catch { /* noop */ }
            __lastCircuitWarnAt = now;
          }
          return config;
        }
      }
    } catch { /* noop */ }

    // No agregamos _t para permitir cache controlado
    // --- Instrumentación para depuración de POST/PUT/PATCH/DELETE ---
    try {
      const methodUp = (config.method || 'get').toUpperCase();
      const urlPath = (config.url || '').toString();
      if (typeof window !== 'undefined' && methodUp !== 'GET') {
        const w: any = window as any;
        if (!Array.isArray(w.__apiLogs)) w.__apiLogs = [];
        const body = (config.data && typeof config.data !== 'string') ? JSON.stringify(config.data) : (config.data || undefined);
        w.__apiLogs.push({ phase: 'request', method: methodUp, url: urlPath, body });
      }
    } catch { /* noop */ }

    // Bloqueo de mutaciones cuando el backend está caído (con opción de override)
    try {
      const methodUp = (config.method || 'get').toUpperCase();
      const isMutation = methodUp === 'POST' || methodUp === 'PUT' || methodUp === 'PATCH' || methodUp === 'DELETE';
      if (isMutation) {
        const status = typeof backendStatus.getLastStatus === 'function' ? backendStatus.getLastStatus() : 'ok';
        const headers = AxiosHeaders.from(config.headers);
        const forceNetwork = String(headers.get('x-force-network')) === '1';
        if (status === 'down' && !forceNetwork) {
          // Aviso al usuario y rechazo inmediato para evitar pérdidas de datos
          try {
            const notificationStore = useNotificationStore.getState();
            notificationStore.showError('Servidor no disponible', 'Acción bloqueada temporalmente: el backend está caído.');
          } catch { /* noop */ }
          return Promise.reject(new AxiosError('Mutación bloqueada por salud del backend (circuit breaker)', 'ERR_CIRCUIT_OPEN', config));
        }
      }
    } catch { /* noop */ }

    // --- Normalización específica para creación/actualización de productos ---
    try {
      const methodUp = (config.method || 'get').toUpperCase();
      const urlPath = (config.url || '').toString();
      const isProductMutation = methodUp !== 'GET' && /\/products(\/|$)/.test(urlPath);
      if (isProductMutation && config.data) {
        const raw = typeof config.data === 'string' ? JSON.parse(config.data) : { ...(config.data as any) };
        const m = String(raw.metal || '').trim();
        const purity = String(raw.metalPurity || '').trim();
        const stone = String(raw.stoneType || '').trim();
        // Derivar material si falta o inválido
        const deriveMaterial = (metal: string, stoneType: string): string => {
          const ml = (metal || '').toLowerCase();
          const sl = (stoneType || '').toLowerCase();
          if (ml.includes('oro')) return 'Oro';
          if (ml.includes('plata')) return 'Plata';
          if (ml.includes('platino')) return 'Platino';
          if (ml.includes('paladio')) return 'Paladio';
          if (ml.includes('acero')) return 'Acero';
          if (ml.includes('titanio')) return 'Titanio';
          if (sl.includes('diamante')) return 'Diamante';
          if (sl.includes('esmeralda')) return 'Esmeralda';
          if (/(rub[ií])/i.test(sl)) return 'Rubí';
          if (sl.includes('zafiro')) return 'Zafiro';
          if (sl.includes('perla')) return 'Perla';
          return 'Otros';
        };
        const allowedMaterials = ['Oro','Plata','Platino','Paladio','Acero','Titanio','Diamante','Esmeralda','Rubí','Zafiro','Perla','Otros'];
        let material = String(raw.material || '').trim() || deriveMaterial(m, stone);
        if (!allowedMaterials.includes(material)) material = deriveMaterial(m, stone);
        // Normalizar metal de Plata con pureza
        let metalOut = m;
        if (/^plata$/i.test(m) && /^(925|950|999)$/i.test(purity)) {
          metalOut = `Plata ${purity}`;
        }
        // Defaults necesarios
        if (!raw.stoneType) raw.stoneType = 'Sin piedra';
        if (!raw.category) raw.category = 'Pulseras';
        raw.material = material;
        raw.metal = metalOut;
        config.data = JSON.stringify(raw);
        if (typeof window !== 'undefined') {
          const w: any = window as any;
          if (!Array.isArray(w.__apiLogs)) w.__apiLogs = [];
          w.__apiLogs.push({ phase: 'request-normalized', method: methodUp, url: urlPath, body: config.data });
          w.__lastCreate = w.__lastCreate || raw;
          w.__lastCreateModified = raw;
        }
      }
    } catch { /* noop */ }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de response
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Normalizar estructura de respuesta para consumo consistente
    try {
      const original = response.data as any;
      const hasSuccess = original && typeof original === 'object' && 'success' in original;
      const hasData = original && typeof original === 'object' && 'data' in original;
      const isEnvelope = hasSuccess && hasData;
      if (!isEnvelope) {
        // Envolver cualquier payload en ApiResponse
        const wrapped = {
          success: true,
          data: original,
        };
        response.data = wrapped as any;
      } else {
        // Asegurar que exista data aunque sea null
        if (response.data.data === undefined) {
          (response.data as any).data = null;
        }
      }
    } catch (e) {
      // Si algo falla en la normalización, continuar sin bloquear
    }
    // Cachear respuestas GET exitosas solo si estÃ¡ habilitado explÃ­citamente
    const method = response.config.method?.toLowerCase();
    const urlPath = (response.config.url || '').toString();
    const cacheHeader = String(AxiosHeaders.from(response.config.headers).get('x-cache-permit')) === '1';
    const excluded = NO_CACHE_PATHS.some((p) => urlPath.includes(p));

    if (method === 'get' && cacheHeader && !excluded) {
      const key = getCacheKey(response.config);
      writeCache(key, response.data);
    }
    // --- Instrumentación de respuesta para depuración ---
    try {
      const methodUp = (response.config.method || 'get').toUpperCase();
      const urlPath = (response.config.url || '').toString();
      if (typeof window !== 'undefined' && methodUp !== 'GET') {
        const w: any = window as any;
        if (!Array.isArray(w.__apiLogs)) w.__apiLogs = [];
        const payload = response.data;
        w.__apiLogs.push({ phase: 'response', method: methodUp, url: urlPath, status: response.status, data: payload });
      }
    } catch { /* noop */ }
    return response;
  },
  (error: AxiosError) => {
    const { response, config } = error;

    // Manejo de autenticación
    if (response?.status === 401) {
      const urlPath401 = (config?.url || '').toString();
      const suppressGlobal = (config as AxiosRequestConfig & Partial<RetryConfigExtras>)?.__suppressGlobalError === true;
      const isHealthCheck = urlPath401.includes('/health') || urlPath401.includes('/test-health');
      const method = (config?.method || 'get').toLowerCase();

      // Permitir suprimir 401 en GET cuando el caller lo solicita (p. ej. alertas, health checks)
      const isSuppressedGet = suppressGlobal && method === 'get';
      if (isHealthCheck || isSuppressedGet) {
        return Promise.reject(error);
      }
      const attempted = (config as AxiosRequestConfig & Partial<RetryConfigExtras>)?.__attemptedRefresh === true;
      const hasRT = !!useAuthStore.getState().refreshToken;
      if (hasRT && !attempted) {
        const retryCfg: AxiosRequestConfig & RetryConfigExtras = { ...config } as any;
        (retryCfg as any).__attemptedRefresh = true;
        return __performTokenRefresh()
          .then(() => api.request(retryCfg))
          .catch(() => {
            const authStore = useAuthStore.getState();
            authStore.logout();
            const notificationStore = useNotificationStore.getState();
            notificationStore.showError('Sesión expirada', 'Por favor, inicia sesión nuevamente');
            try { window.dispatchEvent(new CustomEvent('auth:redirect', { detail: { path: '/login' } })); } catch { window.location.href = '/login'; }
            return Promise.reject(error);
          });
      }
      const authStore = useAuthStore.getState();
      authStore.logout();
      const notificationStore = useNotificationStore.getState();
      notificationStore.showError('Sesión expirada', 'Por favor, inicia sesión nuevamente');
      try { window.dispatchEvent(new CustomEvent('auth:redirect', { detail: { path: '/login' } })); } catch { window.location.href = '/login'; }
      return Promise.reject(error);
    }

    // Si es un GET, intentamos fallback solo en offline o error de red
    const method = config?.method?.toLowerCase();
    const isGet = method === 'get';
    const offline = useOfflineStore.getState().isOffline;

    const urlPath = (config?.url || '').toString();
    const excluded = NO_CACHE_PATHS.some((p) => urlPath.includes(p));
    const cacheHeader = String(AxiosHeaders.from(config?.headers).get('x-cache-permit')) === '1';
    const shouldTryCache = isGet && cacheHeader && !excluded && (
      offline ||
      !response ||
      (response && response.status === 429)
    );

    if (shouldTryCache) {
      const key = getCacheKey(config || {});
      const cached = readCache(key);
      if (cached) {
        const notificationStore = useNotificationStore.getState();
        const isRateLimited = !!response && response.status === 429;
        const title = isRateLimited ? 'Limitación de tasa' : 'Modo local';
        const message = isRateLimited
          ? 'Mostrando datos en caché temporalmente por demasiadas solicitudes.'
          : 'Mostrando datos en caché por falta de conexión';
        notificationStore.showWarning(title, message);
        return Promise.resolve(buildAxiosResponse(config || {}, cached.data));
      }
    }

    // Reintentos con backoff para errores 429/5xx en GET
    const retriableStatus = [429, 500, 502, 503, 504];
    const shouldRetry = isGet && !!response && retriableStatus.includes(response.status);
    if (shouldRetry) {
      const retryCount = (config as AxiosRequestConfig & Partial<RetryConfigExtras>).__retryCount || 0;
      const maxRetries = 2;
      if (retryCount < maxRetries) {
        const delayMs = 1500 * Math.pow(2, retryCount); // 1500ms, 3000ms
        const retryConfig: AxiosRequestConfig & RetryConfigExtras = {
          ...config,
          timeout: Math.max((config?.timeout as number) || 8000, 8000),
        };
        retryConfig.__retryCount = retryCount + 1;

        return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() => api.request(retryConfig));
      }
    }

    // Mensajes informativos (permitir suprimir globalmente desde el config)
    const suppressGlobalError = (config as AxiosRequestConfig & Partial<RetryConfigExtras>)?.__suppressGlobalError === true;
    if (response?.status === 500 && !suppressGlobalError) {
      const notificationStore = useNotificationStore.getState();
      notificationStore.showError('Error del servidor', 'Ha ocurrido un error interno. Por favor, intenta nuevamente.');
    }
    // Si el circuito está abierto, no intentar alternar puertos ni mostrar error de conexión
    if ((error as AxiosError).code === 'ERR_CIRCUIT_OPEN') {
      return Promise.reject(error);
    }
    if (!response) {
      // Si usamos ENV_API_URL o base relativa '/api', no alternar puertos
      const currentBase = api.defaults.baseURL || DEFAULT_BASE_URL;
      const usingEnv = !!ENV_API_URL;
      const isRelativeProxy = currentBase.startsWith('/api');
      if (!usingEnv && !isRelativeProxy) {
        // 🚨 EN PRODUCCIÓN: Nunca intentar fallback a localhost
        if (import.meta.env.PROD) {
          console.log('[API] Modo producción: no se intentan fallbacks a localhost');
          return Promise.reject(error);
        }
        // Fallback automático de puerto: intentar con 5656 si falla 3000 (solo en desarrollo)
        const is3000 = currentBase.includes('localhost:3000') || currentBase.includes('127.0.0.1:3000');
        const alternateBase = is3000 ? '/offline' : '/api';

        // Evitar bucles infinitos
        const alreadyRetried = (config as AxiosRequestConfig & Partial<RetryConfigExtras>)?.__retriedAlternate === true;
        if (!alreadyRetried) {
          const retryConfig: AxiosRequestConfig & RetryConfigExtras = {
            ...config,
            baseURL: alternateBase,
            url: config?.url,
            timeout: 8000,
            headers: config?.headers,
          };
          retryConfig.__retriedAlternate = true;

          return api.request(retryConfig);
        }
      }

      const suppressGlobalError = (config as AxiosRequestConfig & Partial<RetryConfigExtras>)?.__suppressGlobalError === true;
      const isGet = (config?.method || 'get').toLowerCase() === 'get';
      if (!suppressGlobalError || !isGet) {
        const notificationStore = useNotificationStore.getState();
        const now = Date.now();
        if (!__lastConnectionErrorAt || now - __lastConnectionErrorAt > 15000) {
          notificationStore.showError('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión a internet.');
          __lastConnectionErrorAt = now;
        }
      }
    }
    // --- Instrumentación de error para depuración ---
    try {
      const methodUp = (config?.method || 'get').toUpperCase();
      const urlPath = (config?.url || '').toString();
      if (typeof window !== 'undefined' && methodUp !== 'GET') {
        const w: any = window as any;
        if (!Array.isArray(w.__apiLogs)) w.__apiLogs = [];
        const respData = response?.data;
        const details = (respData && typeof respData === 'object') ? (respData as any).details : undefined;
        w.__apiLogs.push({ phase: 'error', method: methodUp, url: urlPath, status: response?.status, data: respData, details, message: error.message });
      }
    } catch { /* noop */ }
    return Promise.reject(error);
  }
);

// Escribir caché después de respuestas GET exitosas si el caller lo solicita
try {
  const origAdapter = api.defaults.adapter as any;
  // Interceptor de respuesta ya maneja transformaciones; agregamos escritura de caché aquí
  api.interceptors.response.use(
    (response) => {
      try {
        const method = (response?.config?.method || 'get').toLowerCase();
        if (method === 'get') {
          const headers = AxiosHeaders.from(response?.config?.headers);
          const permit = String(headers.get('x-cache-permit')) === '1';
          const urlPath = (response?.config?.url || '').toString();
          const excluded = NO_CACHE_PATHS.some((p) => urlPath.includes(p));
          if (permit && !excluded) {
            const key = getCacheKey(response.config || {});
            writeCache(key, response.data);
          }
        }
      } catch { /* noop */ }
      return response;
    },
    (err) => Promise.reject(err)
  );
} catch { /* noop */ }

// Header de idempotencia para mutaciones si no está presente
api.interceptors.request.use((config) => {
  try {
    const method = (config.method || 'get').toLowerCase();
    if (method !== 'get') {
      const headers = AxiosHeaders.from(config.headers);
      if (!headers.has('Idempotency-Key')) {
        const seed = `${method}:${config.url || ''}:${JSON.stringify(config.data || {})}:${Date.now()}:${Math.random()}`;
        const key = 'idem_' + btoa(unescape(encodeURIComponent(seed))).slice(0, 32);
        headers.set('Idempotency-Key', key);
        config.headers = headers;
      }
    }
  } catch { void 0 }
  return config;
});

// Tipos para las respuestas de la API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// Funciones de utilidad para las llamadas a la API
export const apiUtils = {
  // Manejar errores de forma consistente
  handleError: (error: unknown, defaultMessage = 'Ha ocurrido un error') => {
    const err = error as AxiosError<{ error?: string }>;
    const message = err.response?.data?.error || err.message || defaultMessage;
    const method = (err.config?.method || 'get').toLowerCase();
    const suppress = (err.config as any)?.__suppressGlobalError === true;
    const notificationStore = useNotificationStore.getState();
    const now = Date.now();
    const noisy = /NetworkError|TypeError: Failed to fetch|ERR_NETWORK|ERR_CONNECTION/i.test(message || '');
    if (import.meta.env.DEV && (method === 'get' || suppress || noisy)) {
      throw new Error(message);
    }
    notificationStore.showError('Error', message);
    throw new Error(message);
  },

  invalidateCache: (url: string, params?: Record<string, unknown>) => {
    try {
      const key = getCacheKey({ baseURL: api.defaults.baseURL || DEFAULT_BASE_URL, url, params, method: 'get' } as any);
      localStorage.removeItem(key);
    } catch { /* noop */ }
  },

  // Mostrar mensaje de éxito
  showSuccess: (message: string) => {
    const notificationStore = useNotificationStore.getState();
    notificationStore.showSuccess('Éxito', message);
  },

  // Construir parámetros de query
  buildQueryParams: (params: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    
    return searchParams.toString();
  },
};

// ====== Adaptadores de normalización de payloads ======
// Estos helpers unifican distintos formatos de respuesta:
// - Array directo
// - Envelope { success, data }
// - Envelope paginado { success, data: { items, pagination } }
// - Objetos simples

/** Normaliza listas de elementos desde distintos formatos de payload */
export function normalizeListPayload<T>(raw: unknown): T[] {
  try {
    // Caso 1: respuesta ya es lista
    if (Array.isArray(raw)) return raw as T[];

    // Caso 2: envelope estándar { success, data }
    const data = (raw as any)?.data ?? raw;
    if (Array.isArray(data)) return data as T[];

    // Caso 3: envelope paginado { data: { items, pagination } }
    const items = (data as any)?.items;
    if (Array.isArray(items)) return items as T[];

    // Fallback: sin datos
    return [] as T[];
  } catch {
    return [] as T[];
  }
}

/** Normaliza un elemento único desde distintos formatos de payload */
export function normalizeSinglePayload<T>(raw: unknown): T | null {
  try {
    if (Array.isArray(raw)) return (raw[0] ?? null) as T | null;
    const data = (raw as any)?.data ?? raw;
    if (Array.isArray(data)) return (data[0] ?? null) as T | null;
    return (data as T) ?? null;
  } catch {
    return null;
  }
}

/** Normaliza listas y valida cada item con Zod; descarta inválidos */
export function normalizeListPayloadWithSchema<T>(raw: unknown, itemSchema: ZodTypeAny): T[] {
  const list = normalizeListPayload<unknown>(raw);
  const out: T[] = [];
  for (const it of list) {
    const parsed = itemSchema.safeParse(it);
    if (parsed.success) {
      out.push(parsed.data as T);
    } else {
      try {
        console.warn('normalizeListPayloadWithSchema: item inválido descartado', parsed.error?.format?.());
      } catch { /* noop */ }
    }
  }
  return out;
}

/** Normaliza un elemento único y valida con Zod; retorna null si inválido */
export function normalizeSinglePayloadWithSchema<T>(raw: unknown, itemSchema: ZodTypeAny): T | null {
  const one = normalizeSinglePayload<unknown>(raw);
  if (one == null) return null;
  const parsed = itemSchema.safeParse(one);
  return parsed.success ? (parsed.data as T) : null;
}

// Extras utilizados en la configuración de reintentos en interceptores
interface RetryConfigExtras {
  __retryCount?: number;
  __suppressGlobalError?: boolean;
  __retriedAlternate?: boolean;
  __attemptedRefresh?: boolean;
}

/**
 * Helpers de normalización y validación de respuestas API con Zod
 * Unifican el contrato de `{ success, data }` y `{ data: { items, pagination } }`.
 */
export function parseApiResponseWithSchema<T>(raw: unknown, dataSchema: ZodTypeAny): { success: boolean; data: T | null; message?: string; error?: string } {
  try {
    const schema = apiResponseSchema(dataSchema as any);
    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      const { success, data, message, error } = parsed.data as { success: boolean; data: T; message?: string; error?: string };
      return { success, data, message, error };
    }
    // Intentar extraer datos flexibles si el envelope no coincide exactamente
    const data = (raw as any)?.data ?? raw;
    const ok = Boolean((raw as any)?.success ?? true);
    return { success: ok, data: (data as T) ?? null };
  } catch {
    return { success: false, data: null };
  }
}

export function parsePaginatedResponse<T>(raw: unknown, itemSchema: ZodTypeAny): { success: boolean; items: T[]; pagination?: { page: number; limit: number; total: number; totalPages: number }; message?: string; error?: string } {
  try {
    const schema = paginatedResponseSchema(itemSchema as any);
    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      const { success, data, message, error } = parsed.data as { success: boolean; data: { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }; message?: string; error?: string };
      return { success, items: data.items, pagination: data.pagination, message, error };
    }
    // Fallback: intentar listas flexibles
    const items = normalizeListPayloadWithSchema<T>((raw as any)?.data ?? raw, itemSchema);
    const ok = Boolean((raw as any)?.success ?? (Array.isArray(items) ? true : false));
    return { success: ok, items };
  } catch {
    return { success: false, items: [] };
  }
}

export default api;

// Exportar funciones del driver dual
