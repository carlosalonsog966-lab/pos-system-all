import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: User;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  console.log('=== AUTH MIDDLEWARE START ===');
  console.log('🔐 [AUTH] Iniciando middleware de autenticación');
  
  try {
    // Permitir rutas públicas sin autenticación (configurable por .env)
    const url = (req.originalUrl || req.url || req.path || '').toString();
    const method = req.method.toUpperCase();
    const defaults = [
      '/api/metrics/prom',
      '/api/test-health',
      '/api/test-ticket',
      '/api/health',
      '/api/meta/endpoints',
      '/api/settings/public',
      '/api/settings/system-info',
    ];
    const publicEnvRaw = (process.env.PUBLIC_ENDPOINTS || '').toString();
    const publicPatterns = publicEnvRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .concat(defaults);

    function normalizePattern(p: string) {
      let s = (p || '').trim();
      if (!s) return '';
      if (!s.startsWith('/')) s = `/${s}`;
      if (!s.startsWith('/api')) s = `/api${s}`;
      return s.replace(/\/+$/,'');
    }
    function matches(urlStr: string, pattern: string) {
      const pat = normalizePattern(pattern);
      if (!pat) return false;
      // Soporte simple de comodines '*'
      if (pat.includes('*')) {
        const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
        const re = new RegExp(`^${escaped}$`);
        return re.test(urlStr);
      }
      return urlStr.startsWith(pat);
    }
    if (publicPatterns.some((p) => matches(url, p))) {
      console.log('🔓 Ruta pública detectada en auth, omitiendo verificación:', url);
      return next();
    }

    // 🔓 PASO 3: Permitir operaciones de lectura (GET) sin autenticación para testing
    const allowReadWithoutAuth = (process.env.ALLOW_READ_WITHOUT_AUTH || 'false').toLowerCase() === 'true';
    const allowWriteWithoutAuth = (process.env.ALLOW_WRITE_WITHOUT_AUTH || 'false').toLowerCase() === 'true';
    const isDev = (process.env.NODE_ENV || 'development') !== 'production';
    const authHeaderPre = req.headers['authorization'];
    // Solo omitir autenticación en GET si NO se envía Authorization
    if (allowReadWithoutAuth && method === 'GET' && !authHeaderPre) {
      console.log('🔓 Lectura sin autenticación permitida (sin Authorization) para:', url);
      // Proveer usuario invitado para controladores que esperan req.user
      (req as any).user = {
        id: 'public-user',
        username: 'public',
        email: 'public@local',
        role: 'auditor',
        isActive: true,
      } as any;
      return next();
    }
    // 🔓 Permitir escritura sin autenticación en desarrollo si está activado
    if (isDev && allowWriteWithoutAuth && method !== 'GET') {
      console.log('🔓 Escritura sin autenticación permitida en desarrollo para:', method, url);
      (req as any).user = {
        id: 'dev-user',
        username: 'dev',
        email: 'dev@local',
        role: 'manager',
        isActive: true,
      } as any;
      return next();
    }

    console.log('🔍 Auth middleware - Starting authentication');
    const authHeader = req.headers['authorization'];
    console.log('🔍 Auth header:', authHeader);
    const token = authHeader && authHeader.split(' ')[1];
    console.log('🔍 Token:', token ? 'Present' : 'Missing');

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as any;
    console.log('🔍 Decoded token:', decoded);

    // Importar modelo dinámicamente
    const { User } = await import('../models/User');

    // Intentar por ID primero; si es nulo, caer al username/email
    let user = decoded.userId
      ? await User.findByPk(decoded.userId, {
          attributes: ['id', 'username', 'email', 'role', 'isActive'],
        })
      : null;

    if (!user && decoded?.username) {
      // Buscar por username con atributos seguros que existen en todos los esquemas
      user =
        (await User.findOne({
          where: { username: decoded.username, isActive: true },
          attributes: ['id', 'username', 'email', 'role', 'isActive'],
        })) ||
        (await User.findOne({
          where: { email: decoded.username, isActive: true },
          attributes: ['id', 'username', 'email', 'role', 'isActive'],
        }));
    }
    console.log('🔍 User found:', user ? `ID: ${user.id}, Username: ${user.username}` : 'Not found');

    if (!user || !user.isActive) {
      console.log('❌ User not valid or inactive');
      return res.status(401).json({ error: 'Usuario no válido o inactivo' });
    }

    req.user = user;
    console.log('✅ Authentication successful, user set in req.user');
    next();
  } catch (error) {
    console.log('❌ Auth error:', error);
    // Diferenciar errores de JWT: responder 401 para activar cierre de sesión en frontend
    const err: any = error;
    if (err?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // 🔓 PASO 3: Si ALLOW_READ_WITHOUT_AUTH está activado y es GET request, permitir sin autenticación
    const allowReadWithoutAuth = (process.env.ALLOW_READ_WITHOUT_AUTH || 'false').toLowerCase() === 'true';
    const allowWriteWithoutAuth = (process.env.ALLOW_WRITE_WITHOUT_AUTH || 'false').toLowerCase() === 'true';
    const isDev = (process.env.NODE_ENV || 'development') !== 'production';
    const method = req.method.toUpperCase();
    
    if (allowReadWithoutAuth && method === 'GET') {
      console.log('🔓 requireRole: Lectura sin autenticación permitida para método GET');
      (req as any).user = (req as any).user || {
        id: 'public-user',
        username: 'public',
        email: 'public@local',
        role: 'auditor',
        isActive: true,
      };
      return next();
    }
    if (isDev && allowWriteWithoutAuth && method !== 'GET') {
      console.log('🔓 requireRole: Escritura sin autenticación permitida en desarrollo para método', method);
      (req as any).user = (req as any).user || {
        id: 'dev-user',
        username: 'dev',
        email: 'dev@local',
        role: 'manager',
        isActive: true,
      };
      return next();
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireManagerOrAdmin = requireRole(['admin', 'manager']);
export const requireAnyRole = requireRole(['admin', 'manager', 'cashier', 'auditor']);
