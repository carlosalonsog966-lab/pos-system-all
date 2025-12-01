# Documentación Técnica - Sistema POS

## Índice
1. [Arquitectura del Sistema](#arquitectura-del-sistema)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Componentes Principales](#componentes-principales)
5. [Gestión de Estado](#gestión-de-estado)
6. [Sistema de Caché](#sistema-de-caché)
7. [Sincronización Offline/Online](#sincronización-offlineonline)
8. [Optimización de Rendimiento](#optimización-de-rendimiento)
9. [APIs y Endpoints](#apis-y-endpoints)
10. [Base de Datos](#base-de-datos)
11. [Autenticación y Autorización](#autenticación-y-autorización)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Escritorio (Tauri)](#escritorio-tauri)
15. [Sincronización de Filtros y URL](docs/url-and-share-links.md)

## Arquitectura del Sistema

### Arquitectura General
El sistema POS está construido con una arquitectura de microservicios moderna que separa claramente el frontend del backend:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Base de       │
│   (React +      │◄──►│   (Node.js +    │◄──►│   Datos         │
│   TypeScript)   │    │   Express)      │    │   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Principios de Diseño
- **Separación de responsabilidades**: Frontend y backend completamente desacoplados
- **Escalabilidad**: Arquitectura preparada para crecimiento horizontal
- **Mantenibilidad**: Código modular y bien documentado
- **Performance**: Optimizaciones de caché y lazy loading
- **Offline-first**: Funcionalidad completa sin conexión a internet

## Stack Tecnológico

### Frontend
- **React 18**: Framework principal con hooks y concurrent features
- **TypeScript**: Tipado estático para mayor robustez
- **Vite**: Build tool y dev server ultra-rápido
- **Tailwind CSS**: Framework de utilidades CSS
- **Zustand**: Gestión de estado ligera y reactiva
- **React Router**: Navegación SPA
- **React Hook Form**: Manejo de formularios optimizado

### Backend
- **Node.js**: Runtime de JavaScript
- **Express.js**: Framework web minimalista
- **TypeScript**: Tipado estático en el backend
- **Prisma**: ORM moderno para base de datos
- **PostgreSQL**: Base de datos relacional
- **JWT**: Autenticación basada en tokens
- **bcrypt**: Hashing de contraseñas

### Herramientas de Desarrollo
- **ESLint**: Linting de código
- **Prettier**: Formateo automático
- **Husky**: Git hooks
- **Jest**: Testing framework
- **Docker**: Containerización

## Estructura del Proyecto

```
pos-system/
├── frontend/
│   ├── src/
│   │   ├── components/          # Componentes React
│   │   │   ├── Common/         # Componentes reutilizables
│   │   │   ├── Forms/          # Formularios
│   │   │   └── Layout/         # Componentes de layout
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilidades y librerías
│   │   ├── pages/              # Páginas principales
│   │   ├── store/              # Gestión de estado
│   │   ├── types/              # Definiciones de tipos
│   │   └── utils/              # Funciones utilitarias
│   ├── public/                 # Archivos estáticos
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── controllers/        # Controladores de rutas
│   │   ├── middleware/         # Middleware personalizado
│   │   ├── models/             # Modelos de datos
│   │   ├── routes/             # Definición de rutas
│   │   ├── services/           # Lógica de negocio
│   │   ├── types/              # Tipos TypeScript
│   │   └── utils/              # Utilidades
│   ├── prisma/                 # Esquemas de base de datos
│   └── package.json
└── docs/                       # Documentación
```

## Componentes Principales

### Componentes de Layout
- **Layout**: Contenedor principal con navegación
- **Sidebar**: Navegación lateral con menús contextuales
- **Header**: Barra superior con información del usuario
- **Footer**: Información adicional y estado del sistema

### Componentes de Negocio
- **ProductList**: Lista virtualizada de productos
- **SaleForm**: Formulario de ventas con validación
- **ClientManager**: Gestión de clientes
- **InventoryManager**: Control de inventario
- **ReportsViewer**: Visualización de reportes

### Componentes Comunes
- **OptimizedImage**: Componente de imagen con lazy loading
- **VirtualizedList**: Lista virtualizada para performance
- **ConfirmationModal**: Modal de confirmación reutilizable
- **LoadingSpinner**: Indicador de carga
- **Toast**: Notificaciones temporales

## Gestión de Estado

### Arquitectura de Estado
El sistema utiliza **Zustand** para la gestión de estado global, organizado en múltiples stores especializados:

```typescript
// Stores principales
- authStore: Autenticación y usuario
- productStore: Gestión de productos
- saleStore: Ventas y transacciones
- clientStore: Gestión de clientes
- offlineStore: Sincronización offline
- notificationStore: Notificaciones
```

### Patrón de Estado
```typescript
interface Store<T> {
  // Estado
  data: T[];
  loading: boolean;
  error: string | null;
  
  // Acciones
  fetch: () => Promise<void>;
  create: (item: Partial<T>) => Promise<T>;
  update: (id: string, item: Partial<T>) => Promise<T>;
  delete: (id: string) => Promise<void>;
  
  // Utilidades
  reset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
```

### Persistencia Local
- **localStorage**: Configuración del usuario y preferencias
- **IndexedDB**: Datos offline y caché de imágenes
- **sessionStorage**: Estado temporal de la sesión

## Sistema de Caché

### AdvancedCache
Sistema de caché multi-nivel con las siguientes características:

```typescript
interface CacheFeatures {
  // Gestión de memoria
  maxSize: number;
  ttl: number; // Time to live
  lru: boolean; // Least Recently Used eviction
  
  // Compresión
  compression: boolean;
  compressionThreshold: number;
  
  // Métricas
  hitRate: number;
  memoryUsage: number;
  
  // Persistencia
  persistence: boolean;
  exportImport: boolean;
}
```

### Tipos de Caché
1. **globalCache**: Caché general de la aplicación
2. **apiCache**: Respuestas de API con TTL corto
3. **assetCache**: Imágenes y recursos estáticos
4. **userConfigCache**: Configuración del usuario

### Estrategias de Invalidación
- **Por tags**: Invalidar grupos relacionados
- **Por tiempo**: TTL automático
- **Manual**: Invalidación explícita
- **Por eventos**: Invalidación reactiva

## Sincronización Offline/Online

### Arquitectura Offline-First
El sistema está diseñado para funcionar completamente offline:

```typescript
interface OfflineCapabilities {
  // Almacenamiento local
  localDatabase: 'IndexedDB';
  
  // Sincronización
  bidirectionalSync: boolean;
  conflictResolution: 'last-write-wins' | 'manual';
  
  // Queue de acciones
  actionQueue: OfflineAction[];
  retryMechanism: boolean;
  
  // Estado de conectividad
  onlineDetection: boolean;
  backgroundSync: boolean;
}
```

### Flujo de Sincronización
1. **Detección de conectividad**: Monitor automático
2. **Queue de acciones**: Almacenamiento de operaciones offline
3. **Sincronización automática**: Al recuperar conectividad
4. **Resolución de conflictos**: Estrategias configurables
5. **Notificaciones**: Feedback al usuario

### Componentes de Sincronización
- **SyncStatus**: Indicador visual del estado
- **OfflineIndicator**: Notificación de modo offline
- **SyncManager**: Coordinador de sincronización

## Optimización de Rendimiento

### Carga diferida y división de código

Para reducir el JavaScript inicial y mejorar los tiempos de interacción, se aplican las siguientes técnicas:

- Rutas con `React.lazy` y `Suspense` en `frontend/src/App.tsx` para cargar páginas bajo demanda.
- Imports dinámicos (`import()`) para librerías pesadas en puntos de uso:
  - `CodesPage`: `jspdf`, `qrcode`, `jsbarcode` se cargan sólo al exportar/generar códigos.
  - `ProductsPage`: `papaparse` y `xlsx` se cargan sólo al importar archivos.
  - `BarcodeScanner`: `@zxing/library` se carga al iniciar el escaneo.
- Configuración de `manualChunks` en `vite.config.ts` para separar dependencias grandes en chunks dedicados (`charts`, `xlsx`, `pdf`, `zxing`, etc.).

Patrón recomendado para imports dinámicos:

```ts
// Ejemplo: cargar jsPDF al momento de exportar
const { default: jsPDF } = await import('jspdf');
const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

// Ejemplo: cargar SheetJS al procesar XLSX
const XLSX = await import('xlsx');
const wb = XLSX.read(buf, { type: 'array' });

// Ejemplo: manejar excepciones con librerías dinámicas
const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library');
const reader = new BrowserMultiFormatReader();
const notFoundRef = NotFoundException;
```

Buenas prácticas:
- Evitar mezclar importaciones estáticas y dinámicas del mismo módulo para no generar advertencias de Vite.
- Encapsular la carga dinámica dentro de funciones de acción (exportar, importar, escanear) para minimizar el coste inicial.
- Mantener `manualChunks` actualizado cuando se introduzcan dependencias pesadas nuevas.

### Técnicas Implementadas

#### 1. Virtualización
```typescript
// Lista virtualizada para grandes datasets
<VirtualizedList
  items={products}
  itemHeight={80}
  containerHeight={400}
  renderItem={renderProduct}
/>
```

#### 2. Lazy Loading
```typescript
// Carga diferida de componentes
const LazyComponent = React.lazy(() => import('./Component'));

// Imágenes con lazy loading
<OptimizedImage
  src={imageSrc}
  lazy={true}
  placeholder={blurDataURL}
/>
```

#### 3. Memoización
```typescript
// Memoización de componentes costosos
const MemoizedComponent = React.memo(Component);

// Memoización de cálculos
const expensiveValue = useMemo(() => 
  heavyCalculation(data), [data]
);
```

#### 4. Code Splitting
```typescript
// División de código por rutas
const routes = [
  {
    path: '/products',
    component: lazy(() => import('./pages/Products'))
  }
];
```

### Métricas de Rendimiento
- **Web Vitals**: FCP, LCP, FID, CLS
- **Custom Metrics**: Tiempo de render, API latency
- **Memory Tracking**: Uso de memoria JavaScript
- **Performance Dashboard**: Visualización en tiempo real

## APIs y Endpoints

### Estructura de API REST

#### Productos
```
GET    /api/products           # Listar productos
POST   /api/products           # Crear producto
GET    /api/products/:id       # Obtener producto
PUT    /api/products/:id       # Actualizar producto
DELETE /api/products/:id       # Eliminar producto
```

#### Ventas
```
GET    /api/sales              # Listar ventas
POST   /api/sales              # Crear venta
GET    /api/sales/:id          # Obtener venta
PUT    /api/sales/:id          # Actualizar venta
DELETE /api/sales/:id          # Eliminar venta
```

#### Clientes
```
GET    /api/clients            # Listar clientes
POST   /api/clients            # Crear cliente
GET    /api/clients/:id        # Obtener cliente
PUT    /api/clients/:id        # Actualizar cliente
DELETE /api/clients/:id        # Eliminar cliente
```

#### Autenticación
```
POST   /api/auth/login         # Iniciar sesión
POST   /api/auth/logout        # Cerrar sesión
POST   /api/auth/refresh       # Renovar token
GET    /api/auth/me            # Perfil del usuario
```

#### Archivos
```
POST   /api/files              # Subir archivo (JSON con base64)
GET    /api/files              # Listar archivos por entidad
GET    /api/files/:id          # Obtener metadatos y URL pública
DELETE /api/files/:id          # Eliminar archivo
GET    /api/files/:id/verify   # Verificar integridad (checksum físico vs DB)
```

Verificación de integridad (`/api/files/:id/verify`):
- Calcula `sha256` del archivo físico y compara con `files.checksum`.
- Respuesta: `{ exists, checksumDb, checksumActual, match, path }`.
- Auditoría registrada automáticamente (`operation: file.verify`) con `result`:
  - `success`: coincide checksum
  - `partial`: existe archivo, pero checksum no coincide
  - `failure`: archivo físico ausente

#### Reportes
```
GET    /api/reports/dashboard  # Dashboard principal
GET    /api/reports/sales      # Reporte de ventas
GET    /api/reports/inventory  # Reporte de inventario
```

- Exportación unificada
  - `POST /api/reports/export` — exporta CSV/Excel/PDF según `format`.
  - Body:
    ```json
    {
      "format": "csv" | "excel" | "pdf",
      "data": {
        "filters": {
          "reportType": "sales" | "inventory" | "financial",
          "dateRange": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
          "groupBy": "hour|day|week|month|quarter|year",
          "branchId": "string",
          "paymentMethod": "string"
        }
      }
    }
    ```
  - Respuesta: archivo (`text/csv`, `application/vnd.ms-excel`, `application/pdf`).
  - Auditoría: `report.export.<reportType>` con filtros y `filename`.
  - Rate limiting: 20/min.

- Exportación de gráfica (PNG)
  - `POST /api/reports/chart/png` — genera PNG para el tipo de gráfico.
  - Body:
    ```json
    { "chartType": "dashboard" | "sales" | "inventory" | "financial", "dateRange": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" } }
    ```
  - Respuesta: `image/png`.
  - Rate limiting: 20/min.

### Formato de Respuesta
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Manejo de Errores
```typescript
interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}
```

## Base de Datos

### Esquema de Base de Datos

#### Tabla: users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabla: products
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0,
  category VARCHAR(100),
  barcode VARCHAR(100) UNIQUE,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabla: clients
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabla: sales
```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  user_id UUID REFERENCES users(id) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'completed',
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabla: sale_items
```sql
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL
);
```

Tablas adicionales relevantes para trazabilidad y archivos (implementadas vía ORM):
- `files`: metadatos (`filename`, `mimeType`, `size`, `checksum`, `storage`, `path`, `entityType`, `entityId`). Índice único en `checksum`.
- `audit_trail`: auditoría (`operation`, `entityType`, `entityId`, `actorId`, `actorRole`, `result`, `message`, `details`, `correlationId`).

### Índices y Optimizaciones
```sql
-- Índices para búsquedas frecuentes
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_client_id ON sales(client_id);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
```

## Autenticación y Autorización

### JWT Authentication
```typescript
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}
```

### Middleware de Autenticación
```typescript
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};
```

### Roles y Permisos
```typescript
enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  USER = 'user'
}

interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
  role: UserRole;
}
```

## Testing

### Estrategia de Testing
1. **Unit Tests**: Funciones y hooks individuales
2. **Integration Tests**: Componentes con estado
3. **E2E Tests**: Flujos completos de usuario
4. **Performance Tests**: Métricas de rendimiento

### Herramientas
- **Jest**: Framework de testing
- **React Testing Library**: Testing de componentes
- **MSW**: Mock Service Worker para APIs
- **Cypress**: Testing E2E

### Cobertura de Código
- Objetivo: >80% de cobertura
- Reportes automáticos en CI/CD
- Métricas por módulo y componente

## Deployment

### Entornos
1. **Development**: Local con hot reload
2. **Staging**: Entorno de pruebas
3. **Production**: Entorno productivo

### Docker Configuration
```dockerfile
# Frontend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### CI/CD Pipeline
```yaml
# GitHub Actions
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: npm test
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./deploy.sh
```

### Variables de Entorno
```env
# Frontend
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=Sistema POS

# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/pos
JWT_SECRET=your-secret-key
PORT=3001
NODE_ENV=production
```

#### Exportaciones y Gráficas (Backend)
- `FRONTEND_URL` — origen del frontend usado por Puppeteer para PDF/PNG (ej. `http://localhost:5175`).
- `EXPORTS_CLEANUP_SCHEDULE_HOUR` / `EXPORTS_CLEANUP_SCHEDULE_MINUTE` — hora/minuto para encolar limpiezas diarias.
- `EXPORTS_CLEANUP_DAYS` — días de retención para archivos en `exports/` (por defecto `14`).
- `CHARTS_CLEANUP_DAYS` — días de retención para `exports/charts/` (por defecto usa `EXPORTS_CLEANUP_DAYS`).

#### Subidas (Backend)
- `UPLOADS_BASE_PATH`: ruta base física donde se almacenan archivos servidos bajo `'/uploads'`.
- Si no se define, el backend usa un valor por defecto para Windows: `C:\\ProgramData\\SistemaPOS\\DATOS\\IMAGENES`.
- Utilidades:
  - `backend/src/utils/uploads.ts` centraliza resolución de rutas y construcción de URLs públicas.
  - Montaje estático en `app.ts`: `app.use('/uploads', express.static(getUploadsBasePath()))` mediante `ensureUploadsSubdir('')`.
 - Descarga verificada: `GET /api/files/:id/download` transmite el archivo con verificación SHA256 previa y expone encabezados `X-Checksum-SHA256`, `X-Checksum-Expected`, `X-Checksum-Match` y `X-Integrity-Verified`.

## Monitoreo y Logging

### Métricas de Aplicación
- Tiempo de respuesta de APIs
- Uso de memoria y CPU
- Errores y excepciones
- Métricas de negocio (ventas, productos)

### Logging
```typescript
interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  userId?: string;
  metadata?: any;
}
```

### Alertas
- Errores críticos
- Performance degradation
- Fallos de sincronización
- Problemas de conectividad

## Seguridad

### Medidas Implementadas
1. **Autenticación JWT**: Tokens seguros
2. **Validación de entrada**: Sanitización de datos
3. **CORS**: Configuración restrictiva
4. **Rate Limiting**: Prevención de ataques
5. **Encriptación**: Contraseñas hasheadas
6. **HTTPS**: Comunicación segura

### Buenas Prácticas
- Principio de menor privilegio
- Validación en frontend y backend
- Logs de auditoría
- Actualizaciones regulares de dependencias

## Mantenimiento

### Tareas Regulares
1. **Actualización de dependencias**
2. **Backup de base de datos**
3. **Limpieza de logs**
4. **Monitoreo de performance**
5. **Revisión de seguridad**

### Documentación de Cambios
- Changelog detallado
- Versionado semántico
- Notas de migración
- Breaking changes

---

*Documentación actualizada: Diciembre 2024*
*Versión del sistema: 1.0.0*
 
## Escritorio (Tauri)

### Decisión Arquitectónica
- Electron ha sido removido del monorepo. El empaquetado oficial de escritorio se realiza con **Tauri v1** sobre Windows (instalador NSIS).
- Razones: menor huella de memoria, mejor integración nativa y pipeline simplificado con recursos del backend empaquetados.

### Prerrequisitos
- **Rust toolchain** (x86_64-pc-windows-msvc) y `cargo` disponibles.
- **CLI de Tauri v1** instalada: `cargo install tauri-cli --version ^1.5`.
- Artefactos previos:
  - `frontend/dist` generado por `npm run build` en `frontend`.
  - `backend/dist/server.exe` generado por `npm run build` en `backend`.

### Configuración
- Archivo: `src-tauri/tauri.conf.json`
  - `build.distDir`: `../frontend/dist`
  - `tauri.bundle.targets`: `["nsis"]`
  - `tauri.bundle.resources` incluye:
    - `../frontend/dist`
    - `../backend/dist/server.exe`
    - `../backend/src`
    - `../backend/node_modules`
    - `../backend/.env`
    - `../data/pos_system.db`

### Pipeline de Build
1. Construir artefactos:
   - `npm run build:backend` → genera `backend/dist/server.exe` y `backend/dist`.
   - `npm run build:frontend` → genera `frontend/dist`.
2. Generar instalador:
   - En `pos-system`: `npm run tauri:build`.

### Artefactos Generados
- Instalador NSIS:
  - `src-tauri/target/release/bundle/nsis/Jewelry POS System_1.0.0_x64-setup.exe`

### Flujo de Ejecución en Runtime
- La app Tauri sirve la UI desde `frontend/dist` y arranca el backend `backend/dist/server.exe`.
- `.env` del backend y `data/pos_system.db` viajan como recursos.
- Comunicación UI ⇄ API en `http://127.0.0.1:<PORT>/api`.

### Migración desde Electron
- Carpeta `desktop/` y scripts de Electron eliminados.
- `pos-system/package.json` sin `pack:win` y `keywords` actualizados a `tauri`.
- Uso estándar: `npm run tauri:dev` y `npm run tauri:build`.

### Diagrama de Flujo
```
[UI (Tauri/WebView)] → http://127.0.0.1:<PORT>/api
         │
         └─> [Backend server.exe] ↔ [SQLite: data/pos_system.db]
```
- Arranque: Tauri lanza `server.exe` en segundo plano.
- UI consume API REST locales para operaciones POS.

### Distribución y Actualizaciones
- Versión: usar SemVer y actualizar `tauri.conf.json` y `package.json`.
- Build: `npm run tauri:build` genera instalador NSIS (`*.exe`).
- Firma (opcional): configurar certificado en `tauri.bundle.windows` si aplica.
- Entrega: publicar `Jewelry POS System_..._setup.exe` en el canal elegido.
- Actualizaciones: considerar `tauri-plugin-updater` para in-app updates; si no, instalar manualmente sobre la versión previa.
- Registro de cambios: mantener `CHANGELOG.md` con impacto en frontend/backend.

### Troubleshooting
- Errores de esquema con `tauri.conf.json`: usa **CLI v1**.
- Backend no encontrado: verifica `backend/dist/server.exe` antes de empaquetar.
- Iconos: asegúrate de que existan en `src-tauri/icons`.
## Contratos Zod en Frontend

- Validación de respuestas y modelos:
  - `src/schemas/api.ts`: funciones `apiResponseSchema` y `paginatedResponseSchema` para envolver y validar respuestas `{ success, data }` y paginadas.
  - `src/schemas/product.ts`: `productRawSchema` valida el producto proveniente del backend tolerando variaciones (string/obj para `category`, coerción numérica en precios/stock, campos opcionales).
- Normalización con validación:
  - `src/lib/api.ts`: `normalizeListPayloadWithSchema(raw, schema)` y `normalizeSinglePayloadWithSchema(raw, schema)` retornan solo ítems válidos; los inválidos se descartan con log controlado.
  - Integración en `ProductsPage.tsx` y `store/productsStore.ts`: se valida la lista de productos antes de mapear y persistir.
- Manejo de errores:
  - Los ítems que no cumplen el contrato se omiten silenciosamente para evitar bloquear la UI; se registra `console.warn` para diagnóstico.
  - Se mantiene la estructura global `ApiResponse` vía interceptores (`src/lib/api.ts`), evitando cascar la UI por respuestas no envueltas.
### Modo de prueba (testMode)

- Propósito: Permite renderizar páginas sin carga inicial ni efectos secundarios para facilitar pruebas de integración y validaciones visuales.
- Activación:
  - Por prop: Renderiza el componente con `testMode` activado, por ejemplo: `<CodesPage testMode />`.
  - Por URL: Desde `App.tsx`, el flag se propaga leyendo `?testMode=1` o `?tm=1` de la query string y se pasa a las páginas que lo soportan.
- Páginas soportadas actualmente: `BackupPage`, `SettingsPage`, `UsersPage`, `CashRegisterPage`, `CodesPage`, `RankingsPage`, `SalesPage`, `ReportsPage`, `ProductsPage`, `ClientsPage` y `DashboardPage`.
- Patrón de implementación por página:
  - Inicializar estados de carga a `false` cuando `testMode` sea `true`.
  - Poner guardas en `useEffect` que hagan I/O o side effects: `if (testMode) return;`.
  - Evitar timers, suscripciones o auto-refresh en `testMode`.
  - Asegurar que elementos clave del UI rendericen sin depender de datos remotos.
- Consideraciones:
- En desarrollo (`import.meta.env.DEV`), se puede mantener lógica de demo/siembra condicionada por entorno y deshabilitada en `testMode`.

#### Helpers de pruebas
- `renderAt(hash)`: navega a una ruta específica ajustando `window.location.hash` y renderiza `App`.
- `setTestRole(role)`: fija el rol del usuario (`admin`, `manager`, `employee`, `cashier`) para pruebas de rutas protegidas.
- `assertRedirect(to)`: espera que la URL cambie hacia `to`.
- `assertNoSpinner(text)`: asegura que el texto de carga `text` no esté presente cuando `testMode=1`.
- `assertSpinner(text?)`: si se pasa `text`, espera el texto de carga; si no, espera un `data-testid="loading-spinner"`.

Ejemplos:
- Positivo: `#/reports?testMode=1` → encabezado visible y `assertNoSpinner('Cargando reportes avanzados...')`.
- Negativo: `#/codes?tm=true` → `assertSpinner('Cargando productos...')`.
- Negativo genérico: `#/settings?testMode=true` → `assertSpinner()` (usa `data-testid`).
 - Rankings (page-level): en testMode, valida encabezado y ausencia de spinner; en modo normal, mockea `useRankingStore` con `loading: true` y usa `assertSpinner()`.
 
 Nota sobre Dashboard:
 - `DashboardPage` utiliza skeletons de carga en lugar de `LoadingSpinner`.
 - En pruebas positivas (`testMode=1`), valida elementos de UI estables (por ejemplo, botón `Reset`, checkbox `Con referencia`) y verifica que no exista `data-testid="loading-spinner"`.
 - En pruebas negativas (sin `testMode`), prioriza verificar la ausencia de UI estable o la presencia de skeletons si hay selectores confiables; `assertSpinner` no aplica directamente.
  - Las pruebas de integración usan `MemoryRouter` y mockean stores/servicios para evitar redes.
## Estado del Sistema (Fase 0)

- Healthcheck backend: `GET /api/health` devuelve `success`, `message`, `timestamp`, `version`, `uptimeSec`, `db{healthy, latency}` y `config{ok, errors, warnings}`. Incluye header `X-Health-Source`.
- Watchdog de salud: proceso Node que consulta `/api/health` cada 60s y escribe capturas JSON con `status`, `headers` y payload en `pos-system/captures/`.
- Heartbeat: proceso que registra eventos de arranque/verificación en `pos-system/logs/`.
- Frontend: indicador `HealthStatus` integrado en Topbar, muestra estado, versión, DB/config y latencia.
- Proxy Vite: `/api` hacia `http://localhost:5656` para evitar CORS en desarrollo.

Evidencias reproducibles:
- Backend en escucha: `0.0.0.0:5656` (logs de arranque).
- Capturas de salud: archivos `health-<timestamp>.json` con `x-health-source: app` y métricas.
- Preview frontend activo: `http://localhost:5175/`, indicador visible en Topbar.

## Fase 1: Auditoría y validación de cambios de precio en Productos

- Objetivo: Registrar y validar cambios de `salePrice` y `purchasePrice` al editar un producto, capturando razón y moneda, y generar trazas de auditoría consistentes.
- Alcance: Frontend `ProductsPage.tsx` y backend rutas/servicios de producto.

Frontend
- Campos UI agregados: `priceUpdateReason` (texto) y `priceUpdateCurrency` (texto/código ISO).
- Inicialización: `priceUpdateCurrency` se precarga desde `PublicSettings.currency` y se preserva en `resetForm` y `openProductModal`; `priceUpdateReason` se resetea en cada edición.
- Validación: Si se detecta cambio en `salePrice` o `purchasePrice` respecto al producto original, `priceUpdateReason` es requerido (no vacío). Se bloquea el envío si falta.
- Payload de edición: Se envían directamente las claves `priceUpdateReason` y `priceUpdateCurrency` junto con el producto y, adicionalmente, se adjunta un bloque `priceUpdateAudit` con `old/new` de precios, `reason` y `currency` para depuración y trazabilidad.

Backend
- Ruta PUT `PUT /products/:id`: protegida para manager/admin, valida el cuerpo con `updateProductSchema` (Zod), que exige `priceUpdateReason` cuando cambian precios.
- Servicio `ProductService.updateProduct`: detecta cambios de precio, obtiene `currency` desde `data.priceUpdateCurrency` o `SettingsService` si falta, y registra auditoría con `AuditTrailService.log` incluyendo `reason`, `currency`, diferencias y `actor/correlationId`.
- Importación masiva: `ProductController.bulkImportProducts` también audita cambios de precio (`operation: price.update.bulk`).

Flujo E2E
- Editar un producto sin cambiar precios: no se requiere razón; no se registra auditoría de precio.
- Editar un producto cambiando `salePrice` y/o `purchasePrice`: UI requiere `priceUpdateReason`; el backend valida el campo y registra auditoría con detalles.

Consideraciones
- Compatibilidad: El backend ignora claves desconocidas del payload y usa `priceUpdateReason`/`priceUpdateCurrency` a nivel raíz para auditoría. El bloque `priceUpdateAudit` es útil para inspección/depuración y puede omitirse si se decide simplificar.
- Moneda: Si el frontend no envía `priceUpdateCurrency`, el backend usa configuración (`SettingsService.getSettings().currency`) con fallback a `USD`.

Pruebas rápidas
- Caso 1: Cambiar precio con `priceUpdateReason` vacío. Esperado: UI bloquea envío con mensaje; backend ni recibe solicitud.
- Caso 2: Cambiar precio con razón válida. Esperado: PUT exitoso; backend registra auditoría con `operation: price.update.manual` y detalles de cambios.
- Caso 3: Sin cambios de precio. Esperado: PUT exitoso sin requerir razón; no hay auditoría de precio.

Estado
- Implementado y alineado en frontend y backend: validación de motivo, preservación de moneda, detección de cambios de precio y registro de auditoría. Vista previa disponible para validación manual.
