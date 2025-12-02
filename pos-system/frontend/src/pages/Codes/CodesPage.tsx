import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  BarChart3,
  Download,
  Printer,
  Package,
  Plus,
  Trash2,
  Eye,
  Copy,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { useOfflineStore } from '@/store/offlineStore';
import SearchBar from '@/components/SearchBar';
import { api, backendStatus } from '@/lib/api';
import Modal from '@/components/Modal';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

import { useProductsStore } from '@/store/productsStore';
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  // Algunas API devuelven category como objeto (p.ej. { name: string })
  category?: any;
}

interface GeneratedCode {
  id: string;
  productId: string;
  productName: string;
  type: 'qr' | 'barcode';
  code: string;
  data: string;
  createdAt: Date;
}

type CodesPageProps = { testMode?: boolean };
const CodesPage: React.FC<CodesPageProps> = ({ testMode = false }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([]);
  const [lastGeneratedCodes, setLastGeneratedCodes] = useState<GeneratedCode[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  const [historyType, setHistoryType] = useState<'barcode' | 'qr'>('barcode');
  const [historySearch, setHistorySearch] = useState('');
  const [historyCategory, setHistoryCategory] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [historyOnlyExisting, setHistoryOnlyExisting] = useState<boolean>(false);
  const [historyExcludeMismatched, setHistoryExcludeMismatched] = useState<boolean>(false);
  const [codeType, setCodeType] = useState<'qr' | 'barcode'>('qr');
  const [customData, setCustomData] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewCode, setPreviewCode] = useState<GeneratedCode | null>(null);
  const [loading, setLoading] = useState(!testMode);
  const [mismatchedCodes, setMismatchedCodes] = useState<GeneratedCode[]>([]);
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');
  // Opciones de exportaciÃ³n de PDF/etiquetas
  const [exportFormat, setExportFormat] = useState<'a4' | 'label58' | 'label80'>('a4');
  const [labelShowName, setLabelShowName] = useState<boolean>(true);
  const [labelShowData, setLabelShowData] = useState<boolean>(true);
  const [labelShowDate, setLabelShowDate] = useState<boolean>(false);
  // Flag env (solo dev) y toggle de modo demo controlado por localStorage
  const envAllowsDemo = import.meta.env.DEV && String(import.meta.env.VITE_CODES_DEMO_SEED ?? '1') !== '0';
  const [demoSeedEnabled, setDemoSeedEnabled] = useState<boolean>(() => {
    const lsEnabled = String(localStorage.getItem('codesDemoSeed') ?? '1') !== '0';
    return envAllowsDemo && lsEnabled;
  });

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
const { products: storeProducts } = useProductsStore();

  // Monitorear salud del backend y deshabilitar exportaciones en modo degradado/caído
  useEffect(() => {
    const cb = (st: 'ok' | 'no_health' | 'down') => setBackendHealthMode(st);
    try {
      if (typeof (backendStatus as any)?.onStatus === 'function') {
        (backendStatus as any).onStatus(cb);
      }
      if (typeof (backendStatus as any)?.startPolling === 'function') {
        (backendStatus as any).startPolling(60000);
      }
    } catch {}
    return () => {
      try {
        if (typeof (backendStatus as any)?.offStatus === 'function') {
          (backendStatus as any).offStatus(cb);
        }
      } catch {}
    };
  }, []);

  
  
  // Notificaciones
  const { showSuccess, showError, showWarning } = useNotificationStore();
useEffect(() => {
    if (testMode) return;
    fetchProducts();
    loadGeneratedCodes();
  }, [testMode]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    if (searchTerm) {
      const filtered = products.filter((product) => {
        const nameText = String(product?.name || '').toLowerCase();
        const barcodeText = String(product?.barcode || '');
        // Normalizar category: si es string Ãºsalo; si es objeto intenta name/title
        let categoryText = '';
        const cat = product?.category;
        if (typeof cat === 'string') {
          categoryText = cat.toLowerCase();
        } else if (cat && typeof cat === 'object') {
          const name = (cat as any).name ?? (cat as any).title ?? '';
          categoryText = String(name).toLowerCase();
        }

        return (
          nameText.includes(term) ||
          barcodeText.includes(searchTerm) ||
          categoryText.includes(term)
        );
      });
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  // Detectar códigos guardados que no coinciden con el inventario actual
  useEffect(() => {
    if (loading) return;
    if (!products.length || !generatedCodes.length) {
      setMismatchedCodes([]);
      return;
    }

    const mismatches = generatedCodes.filter((gc) => {
      const prod = products.find((p) => p.id === gc.productId);
      if (!prod) return false;
      const expected = prod.barcode || prod.id;
      return expected && gc.data !== expected;
    });
    setMismatchedCodes(mismatches);
  }, [products, generatedCodes, loading]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { isOffline } = useOfflineStore.getState();
      if (isOffline) {
        const fallback = Array.isArray(storeProducts) ? storeProducts : [];
        setProducts(fallback);
        setFilteredProducts(fallback);
        showWarning('Sin conexión. Mostrando productos guardados localmente');
        return;
      }
      
      // Obtener productos del backend usando el cliente con cachÃ©
      const response = await api.get('/products', { __suppressGlobalError: true } as any);
      const productsData = Array.isArray(response.data)
        ? response.data
        : (response.data?.data || []);
      // Normalizar campos para evitar errores de render (p.ej. undefined)
      const normalized = (productsData || []).map((p: any) => ({
        ...p,
        price: typeof p?.price === 'number' ? p.price : Number(p?.price ?? 0),
        stock: typeof p?.stock === 'number' ? p.stock : Number(p?.stock ?? 0),
      }));
      const fallback = Array.isArray(storeProducts) ? storeProducts : [];
      if (normalized.length === 0 && fallback.length > 0) {
        setProducts(fallback);
        setFilteredProducts(fallback);
        showWarning('Servidor devolvió lista vacía. Usando productos del caché local');
      } else {
        setProducts(normalized);
        setFilteredProducts(normalized);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      // En caso de error, usar cachÃ© local si existe
      const fallback = Array.isArray(storeProducts) ? storeProducts : [];
      if (fallback.length > 0) {
        setProducts(fallback);
        setFilteredProducts(fallback);
        showWarning('Mostrando productos guardados localmente');
      } else {
        setProducts([]);
        setFilteredProducts([]);
        showError('No se pudieron cargar productos');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadGeneratedCodes = () => {
    const saved = localStorage.getItem('generatedCodes');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const rawArray = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.codes) ? parsed.codes : []);

      const codes = rawArray
        .filter(Boolean)
        .map((code: any) => ({
          ...code,
          createdAt: code?.createdAt ? new Date(code.createdAt) : new Date()
        }));

      setGeneratedCodes(codes);
    } catch (err) {
      console.error('Error parsing generatedCodes from localStorage:', err);
      // Si el contenido estÃ¡ corrupto, limpiamos la clave para evitar futuros errores
      localStorage.removeItem('generatedCodes');
      setGeneratedCodes([]);
    }
  };
  // Normalizar imágenes faltantes en historial cargado (asegurar DataURLs)
  useEffect(() => {
    const normalizeMissingImages = async () => {
      try {
        if (!generatedCodes.length) return;
        const needsUpdate = generatedCodes.some(
          (gc) => !gc.code || !String(gc.code).startsWith('data:')
        );
        if (!needsUpdate) return;

        const updated = await Promise.all(
          generatedCodes.map(async (gc) => {
            const hasImg = gc.code && String(gc.code).startsWith('data:');
            if (hasImg) return gc;
            const img = gc.type === 'qr'
              ? await generateQRCode(String(gc.data || ''))
              : generateBarcode(String(gc.data || ''));
            return { ...gc, code: img } as GeneratedCode;
          })
        );
        saveGeneratedCodes(updated);
      } catch (err) {
        console.warn('No se pudieron normalizar imágenes del historial:', err);
      }
    };

    normalizeMissingImages();
  }, [generatedCodes]);

  // Función para sembrar códigos demo (QR y Barras)
  const seedDemoCodes = () => {
    const now = new Date();
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+LmZsAAAAASUVORK5CYII=';
    const demoQR: GeneratedCode = {
      id: `${Date.now()}-qr-demo`,
      productId: 'demo',
      productName: 'Demo Producto',
      type: 'qr',
      code: pixel,
      data: 'DEMO-CODE-123',
      createdAt: now,
    };
    const demoBarcode: GeneratedCode = {
      id: `${Date.now()}-barcode-demo`,
      productId: 'demo',
      productName: 'Demo Producto',
      type: 'barcode',
      code: pixel,
      data: 'DEMO-CODE-123',
      createdAt: now,
    };
    setLastGeneratedCodes([demoQR, demoBarcode]);
    setGeneratedCodes((prev) => [demoQR, demoBarcode, ...prev]);
  };

  const disableDemoSeed = () => {
    localStorage.setItem('codesDemoSeed', '0');
    setDemoSeedEnabled(false);
    setLastGeneratedCodes(prev => prev.filter(c => !String(c.id).endsWith('-demo')));
    setGeneratedCodes(prev => prev.filter(c => c.productId !== 'demo'));
    showWarning('Seed demo desactivado');
  };

  const enableDemoSeed = () => {
    if (!envAllowsDemo) {
      showWarning('El seed demo está deshabilitado por configuración de entorno');
      return;
    }
    localStorage.setItem('codesDemoSeed', '1');
    setDemoSeedEnabled(true);
    seedDemoCodes();
    showSuccess('Seed demo activado');
  };

  // Siembra automática en desarrollo para mostrar acciones de descarga/impresión
  useEffect(() => {
    if (testMode) return;
    if (!envAllowsDemo) return;
    if (demoSeedEnabled && lastGeneratedCodes.length === 0) {
      seedDemoCodes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoSeedEnabled, lastGeneratedCodes.length, testMode]);

  // Helper de filtros compartidos para historial
  const passesHistoryFilters = (gc: GeneratedCode) => {
    const prod = products.find(p => p.id === gc.productId);
    const expected = prod ? (prod.barcode || prod.id) : undefined;
    const isMismatch = prod ? (gc.data !== expected) : false;

    // Filtros de inventario/congruencia
    if (historyOnlyExisting && !prod) return false;
    if (historyExcludeMismatched && isMismatch) return false;

    // Filtro por bÃºsqueda (nombre producto o datos)
    const term = historySearch.toLowerCase();
    const nameMatch = String(gc.productName || '').toLowerCase().includes(term);
    const dataMatch = String(gc.data || '').toLowerCase().includes(term);
    if (term && !(nameMatch || dataMatch)) return false;

    // Filtro por categorÃ­a: buscar el producto asociado y comparar
    if (historyCategory) {
      const prod = products.find(p => p.id === gc.productId);
      let catName = '';
      const cat = prod?.category;
      if (typeof cat === 'string') {
        catName = cat.toLowerCase();
      } else if (cat && typeof cat === 'object') {
        const name = (cat as any).name ?? (cat as any).title ?? '';
        catName = String(name).toLowerCase();
      }
      if (!catName.includes(historyCategory.toLowerCase())) return false;
    }

    // Filtro por rango de fechas
    const created = gc.createdAt instanceof Date ? gc.createdAt : new Date(gc.createdAt);
    if (historyStartDate) {
      const start = new Date(historyStartDate);
      if (created < start) return false;
    }
    if (historyEndDate) {
      const end = new Date(historyEndDate);
      // incluir el mismo dÃ­a hasta 23:59
      end.setHours(23, 59, 59, 999);
      if (created > end) return false;
    }
    return true;
  };

  // Listas separadas por tipo
  const filteredHistoryQR = generatedCodes.filter(gc => gc.type === 'qr' && passesHistoryFilters(gc));
  const filteredHistoryBarcode = generatedCodes.filter(gc => gc.type === 'barcode' && passesHistoryFilters(gc));

  const saveGeneratedCodes = (codes: GeneratedCode[]) => {
    localStorage.setItem('generatedCodes', JSON.stringify(codes));
    setGeneratedCodes(codes);
  };

    const generateQRCode = async (data: string): Promise<string> => {
    try {
      // Importar dinámicamente la librería de QR para evitar cargarla globalmente
      const QRCodeLib = (await import('qrcode')).default;
      // Generar directamente el DataURL del QR sin depender de un canvas oculto
      const qrDataURL = await QRCodeLib.toDataURL(data, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return qrDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  };

    const generateBarcode = async (data: string): Promise<string> => {
    try {
      const JsBarcodeLib = (await import('jsbarcode')).default as any;
      // Usar un canvas temporal para generar el código de barras
      const canvas = document.createElement('canvas');
      JsBarcodeLib(canvas, data, {
        format: 'CODE128',
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 14,
        textMargin: 5
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating barcode:', error);
      throw error;
    }
  };

  const handleGenerateCode = async () => {
    if (!selectedProduct && !customData) {
      showError('Selecciona un producto o ingresa datos personalizados');
      return;
    }

    // Create backup of current state before generation
    const generationBackup = {
      selectedProduct,
      customData,
      codeType,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('codes_generation_backup', JSON.stringify(generationBackup));

    try {
      const data = customData || selectedProduct?.barcode || selectedProduct?.id || '';
      const productName = selectedProduct?.name || 'Código personalizado';
      
      let codeDataURL: string;
      
      // Show progress indicator
      const progressToast = showWarning('Generando código...');
      
      if (codeType === 'qr') {
        codeDataURL = await generateQRCode(data);
      } else {
        codeDataURL = await generateBarcode(data);
      }

      const newCode: GeneratedCode = {
        id: Date.now().toString(),
        productId: selectedProduct?.id || 'custom',
        productName,
        type: codeType,
        code: codeDataURL,
        data,
        createdAt: new Date()
      };

      const updatedCodes = [newCode, ...generatedCodes];
      saveGeneratedCodes(updatedCodes);
      setLastGeneratedCodes([newCode]);
      
      // Clear backup on success
      localStorage.removeItem('codes_generation_backup');
      
      const typeLabel = codeType === 'qr' ? 'QR' : 'de barras';
      showSuccess('Código ' + typeLabel + ' generado exitosamente');
      
      // Limpiar formulario
      setSelectedProduct(null);
      setCustomData('');
      clearFormState(); // Limpiar estado persistente
    } catch (error) {
      console.error('Error generating code:', error);
      
      // Offer recovery option
      const shouldRecover = window.confirm(
        'Error al generar el código. ¿Desea restaurar los datos del formulario o intentar nuevamente?\n\n' +
        'Presione OK para restaurar o Cancelar para mantener los cambios actuales.'
      );
      
      if (shouldRecover && generationBackup) {
        setSelectedProduct(generationBackup.selectedProduct);
        setCustomData(generationBackup.customData);
        setCodeType(generationBackup.codeType);
        showWarning('Datos del formulario restaurados');
      }
      
      showError('Error al generar el código. Por favor, intente nuevamente.');
    }
  };

  const HistoryFilters: React.FC = () => (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1 rounded ${historyType === 'barcode' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          onClick={() => setHistoryType('barcode')}
          aria-label="Historial de barras"
        >Barras</button>
        <button
          className={`px-3 py-1 rounded ${historyType === 'qr' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          onClick={() => setHistoryType('qr')}
          aria-label="Historial de QR"
        >QR</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          className="border rounded px-2 py-1 w-52"
          placeholder="Buscar por nombre o dato"
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
        />
        <select
          className="border rounded px-2 py-1"
          value={historyCategory}
          onChange={(e) => setHistoryCategory(e.target.value)}
        >
          <option value="">Todas las categorÃ­as</option>
          {[...new Set(products.map(p => {
            const cat = p.category;
            if (typeof cat === 'string') return cat;
            if (cat && typeof cat === 'object') return (cat as any).name ?? (cat as any).title ?? '';
            return '';
          }).filter(Boolean))].map((name) => (
            <option key={String(name)} value={String(name)}>{String(name)}</option>
          ))}
        </select>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={historyStartDate}
          onChange={(e) => setHistoryStartDate(e.target.value)}
        />
        <span className="text-gray-600">a</span>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={historyEndDate}
          onChange={(e) => setHistoryEndDate(e.target.value)}
        />
        <label className="flex items-center gap-1 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={historyOnlyExisting}
            onChange={(e) => setHistoryOnlyExisting(e.target.checked)}
          />
          Solo inventario
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={historyExcludeMismatched}
            onChange={(e) => setHistoryExcludeMismatched(e.target.checked)}
          />
          Excluir desincronizados ({mismatchedCodes.length})
        </label>
      </div>
    </div>
  );

  // Generar QR y Barras con el mismo dato en un solo paso
  const handleGenerateBothCodes = async () => {
    if (!selectedProduct && !customData) {
      showError('Selecciona un producto o ingresa datos personalizados');
      return;
    }

    // Create backup of current state before generation
    const generationBackup = {
      selectedProduct,
      customData,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('codes_generation_backup', JSON.stringify(generationBackup));

    try {
      const data = customData || selectedProduct?.barcode || selectedProduct?.id || '';
      const productName = selectedProduct?.name || 'Código personalizado';

      // Show progress indicator
      showWarning('Generando códigos QR y de barras...');

      const [qrDataURL, barcodeDataURL] = await Promise.all([
        generateQRCode(data),
        Promise.resolve(generateBarcode(data)),
      ]);

      const now = Date.now();
      const qrCode: GeneratedCode = {
        id: `${now}-qr`,
        productId: selectedProduct?.id || 'custom',
        productName,
        type: 'qr',
        code: qrDataURL,
        data,
        createdAt: new Date()
      };

      const barCode: GeneratedCode = {
        id: `${now}-barcode`,
        productId: selectedProduct?.id || 'custom',
        productName,
        type: 'barcode',
        code: barcodeDataURL,
        data,
        createdAt: new Date()
      };

      const updatedCodes = [qrCode, barCode, ...generatedCodes];
      saveGeneratedCodes(updatedCodes);
      setLastGeneratedCodes([qrCode, barCode]);
      showSuccess('QR y Código de barras generados exitosamente');

      // Limpiar formulario solo si la generación fue exitosa
      setSelectedProduct(null);
      setCustomData('');
      
      // Limpiar backup después de éxito y estado persistente
      clearFormState();
    } catch (error) {
      console.error('Error al generar ambos códigos:', error);
      
      // Ofrecer recuperación al usuario
      if (window.confirm('Error al generar los códigos. ¿Deseas recuperar el formulario con los datos anteriores?')) {
        const backupData = localStorage.getItem('codes_generation_backup');
        if (backupData) {
          try {
            const backup = JSON.parse(backupData);
            if (backup.selectedProduct) {
              setSelectedProduct(backup.selectedProduct);
            }
            if (backup.customData) {
              setCustomData(backup.customData);
            }
            showSuccess('Formulario recuperado con los datos anteriores');
          } catch (parseError) {
            console.error('Error al recuperar backup:', parseError);
            showError('No se pudieron recuperar los datos del formulario');
          }
        }
      }
      
      showError('Error al generar ambos códigos. Por favor, intenta nuevamente.');
    }
  };

  const handleDownloadLastGenerated = async () => {
    try {
      if (!lastGeneratedCodes.length) {
        showError('No hay códigos recién generados');
        return;
      }
      for (const code of lastGeneratedCodes) {
        await handleDownloadCode(code);
      }
    } catch (error) {
      showError('Error al descargar los códigos');
    }
  };

  const handlePrintLastGenerated = async () => {
    try {
      if (!lastGeneratedCodes.length) {
        showError('No hay códigos recién generados');
        return;
      }
      for (const code of lastGeneratedCodes) {
        await handlePrintCode(code);
      }
    } catch (error) {
      showError('Error al imprimir los códigos');
    }
  };

  // Regenerar códigos guardados para sincronizarlos con el inventario
  const regenerateMismatchedCodes = async () => {
    try {
      const updated = await Promise.all(
        generatedCodes.map(async (gc) => {
          const prod = products.find((p) => p.id === gc.productId);
          const expected = prod ? (prod.barcode || prod.id) : undefined;
          if (prod && expected && gc.data !== expected) {
            const newImage = gc.type === 'qr' ? await generateQRCode(expected) : generateBarcode(expected);
            return {
              ...gc,
              data: expected,
              code: newImage,
              createdAt: new Date(),
            } as GeneratedCode;
          }
          return gc;
        })
      );

      saveGeneratedCodes(updated);
      setMismatchedCodes([]);
      showSuccess('códigos sincronizados con el inventario');
    } catch (err) {
      console.error('Error regenerando códigos:', err);
      showError('No se pudieron regenerar los códigos');
    }
  };

  const handlePreviewCode = (code: GeneratedCode) => {
    setPreviewCode(code);
    setShowPreview(true);
  };

  // Funciones de persistencia de estado para Tauri
  const saveFormState = () => {
    const formState = {
      selectedProduct,
      customData,
      codeType,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('codes_form_state', JSON.stringify(formState));
  };

  const loadFormState = () => {
    try {
      const savedState = localStorage.getItem('codes_form_state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.selectedProduct) {
          setSelectedProduct(parsed.selectedProduct);
        }
        if (parsed.customData) {
          setCustomData(parsed.customData);
        }
        if (parsed.codeType) {
          setCodeType(parsed.codeType);
        }
      }
    } catch (error) {
      console.error('Error al cargar estado del formulario:', error);
    }
  };

  const clearFormState = () => {
    localStorage.removeItem('codes_form_state');
    localStorage.removeItem('codes_generation_backup');
  };

  // Auto-guardado del formulario cada 30 segundos
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (selectedProduct || customData) {
        saveFormState();
      }
    }, 30000); // Guardar cada 30 segundos

    return () => clearInterval(autoSaveInterval);
  }, [selectedProduct, customData, codeType]);

  // Cargar estado al montar el componente
  useEffect(() => {
    loadFormState();
  }, []);

  // Limpiar estado al desmontar si no hay datos importantes
  useEffect(() => {
    return () => {
      if (!selectedProduct && !customData && !generatedCodes.length) {
        clearFormState();
      }
    };
  }, []);

  const handleDownloadCode = async (code: GeneratedCode) => {
    try {
      const link = document.createElement('a');
      link.download = `${code.type}-${code.productName}-${code.id}.png`;
      link.href = code.code;
      link.click();
      
      showSuccess('Código descargado exitosamente');
    } catch (error) {
      showError('Error al descargar el código');
    }
  };

  const handlePrintCode = async (code: GeneratedCode) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showError('No se pudo abrir la ventana de impresiÃ³n');
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir Código - ${code.productName}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px; 
              }
              .code-container { 
                border: 1px solid #ccc; 
                padding: 20px; 
                margin: 20px auto; 
                width: fit-content; 
              }
              .product-name { 
                font-size: 16px; 
                font-weight: bold; 
                margin-bottom: 10px; 
              }
              .code-data { 
                font-size: 12px; 
                color: #666; 
                margin-top: 10px; 
              }
              img { 
                max-width: 200px; 
                height: auto; 
              }
            </style>
          </head>
          <body>
            <div class="code-container">
              <div class="product-name">${code.productName}</div>
              <img src="${code.code}" alt="${code.type} code" />
              <div class="code-data">${code.data}</div>
            </div>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      
      showSuccess('Código enviado a impresiÃ³n');
    } catch (error) {
      showError('Error al imprimir el código');
    }
  };

  const handleDeleteCode = (codeId: string) => {
    const updatedCodes = generatedCodes.filter(code => code.id !== codeId);
    saveGeneratedCodes(updatedCodes);
    showSuccess('Código eliminado exitosamente');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('Datos copiados al portapapeles');
    }).catch(() => {
      showError('Error al copiar al portapapeles');
    });
  };

  // Asegurar que tenemos una imagen DataURL; si no, generarla desde datos
  const ensureImageDataURL = async (code: GeneratedCode): Promise<string> => {
    if (code.code && code.code.startsWith('data:')) return code.code;
    const data = String(code.data || '');
    if (code.type === 'qr') {
      return await QRCode.toDataURL(data, { margin: 1, width: 300 });
    }
    // barcode
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, data, {
      format: 'CODE128',
      width: 2,
      height: 100,
      displayValue: true,
      fontSize: 14,
      textMargin: 5
    });
    return canvas.toDataURL('image/png');
  };

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const codesToExport = historyType === 'qr' ? filteredHistoryQR : filteredHistoryBarcode;
      if (!codesToExport.length) {
        showError('No hay códigos para exportar');
        return;
      }
      const mmToPt = (mm: number) => mm * 72 / 25.4;
      if (exportFormat === 'a4') {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const margin = 32;
        const pageW = doc.internal.pageSize.getWidth();
        const colW = (pageW - margin * 2 - 16) / 2;
        const rowH = historyType === 'qr' ? 220 : 180;
        let x = margin, y = margin;
        let col = 0, row = 0;
        for (let i = 0; i < codesToExport.length; i++) {
          const c = codesToExport[i];
          const img = await ensureImageDataURL(c);
          doc.setFontSize(12);
          const created = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
          const title = [
            labelShowName ? c.productName : null,
            c.type === 'qr' ? 'QR' : 'Barras',
            labelShowData ? c.data : null,
            labelShowDate ? created.toLocaleDateString() : null,
          ].filter(Boolean).join(' â€¢ ');
          doc.text(title, x, y);
          const imgH = historyType === 'qr' ? 160 : 120;
          doc.addImage(img, 'PNG', x, y + 12, colW, imgH);
          y += rowH;
          col++;
          if (col === 2) {
            col = 0;
            x = margin;
            row++;
          } else {
            x = margin + colW + 16;
            y -= rowH;
          }
          if (row === 3 || i === codesToExport.length - 1) {
            if (i !== codesToExport.length - 1) {
              doc.addPage();
              x = margin; y = margin; col = 0; row = 0;
            }
          }
        }
        const fileName = `codigos-${historyType}-${new Date().toISOString().slice(0,10)}.pdf`;
        doc.save(fileName);
      } else {
        const labelWmm = exportFormat === 'label58' ? 58 : 80;
        const labelHmm = exportFormat === 'label58' ? 40 : 50;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [mmToPt(labelWmm), mmToPt(labelHmm)] });
        const marginPt = mmToPt(4);
        const maxW = mmToPt(labelWmm) - marginPt * 2;
        for (let i = 0; i < codesToExport.length; i++) {
          const c = codesToExport[i];
          const img = await ensureImageDataURL(c);
          const created = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
      let y = marginPt;
          if (labelShowName) {
            doc.setFontSize(10);
            doc.text(String(c.productName), marginPt, y);
            y += 12;
          }
          const imgH = historyType === 'qr' ? mmToPt(28) : mmToPt(20);
          doc.addImage(img, 'PNG', marginPt, y, maxW, imgH);
          y += imgH + 6;
          const footerParts = [
            labelShowData ? String(c.data) : null,
            labelShowDate ? created.toLocaleDateString() : null,
          ].filter(Boolean);
          if (footerParts.length) {
            doc.setFontSize(8);
            doc.text(footerParts.join(' â€¢ '), marginPt, y);
          }
          if (i !== codesToExport.length - 1) doc.addPage();
        }
        const fileName = `etiquetas-${historyType}-${exportFormat}-${new Date().toISOString().slice(0,10)}.pdf`;
        doc.save(fileName);
      }
      showSuccess('PDF exportado exitosamente');
    } catch (err) {
      console.error(err);
      showError('Error al exportar PDF');
    }
  };

  const handleExportSinglePDF = async (code: GeneratedCode) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const img = await ensureImageDataURL(code);
      const mmToPt = (mm: number) => mm * 72 / 25.4;
      if (exportFormat === 'a4') {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const margin = 40;
        doc.setFontSize(14);
        if (labelShowName) doc.text(`${code.productName}`, margin, margin);
        doc.setFontSize(12);
        const created = code.createdAt instanceof Date ? code.createdAt : new Date(code.createdAt);
        const infoParts = [
          `Tipo: ${code.type === 'qr' ? 'QR' : 'Barras'}`,
          labelShowData ? `Datos: ${code.data}` : null,
          labelShowDate ? `Fecha: ${created.toLocaleDateString()}` : null,
        ].filter(Boolean);
      const y = margin + (labelShowName ? 18 : 0);
        infoParts.forEach((t, idx) => { doc.text(String(t), margin, y + (idx * 18)); });
        const pageW = doc.internal.pageSize.getWidth();
        const maxW = pageW - margin * 2;
        const imgH = code.type === 'qr' ? 300 : 180;
        doc.addImage(img, 'PNG', margin, y + (infoParts.length ? (18 * infoParts.length) : 10), maxW, imgH);
        const fileName = `${code.type}-${code.productName}-${code.id}.pdf`;
        doc.save(fileName);
      } else {
        const labelWmm = exportFormat === 'label58' ? 58 : 80;
        const labelHmm = exportFormat === 'label58' ? 40 : 50;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [mmToPt(labelWmm), mmToPt(labelHmm)] });
        const marginPt = mmToPt(4);
        const maxW = mmToPt(labelWmm) - marginPt * 2;
      let y = marginPt;
        if (labelShowName) {
          doc.setFontSize(10);
          doc.text(String(code.productName), marginPt, y);
          y += 12;
        }
        const imgH = code.type === 'qr' ? mmToPt(28) : mmToPt(20);
        doc.addImage(img, 'PNG', marginPt, y, maxW, imgH);
        y += imgH + 6;
        const created = code.createdAt instanceof Date ? code.createdAt : new Date(code.createdAt);
        const footerParts = [
          labelShowData ? String(code.data) : null,
          labelShowDate ? created.toLocaleDateString() : null,
        ].filter(Boolean);
        if (footerParts.length) {
          doc.setFontSize(8);
          doc.text(footerParts.join(' â€¢ '), marginPt, y);
        }
        const fileName = `${code.type}-${exportFormat}-${code.productName}-${code.id}.pdf`;
        doc.save(fileName);
      }
      showSuccess('PDF exportado exitosamente');
    } catch {
      showError('Error al exportar PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold mx-auto mb-4"></div>
          <p className="text-[#8F8F8F] font-ui">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-charcoal">
            códigos QR y códigos de Barras
          </h1>
          <p className="text-[#8F8F8F] font-ui mt-1">
            Genera y gestiona códigos QR y códigos de barras para tus productos
          </p>
        </div>
      </div>

      {/* Banner de modo demo (solo desarrollo) */}
      {import.meta.env.DEV && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-blue-800 font-ui">
            {!envAllowsDemo
              ? 'Modo demo deshabilitado por entorno (.env)'
              : demoSeedEnabled
                ? 'Modo demo activo: botones visibles sin generar códigos.'
                : 'Modo demo inactivo: los botones aparecen al generar códigos.'}
          </p>
          {demoSeedEnabled ? (
            <button onClick={disableDemoSeed} className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-ui text-sm">
              Desactivar demo
            </button>
          ) : (
            <button onClick={enableDemoSeed} disabled={!envAllowsDemo} className={`px-3 py-1 rounded-md font-ui text-sm ${envAllowsDemo ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>
              Activar demo
            </button>
          )}
        </div>
      )}

      {/* Aviso de desincronizaciÃ³n con inventario */}
      {mismatchedCodes.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg flex items-center justify-between">
          <p className="text-sm text-yellow-800 font-ui">
            Hay {mismatchedCodes.length} códigos guardados que no coinciden con el inventario.
          </p>
          <button
            data-testid="codigos.generate"
            onClick={regenerateMismatchedCodes}
            className="px-3 py-1 bg-brand-gold text-white rounded-md hover:bg-[#D4AF37] font-ui text-sm"
          >
            Regenerar para sincronizar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-line-soft">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('generate')}
            className={`py-2 px-1 border-b-2 font-ui font-medium text-sm ${
              activeTab === 'generate'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-[#8F8F8F] hover:text-text-warm hover:border-[#D1D5DB]'
            }`}
          >
            <QrCode className="w-4 h-4 inline mr-2" />
            Generar códigos
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-ui font-medium text-sm ${
              activeTab === 'history'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-[#8F8F8F] hover:text-text-warm hover:border-[#D1D5DB]'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Historial ({generatedCodes.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GeneraciÃ³n de códigos */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold text-text-warm mb-4">
              Generar Nuevo código
            </h2>

            {/* Tipo de Código */}
            <div className="mb-4">
              <label className="block text-sm font-ui font-medium text-text-warm mb-2">
                Tipo de código
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="qr"
                    checked={codeType === 'qr'}
                    onChange={(e) => {
                      setCodeType(e.target.value as 'qr' | 'barcode');
                      saveFormState(); // Guardar estado al cambiar tipo
                    }}
                    className="mr-2"
                  />
                  <QrCode className="w-4 h-4 mr-1" />
                  Código QR
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="barcode"
                    checked={codeType === 'barcode'}
                    onChange={(e) => {
                      setCodeType(e.target.value as 'qr' | 'barcode');
                      saveFormState(); // Guardar estado al cambiar tipo
                    }}
                    className="mr-2"
                  />
                  <BarChart3 className="w-4 h-4 mr-1" />
                  Código de Barras
                </label>
              </div>
            </div>

            {/* Selección de producto */}
            <div className="mb-4">
              <label className="block text-sm font-ui font-medium text-text-warm mb-2">
                Producto seleccionado
              </label>
              {selectedProduct ? (
                <div className="flex items-center justify-between p-3 bg-[#F3ECE2] rounded-lg">
                  <div>
                    <p className="font-ui font-medium text-text-charcoal">{selectedProduct.name}</p>
                    <p className="text-sm text-[#8F8F8F]">
                      código: {selectedProduct.barcode || selectedProduct.id}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      saveFormState(); // Guardar estado después de limpiar producto
                    }}
                    className="text-error-600 hover:text-error-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-[#8F8F8F] font-ui text-sm p-3 bg-[#F9FAFB] rounded-lg">
                  No hay producto seleccionado. Selecciona uno de la lista o ingresa datos personalizados.
                </p>
              )}
            </div>

            {/* Datos personalizados */}
            <div className="mb-6">
              <label className="block text-sm font-ui font-medium text-text-warm mb-2">
                Datos personalizados (opcional)
              </label>
              <input
                type="text"
                value={customData}
                onChange={(e) => {
                  setCustomData(e.target.value);
                  saveFormState(); // Guardar estado al cambiar datos
                }}
                placeholder="Ingresa datos personalizados para el código"
                className="w-full px-4 py-3 border border-line-soft rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent font-ui"
              />
              <p className="text-xs text-[#8F8F8F] mt-1">
                Si ingresas datos personalizados, se usarán en lugar del Código del producto
              </p>
            </div>

            {/* Botón generar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleGenerateCode}
                onMouseEnter={() => { Promise.all([import('qrcode'), import('jsbarcode')]).catch(() => {}); }}
                onFocus={() => { Promise.all([import('qrcode'), import('jsbarcode')]).catch(() => {}); }}
                disabled={!selectedProduct && !customData}
                className="w-full bg-brand-gold hover:bg-[#D4AF37] text-white font-ui font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Generar {codeType === 'qr' ? 'Código QR' : 'Código de Barras'}
              </button>
              <button
                onClick={handleGenerateBothCodes}
                onMouseEnter={() => { Promise.all([import('qrcode'), import('jsbarcode')]).catch(() => {}); }}
                onFocus={() => { Promise.all([import('qrcode'), import('jsbarcode')]).catch(() => {}); }}
                disabled={!selectedProduct && !customData}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-ui font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Generar ambos (QR y Barras)
              </button>
            </div>

            {lastGeneratedCodes.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleDownloadLastGenerated}
                  className="flex items-center px-3 py-2 border border-line-soft rounded-xl text-sm text-text-charcoal hover:bg-[#FCF9F3]"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </button>
                <button
                  data-testid="codigos.print"
                  onClick={handlePrintLastGenerated}
                  className="flex items-center px-3 py-2 border border-line-soft rounded-xl text-sm text-text-charcoal hover:bg-[#FCF9F3]"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </button>
              </div>
            )}

            {/* Canvas ocultos para generaciÃ³n */}
            <canvas ref={qrCanvasRef} style={{ display: 'none' }} />
            <canvas ref={barcodeCanvasRef} style={{ display: 'none' }} />
          </div>

          {/* Lista de productos */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-text-warm">
                Productos del Inventario
              </h2>
              <div className="w-64">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar productos..."
                />
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedProduct?.id === product.id
                      ? 'bg-brand-gold/10 border border-brand-gold'
                      : 'bg-white border border-line-soft hover:border-brand-gold hover:bg-[#FCF9F3]'
                  }`}
                  onClick={() => {
                    setSelectedProduct(product);
                    saveFormState(); // Guardar estado al seleccionar producto
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-ui font-medium text-sm text-text-charcoal">
                        {product.name}
                      </h3>
                      <p className="text-xs text-[#8F8F8F]">
                        código: {product.barcode || product.id}
                      </p>
                      <p className="text-xs text-[#8F8F8F]">
                        Stock: {typeof product.stock === 'number' ? product.stock : Number(product.stock ?? 0)} | $
                        {typeof product.price === 'number' 
                          ? product.price.toLocaleString() 
                          : Number(product.price ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <Package className="w-4 h-4 text-[#8F8F8F]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Historial de códigos */
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-semibold text-text-warm">
              códigos Generados
            </h2>
            <button
              onClick={loadGeneratedCodes}
              className="flex items-center text-brand-gold hover:text-[#D4AF37] font-ui font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar
            </button>
            <div className="flex items-center space-x-2">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'a4' | 'label58' | 'label80')}
                className="border border-line-soft rounded px-2 py-1 text-sm"
                title="Formato de exportaciÃ³n"
              >
                <option value="a4">A4</option>
                <option value="label58">Etiqueta 58mm</option>
                <option value="label80">Etiqueta 80mm</option>
              </select>
              <label className="flex items-center text-xs text-[#444]">
                <input type="checkbox" className="mr-1" checked={labelShowName} onChange={(e) => setLabelShowName(e.target.checked)} />
                Nombre
              </label>
              <label className="flex items-center text-xs text-[#444]">
                <input type="checkbox" className="mr-1" checked={labelShowData} onChange={(e) => setLabelShowData(e.target.checked)} />
                Datos
              </label>
              <label className="flex items-center text-xs text-[#444]">
                <input type="checkbox" className="mr-1" checked={labelShowDate} onChange={(e) => setLabelShowDate(e.target.checked)} />
                Fecha
              </label>
              <button
                onClick={handleExportPDF}
                onMouseEnter={() => { import('jspdf').catch(() => {}); }}
                onFocus={() => { import('jspdf').catch(() => {}); }}
                className="ml-2 flex items-center text-blue-600 hover:text-blue-700 font-ui font-medium"
                disabled={backendHealthMode !== 'ok'}
                title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Exportar visibles a PDF'}
              >
                <Printer className="w-4 h-4 mr-1" />
                Exportar PDF
              </button>
            </div>
          </div>
          {backendHealthMode !== 'ok' && (
            <div className={`mt-3 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5" />
                <span>
                  {backendHealthMode === 'down'
                    ? 'Backend caído: exportaciones deshabilitadas temporalmente.'
                    : 'Backend degradado: exportaciones deshabilitadas temporalmente.'}
                </span>
              </div>
            </div>
          )}

          {generatedCodes.length === 0 ? (
            <div className="text-center py-12">
              <QrCode className="w-16 h-16 mx-auto text-[#8F8F8F] mb-4" />
              <p className="text-[#8F8F8F] font-ui">
                No hay códigos generados aÃºn
              </p>
              <button
                onClick={() => setActiveTab('generate')}
                className="mt-4 text-brand-gold hover:text-[#D4AF37] font-ui font-medium"
              >
                Generar primer código
              </button>
            </div>
          ) : (
            <>
              <HistoryFilters />
              {historyType === 'qr' && (
              <>
              <h3 className="font-display text-md font-semibold text-text-warm mt-2 mb-2">códigos QR ({filteredHistoryQR.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {filteredHistoryQR.map((code) => (
                <div key={code.id} className="bg-white border border-line-soft rounded-lg p-4">
                  <div className="text-center mb-3">
                    <img
                      src={code.code}
                      alt={`${code.type} code`}
                      className="mx-auto max-w-full h-24 object-contain"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-ui font-medium text-sm text-text-charcoal truncate">
                      {code.productName}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-[#8F8F8F]">
                      <span className="flex items-center">
                        <QrCode className="w-3 h-3 mr-1" />
                        QR
                      </span>
                      <span>{code.createdAt.toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-[#8F8F8F] truncate">
                      Datos: {code.data}
                    </p>
                    {(() => {
                      const product = products.find(p => p.id === code.productId);
                      const expected = product ? (product.barcode || product.id) : undefined;
                      const isMismatch = product ? (code.data !== expected) : false;
                      if (!product) {
                        return <p className="text-xs text-warning-700">Producto no encontrado en inventario</p>;
                      }
                      if (isMismatch) {
                        return <p className="text-xs text-error-600">Desincronizado con inventario</p>;
                      }
                      return null;
                    })()}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-line-soft">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handlePreviewCode(code)}
                        className="p-1 text-[#8F8F8F] hover:text-brand-gold transition-colors"
                        title="Ver"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copyToClipboard(code.data)}
                        className="p-1 text-[#8F8F8F] hover:text-brand-gold transition-colors"
                        title="Copiar datos"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleDownloadCode(code)}
                        className="p-1 text-[#8F8F8F] hover:text-success-600 transition-colors"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrintCode(code)}
                        className="p-1 text-[#8F8F8F] hover:text-blue-600 transition-colors"
                        title="Imprimir"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCode(code.id)}
                        className="p-1 text-[#8F8F8F] hover:text-error-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              </>
              )}

              {historyType === 'barcode' && (
              <>
              <h3 className="font-display text-md font-semibold text-text-warm mt-2 mb-2">códigos de Barras ({filteredHistoryBarcode.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHistoryBarcode.map((code) => (
                <div key={code.id} className="bg-white border border-line-soft rounded-lg p-4">
                  <div className="text-center mb-3">
                    <img
                      src={code.code}
                      alt={`${code.type} code`}
                      className="mx-auto max-w-full h-24 object-contain"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-ui font-medium text-sm text-text-charcoal truncate">
                      {code.productName}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-[#8F8F8F]">
                      <span className="flex items-center">
                        <BarChart3 className="w-3 h-3 mr-1" />
                        Barras
                      </span>
                      <span>{code.createdAt.toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-[#8F8F8F] truncate">
                      Datos: {code.data}
                    </p>
                    {(() => {
                      const product = products.find(p => p.id === code.productId);
                      const expected = product ? (product.barcode || product.id) : undefined;
                      const isMismatch = product ? (code.data !== expected) : false;
                      if (!product) {
                        return <p className="text-xs text-warning-700">Producto no encontrado en inventario</p>;
                      }
                      if (isMismatch) {
                        return <p className="text-xs text-error-600">Desincronizado con inventario</p>;
                      }
                      return null;
                    })()}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-line-soft">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handlePreviewCode(code)}
                        className="p-1 text-[#8F8F8F] hover:text-brand-gold transition-colors"
                        title="Ver"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copyToClipboard(code.data)}
                        className="p-1 text-[#8F8F8F] hover:text-brand-gold transition-colors"
                        title="Copiar datos"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleDownloadCode(code)}
                        className="p-1 text-[#8F8F8F] hover:text-success-600 transition-colors"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrintCode(code)}
                        className="p-1 text-[#8F8F8F] hover:text-blue-600 transition-colors"
                        title="Imprimir"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCode(code.id)}
                        className="p-1 text-[#8F8F8F] hover:text-error-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              </>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal de vista previa */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={`Vista Previa - ${previewCode?.productName}`}
      >
        {previewCode && (
          <div className="text-center space-y-4">
            <div className="bg-white p-6 rounded-lg border border-line-soft inline-block">
              <img
                src={previewCode.code}
                alt={`${previewCode.type} code`}
                className="mx-auto max-w-full h-48 object-contain"
              />
            </div>
            
            <div className="space-y-2">
              <p className="font-ui font-medium text-text-charcoal">
                {previewCode.productName}
              </p>
              <p className="text-sm text-[#8F8F8F]">
                Tipo: {previewCode.type === 'qr' ? 'Código QR' : 'Código de Barras'}
              </p>
              <p className="text-sm text-[#8F8F8F]">
                Datos: {previewCode.data}
              </p>
              <p className="text-xs text-[#8F8F8F]">
                Generado: {previewCode.createdAt.toLocaleString()}
              </p>
            </div>

            <div className="flex justify-center space-x-3 pt-4">
              <button
                onClick={() => handleDownloadCode(previewCode)}
                className="flex items-center px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors font-ui"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </button>
              <button
                onClick={() => handlePrintCode(previewCode)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-ui"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </button>
              <button
                onClick={() => handleExportSinglePDF(previewCode)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-ui"
                disabled={backendHealthMode !== 'ok'}
                title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Exportar este Código a PDF'}
              >
                <Printer className="w-4 h-4 mr-2" />
                PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CodesPage;









  // Semilla en desarrollo para mostrar botones de Descargar/Imprimir sin interacción (respeta toggle demoSeedEnabled)
  /* efecto de siembra movido dentro del componente y deshabilitado en testMode */
