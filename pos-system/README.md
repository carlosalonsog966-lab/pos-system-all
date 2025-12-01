# Sistema POS - Point of Sale

<div align="center">

![Sistema POS](https://img.shields.io/badge/Sistema-POS-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)

**Sistema de Punto de Venta moderno, rápido y confiable**

[Características](#características) • [Instalación](#instalación) • [Uso](#uso) • [Documentación](#documentación) • [Contribuir](#contribuir)

</div>

---

## ✅ Estado CI

> Health Smoke: valida salud del backend y alineación CORS.

![Health Smoke CI](https://github.com/carlosalonsog966-lab/pos-system/actions/workflows/health-smoke.yml/badge.svg)

Notas:
- Sustituye `OWNER/REPO` por tu organización y repo reales para que el badge funcione.
- El workflow corre en `push`, `pull_request`, `schedule` diario y manual (`workflow_dispatch`).
- Artefactos: `health-smoke-captures` con JSON/logs del smoke.

> Verify Alerts: verifica integridad de archivos y publica artefactos.

![Verify Alerts CI](https://github.com/carlosalonsog966-lab/pos-system/actions/workflows/verify-alerts.yml/badge.svg)

Notas:
- Artefactos: `verify-alerts-artifacts` con CSV, JSON (summary/alert), PDF y logs.
- Ajusta `POS_BASE_URL`/puerto si tu backend corre diferente.

## 🚀 Características

### ✨ Funcionalidades Principales
- **💰 Ventas Rápidas**: Proceso de venta optimizado con escáner de códigos de barras
- **📦 Gestión de Inventario**: Control completo de productos y stock
- **👥 Gestión de Clientes**: Base de datos integrada con historial de compras
- **📊 Reportes Avanzados**: Análisis detallado de ventas y rendimiento
- **🔄 Sincronización Offline/Online**: Funciona sin internet y sincroniza automáticamente
- **🎨 Interfaz Moderna**: Diseño responsive y fácil de usar
- **🔐 Seguridad**: Autenticación JWT y roles de usuario

### 🛠️ Tecnologías

#### Frontend
- **React 18** con TypeScript
- **Vite** para desarrollo ultra-rápido
- **Tailwind CSS** para estilos
- **Zustand** para gestión de estado
- **React Router** para navegación

#### Backend
- **Node.js** con Express
- **TypeScript** para tipado estático
- **Prisma** ORM para base de datos
- **PostgreSQL** como base de datos
- **JWT** para autenticación

#### Características Técnicas
- **Offline-First**: Funciona completamente sin internet
- **PWA Ready**: Instalable como aplicación nativa
- **Performance Optimized**: Lazy loading, virtualización, caché avanzado
- **Real-time Sync**: Sincronización automática de datos
- **Responsive Design**: Funciona en desktop, tablet y móvil

---

## 📋 Requisitos del Sistema

### Mínimos
- **Node.js**: 16.x o superior
- **npm**: 8.x o superior
- **PostgreSQL**: 12.x o superior
- **Navegador**: Chrome 90+, Firefox 88+, Safari 14+

### Recomendados
- **Node.js**: 18.x LTS
- **RAM**: 4GB mínimo, 8GB recomendado
- **Almacenamiento**: 2GB libres
- **Conexión**: Banda ancha para sincronización

---

## 🚀 Instalación

### 1. Clonar el Repositorio
```bash
git clone https://github.com/tu-usuario/pos-system.git
cd pos-system
```

### 2. Configurar Base de Datos
```bash
# Crear base de datos PostgreSQL
createdb pos_system

# Configurar variables de entorno
cp .env.example .env
```

### 3. Configurar Variables de Entorno

#### Backend (.env)
```env
# Base de datos
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/pos_system"

# JWT
JWT_SECRET="tu-clave-secreta-muy-segura"
JWT_EXPIRES_IN="7d"

# Servidor
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN="http://localhost:3000"
```

#### Frontend (.env)
```env
# API
VITE_API_URL=http://localhost:3001/api

# Aplicación
VITE_APP_NAME="Sistema POS"
VITE_APP_VERSION="1.0.0"

# Características
VITE_ENABLE_OFFLINE=true
VITE_ENABLE_PWA=true
```

### 4. Instalar Dependencias

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

### 5. Configurar Base de Datos
```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

### 6. Iniciar el Sistema

#### Desarrollo (Ambos servicios)
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

#### Usando Docker (Recomendado)
```bash
docker-compose up -d
```

### 7. Empaquetado de Escritorio (Tauri)

Para generar el instalador de la aplicación de escritorio con Tauri (Windows NSIS):

```bash
# En la raíz del monorepo
npm run build            # construye backend y frontend
npm run tauri:build      # genera el instalador Tauri
```

El instalador se genera en:

- `src-tauri/target/release/bundle/nsis/Jewelry POS System_1.0.0_x64-setup.exe`

Notas:
- Electron ha sido removido; el empaquetado oficial es Tauri.
- Asegúrate de que `backend/dist/server.exe` exista antes de empaquetar.
- El instalador incluye `frontend/dist`, el ejecutable del backend y recursos definidos en `src-tauri/tauri.conf.json`.

---

## 🎯 Uso Rápido

### 1. Acceder al Sistema
- Abre tu navegador en `http://localhost:3000`
- Usa las credenciales por defecto:
  - **Email**: `admin@pos.com`
  - **Contraseña**: `admin123`

### 2. Configuración Inicial
1. **Cambiar contraseña** del administrador
2. **Configurar información** de la empresa
3. **Agregar productos** al inventario
4. **Crear usuarios** adicionales si es necesario

### 3. Primera Venta
1. Haz clic en **"Nueva Venta"**
2. **Agrega productos** escaneando códigos o buscando
3. **Selecciona cliente** (opcional)
4. **Procesa el pago** y genera el recibo

---

## 📚 Documentación

### 📖 Guías Disponibles
- **[Guía de Usuario](USER_GUIDE.md)**: Manual completo para usuarios finales
- **[Documentación Técnica](TECHNICAL_DOCUMENTATION.md)**: Arquitectura y desarrollo
- **[API Reference](docs/API.md)**: Documentación de endpoints
- **[Deployment Guide](docs/DEPLOYMENT.md)**: Guía de despliegue
- **[Health Smoke (CI)](docs/HEALTH-SMOKE-CI.md)**: Cómo funciona el workflow de CI
- **[Health Smoke (Scheduler)](docs/HEALTH-SMOKE-SCHEDULER.md)**: Tarea programada en Windows

### 🔎 Observabilidad y Umbrales

Para habilitar señales claras y configurables en la UI, el frontend usa variables `VITE_*` que definen umbrales de “warning” y “critical”. Ajusta por ambiente en `frontend/.env.development` y `frontend/.env.production`.

- `VITE_API_URL`: Base de la API (ej. `http://localhost:5656/api`).
- `VITE_USE_MOCKS`: Debe estar en `false` para trabajar con datos reales.
- Inventario:
  - `VITE_LEDGER_WARN_COUNT`, `VITE_LEDGER_CRIT_COUNT`: conteos de movimientos.
  - `VITE_IDEMPOTENCY_WARN_COUNT`, `VITE_IDEMPOTENCY_CRIT_COUNT`: eventos de idempotencia.
- Ventas:
  - `VITE_SALES_WARN_COUNT`, `VITE_SALES_CRIT_COUNT`: conteo de ventas.
  - `VITE_SALEITEMS_WARN_COUNT`, `VITE_SALEITEMS_CRIT_COUNT`: conteo de items vendidos.
- Jobs:
  - `VITE_JOBS_PENDING_WARN_COUNT`, `VITE_JOBS_PENDING_CRIT_COUNT`: trabajos pendientes.
  - `VITE_JOBS_FAILED_WARN_COUNT`, `VITE_JOBS_FAILED_CRIT_COUNT`: trabajos fallidos.
  - `VITE_JOBS_QUEUEAGE_WARN_MS`, `VITE_JOBS_QUEUEAGE_CRIT_MS`: edad de cola p95 (ms).
  - `VITE_JOBS_PROCTIME_WARN_MS`, `VITE_JOBS_PROCTIME_CRIT_MS`: tiempo de proceso p95 (ms).

Valores recomendados (desarrollo):
```env
VITE_SALES_WARN_COUNT=10
VITE_SALES_CRIT_COUNT=50
VITE_SALEITEMS_WARN_COUNT=20
VITE_SALEITEMS_CRIT_COUNT=100
VITE_JOBS_PENDING_WARN_COUNT=5
VITE_JOBS_PENDING_CRIT_COUNT=20
VITE_JOBS_FAILED_WARN_COUNT=1
VITE_JOBS_FAILED_CRIT_COUNT=5
VITE_JOBS_QUEUEAGE_WARN_MS=60000
VITE_JOBS_QUEUEAGE_CRIT_MS=300000
VITE_JOBS_PROCTIME_WARN_MS=2000
VITE_JOBS_PROCTIME_CRIT_MS=10000
```

Ubicación en la UI:
- Observabilidad → Inventario: chips de movimientos e idempotencia.
- Observabilidad → Ventas: chips de ventas e items.
- Observabilidad → Jobs: chips de pendientes, fallidos, procesando y métricas p95.
- Sistema → Flags de entorno: validación y presencia de variables `VITE_*`.

Consejos de ajuste:
- Si ves demasiadas advertencias, incrementa valores de `WARN`/`CRIT`.
- Si se te escapan picos reales, reduce los umbrales.
- Reinicia el dev server tras cambios de `.env`.

### 🎓 Tutoriales
- [Configuración Inicial](docs/tutorials/setup.md)
- [Gestión de Productos](docs/tutorials/products.md)
- [Proceso de Ventas](docs/tutorials/sales.md)
- [Reportes y Análisis](docs/tutorials/reports.md)

---

## 🛠️ Desarrollo

### Estructura del Proyecto
```
pos-system/
├── frontend/                 # Aplicación React
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # Utilidades y librerías
│   │   ├── pages/           # Páginas principales
│   │   ├── store/           # Gestión de estado
│   │   └── types/           # Tipos TypeScript
│   └── public/              # Archivos estáticos
├── backend/                 # API Node.js
│   ├── src/
│   │   ├── controllers/     # Controladores
│   │   ├── middleware/      # Middleware
│   │   ├── models/          # Modelos de datos
│   │   ├── routes/          # Rutas de API
│   │   └── services/        # Lógica de negocio
│   └── prisma/              # Esquemas de BD
├── docs/                    # Documentación
└── docker-compose.yml       # Configuración Docker
```

### Scripts Disponibles

#### Frontend
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Preview del build
npm run test         # Ejecutar tests
npm run lint         # Linting
npm run type-check   # Verificación de tipos
```

#### Health & Smoke (CORS)
```bash
npm run health:e2e           # Verificaciones básicas de salud
npm run health:e2e:refund    # Incluye smoke de reembolso
npm run smoke:health         # Wrapper Node (multiplataforma)
npm run smoke:health:once    # Ejecuta una sola vez
```

### Alineación CORS/URL (Fase 0)

- Objetivo: el origen esperado (`EXPECTED_ORIGIN`) debe coincidir con el `FRONTEND_URL` que reporta el backend (`/api/meta/config?fields=cors`).
- Wrapper: `pos-system/launcher/run-health-smoke.js` lee `EXPECTED_ORIGIN` de variables de entorno, o de `backend/.env` (`FRONTEND_URL`), con fallback a `http://localhost:5175`. Por defecto activa `STRICT_CORS_CHECK=1`.
- Uso:
  - Desarrollo (Vite dev): `EXPECTED_ORIGIN=http://localhost:5175 npm run smoke:health:once --prefix pos-system`
  - Preview: si tu preview corre en `5176`, usa `--expected http://localhost:5176`.
  - Entornos que usan `4173` (default de Vite preview): `EXPECTED_ORIGIN=http://localhost:4173 npm run smoke:health:once --prefix pos-system`
- Ejemplos:
  - `npm run smoke:health:once --prefix pos-system`
  - `npm run smoke:health:once --prefix pos-system --expected=http://localhost:5176`
  - `EXPECTED_ORIGIN=http://localhost:4173 npm run smoke:health:once --prefix pos-system`

Nota: si cambias `FRONTEND_URL` en `backend/.env`, reinicia el backend para que aplique el nuevo origen público.

### Prefetching de librerías pesadas

- Objetivo: mejorar la percepción de rendimiento precargando librerías grandes justo antes de que el usuario las necesite.
- Patrón recomendado (React): usar handlers de interacción suaves como `onMouseEnter`, `onMouseOver`, `onPointerEnter` y `onFocus` para disparar `import()` de los módulos.
- Ejemplo en `ProductsPage`:
  - Botón "Escanear": prefetch de `@zxing/library` en hover/focus y también al abrir el modal del escáner.
  - Botón "Importar": prefetch de `papaparse` y `xlsx` en hover/focus y antes de abrir el selector de archivos.
- Implementación sugerida:
  - Crear helpers de prefetch reutilizables: `prefetchScannerLib()` y `prefetchImportLibs()`.
  - En `onClick`, ejecutar el prefetch y luego continuar con la acción principal (`setShowScanner(true)` o `fileInputRef.current?.click()`).
  - Añadir un `useEffect` que dispare el prefetch al abrir el modal del escáner (`showScanner === true`).
- Validación: construir con `npm run build:fast`, iniciar `vite preview` y navegar a `/products` y `/codes` verificando que los chunks (`zxing`, `xlsx`, `pdf`) se sirven en el preview.

#### Backend
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Compilar TypeScript
npm run start        # Servidor de producción
npm run test         # Ejecutar tests
npm run db:migrate   # Migrar base de datos
npm run db:seed      # Poblar base de datos
```

### Comandos Útiles

#### Base de Datos
```bash
# Resetear base de datos
npx prisma migrate reset

# Ver base de datos
npx prisma studio

# Generar cliente Prisma
npx prisma generate
```

#### Docker
```bash
# Construir imágenes
docker-compose build

# Ver logs
docker-compose logs -f

# Parar servicios
docker-compose down
```

---

## 🧪 Testing

### Ejecutar Tests
```bash
# Frontend
cd frontend
npm run test

# Backend
cd backend
npm run test

# E2E Tests
npm run test:e2e
```

### Cobertura de Código
```bash
npm run test:coverage
```

### Tests de Performance
```bash
npm run test:performance
```

---

## 📦 Deployment

### Producción con Docker
```bash
# Construir para producción
docker-compose -f docker-compose.prod.yml up -d

# Con variables de entorno
docker-compose --env-file .env.prod up -d
```

### Deploy Manual

#### Frontend
```bash
cd frontend
npm run build
# Subir carpeta dist/ a tu servidor web
```

#### Backend
```bash
cd backend
npm run build
npm start
```

### Variables de Entorno de Producción
```env
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@prod-db:5432/pos"
JWT_SECRET="clave-super-secreta-de-produccion"
CORS_ORIGIN="https://tu-dominio.com"
```

## 🖼️ Subidas de Archivos

- El backend sirve archivos estáticos desde `'/uploads'` usando una ruta base configurable.
- Configura `UPLOADS_BASE_PATH` en tu `.env` para definir el directorio físico donde se almacenan las subidas.
- Si no se define, en Windows se usa por defecto `C:\\ProgramData\\SistemaPOS\\DATOS\\IMAGENES`.
- Utilidades compartidas en `backend/src/utils/uploads.ts`:
  - `getUploadsBasePath()`: resuelve la ruta base desde el entorno o el valor por defecto.
  - `ensureUploadsSubdir(subdir)`: crea el subdirectorio si no existe y retorna su ruta absoluta.
  - `publicUploadsUrl(req, subdir, filename)`: construye la URL pública `http(s)://host/uploads/...`.
  - `resolveUploadsFileFromPublicUrl(url)`: mapea la URL pública al archivo físico en disco.

### Procesamiento de Imágenes
- Avatares y fotos de productos se procesan con `sharp` para optimizar tamaño y formato.
- Productos: redimensionado a `800x800`, conversión a `webp` calidad `85`, eliminación del original.
- Avatares: recorte centrado y redimensionado consistente; limpieza del avatar previo al actualizar.

---

## 🔧 Configuración Avanzada

### Personalización

#### Temas y Estilos
```typescript
// frontend/src/styles/theme.ts
export const customTheme = {
  colors: {
    primary: '#your-color',
    secondary: '#your-color',
    // ...
  }
};
```

#### Configuración de Empresa
```typescript
// Configurar en el panel de administración
const companyConfig = {
  name: 'Tu Empresa',
  logo: '/path/to/logo.png',
  address: 'Tu dirección',
  phone: '+1234567890',
  email: 'contacto@tuempresa.com'
};
```

### Integraciones

#### Impresoras Térmicas
```javascript
// Configurar impresora en Settings
const printerConfig = {
  type: 'thermal',
  width: 80, // mm
  interface: 'USB',
  model: 'EPSON TM-T20'
};
```

#### Códigos de Barras
```javascript
// Soporte para múltiples formatos
const barcodeFormats = [
  'CODE128',
  'EAN13',
  'UPC-A',
  'QR_CODE'
];
```

---

## 🤝 Contribuir

### Cómo Contribuir
1. **Fork** el repositorio
2. **Crea** una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. **Commit** tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. **Push** a la rama (`git push origin feature/nueva-funcionalidad`)
5. **Crea** un Pull Request

### Estándares de Código
- **ESLint**: Seguir las reglas configuradas
- **Prettier**: Formateo automático
- **TypeScript**: Tipado estricto
- **Tests**: Cobertura mínima del 80%

### Reportar Bugs
- Usa el [template de issues](https://github.com/tu-usuario/pos-system/issues/new?template=bug_report.md)
- Incluye pasos para reproducir
- Adjunta screenshots si es necesario

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🆘 Soporte

### Canales de Soporte
- **📧 Email**: soporte@sistemapos.com
- **💬 Discord**: [Servidor de la comunidad](https://discord.gg/sistemapos)
- **📚 Wiki**: [Documentación completa](https://github.com/tu-usuario/pos-system/wiki)
- **🐛 Issues**: [Reportar problemas](https://github.com/tu-usuario/pos-system/issues)

### FAQ
**P: ¿Funciona en móviles?**
R: Sí, es completamente responsive y funciona en todos los dispositivos.

**P: ¿Puedo personalizar los recibos?**
R: Sí, puedes personalizar completamente el formato de los recibos.

**P: ¿Soporta múltiples monedas?**
R: Actualmente soporta una moneda por instalación, pero está en desarrollo el soporte multi-moneda.

---

## 🎉 Agradecimientos

- **React Team** por el increíble framework
- **Vercel** por Vite y las herramientas de desarrollo
- **Prisma** por el excelente ORM
- **Tailwind CSS** por el framework de estilos
- **Comunidad Open Source** por las librerías utilizadas

---

## 📊 Estadísticas del Proyecto

![GitHub stars](https://img.shields.io/github/stars/tu-usuario/pos-system?style=social)
![GitHub forks](https://img.shields.io/github/forks/tu-usuario/pos-system?style=social)
![GitHub issues](https://img.shields.io/github/issues/tu-usuario/pos-system)
![GitHub pull requests](https://img.shields.io/github/issues-pr/tu-usuario/pos-system)

---

<div align="center">

**¿Te gusta el proyecto? ¡Dale una ⭐ en GitHub!**

[⬆ Volver arriba](#sistema-pos---point-of-sale)

</div>

---

## 🧪 Modo Demo de Códigos (Desarrollo)

- Propósito: validar la UI de `/codes` mostrando los botones "Descargar" e "Imprimir" sin generar primero.
- Activación por entorno: en `pos-system/frontend/.env.development` define `VITE_CODES_DEMO_SEED=1` para activarlo por defecto.
- Control en tiempo de ejecución: la página `/codes` muestra un banner con un toggle que guarda en `localStorage` la clave `codesDemoSeed` (`'1'` activo, `'0'` inactivo).
- Comportamiento:
  - Con el demo activo, se siembran dos códigos de ejemplo (QR y Barras) en `lastGeneratedCodes` y en el historial para habilitar los botones.
  - Al desactivar, se eliminan solo los códigos demo sin afectar los reales.
- Notas:
  - Disponible únicamente en `import.meta.env.DEV`.
  - Si cambias el valor en `.env.development`, reinicia el servidor de desarrollo.

## 🧭 Enrutado en Desarrollo y Deep Links

- Para facilitar enlaces directos y evitar 404 con `localhost`, el frontend usa `HashRouter` en desarrollo.
- La ruta `/codes` está desprotegida en desarrollo para validar UI sin iniciar sesión.
