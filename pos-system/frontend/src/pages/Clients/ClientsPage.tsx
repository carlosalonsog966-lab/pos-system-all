import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { getStableKey } from '@/lib/utils';
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Users,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Star,
  Gift,
  TrendingUp,
  Eye,
  Edit3,
  Trash2,
  MoreHorizontal,
  ArrowUpDown,
  ChevronDown,
  X,
  Save,
  Building,
  Heart,
  Award,
  Target,
  DollarSign,
  Percent,
  Clock,
  FileText,
  Send,
  MessageCircle,
  Bell,
  Settings,
  History,
  ShoppingBag,
  Tag,
  Bookmark,
  UserCheck,
  UserX,
  Crown,
  Zap,
  AlertCircle
} from 'lucide-react';
import { api, initializeApiBaseUrl, parsePaginatedResponse, backendStatus } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import { useOfflineStore } from '@/store/offlineStore';
import { useClientsStore } from '@/store/clientsStore';
import SearchBar from '@/components/SearchBar';
import { maybeFixMojibake } from '@/lib/textEncoding';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import ConfirmationModal from '@/components/Common/ConfirmationModal';
import ObservabilityChip from '@/components/Common/ObservabilityChip';

// Interfaces
interface Client {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  birthDate?: string;
  documentType?: 'CC' | 'CE' | 'TI' | 'PP' | 'NIT';
  documentNumber?: string;
  customerType: 'regular' | 'vip' | 'wholesale' | 'premium';
  creditLimit?: number;
  discount?: number;
  loyaltyPoints: number;
  totalPurchases: number;
  purchaseCount: number;
  averageOrderValue: number;
  lastPurchase?: string;
  isActive: boolean;
  notes?: string;
  tags: string[];
  preferredPaymentMethod?: string;
  communicationPreferences: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    phone: boolean;
  };
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  referredBy?: string;
  referralCount: number;
  createdAt: string;
  updatedAt: string;
}

// Esquema flexible para validar ítems de clientes provenientes del backend
const ClientSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(v => String(v)),
  code: z.string().optional().default(''),
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  email: z.string().optional(),
  phone: z.union([z.string(), z.number()]).optional().transform(v => (v == null ? undefined : String(v))),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  birthDate: z.string().optional(),
  documentType: z.union([z.literal('CC'), z.literal('CE'), z.literal('TI'), z.literal('PP'), z.literal('NIT')]).optional().default('CC'),
  documentNumber: z.union([z.string(), z.number()]).optional().transform(v => (v == null ? undefined : String(v))),
  customerType: z.union([z.literal('regular'), z.literal('vip'), z.literal('wholesale'), z.literal('premium')]).optional().default('regular'),
  creditLimit: z.union([z.number(), z.string()]).optional().transform(v => Number(v ?? 0)),
  discount: z.union([z.number(), z.string()]).optional().transform(v => Number(v ?? 0)),
  loyaltyPoints: z.union([z.number(), z.string()]).optional().transform(v => Number(v ?? 0)),
  totalPurchases: z.union([z.number(), z.string()]).optional().transform(v => Number(v ?? 0)),
  purchaseCount: z.union([z.number(), z.string()]).optional().transform(v => Number(v ?? 0)),
  averageOrderValue: z.union([z.number(), z.string()]).optional().transform(v => Number(v ?? 0)),
  lastPurchase: z.string().optional(),
  isActive: z.union([z.boolean(), z.string()]).optional().transform(v => (typeof v === 'string' ? v === 'true' : Boolean(v))),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  preferredPaymentMethod: z.string().optional(),
  communicationPreferences: z.object({
    email: z.boolean().optional().default(true),
    sms: z.boolean().optional().default(false),
    whatsapp: z.boolean().optional().default(false),
    phone: z.boolean().optional().default(false),
  }).optional().default({ email: true, sms: false, whatsapp: false, phone: false }),
  socialMedia: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
  }).optional(),
  referredBy: z.string().optional(),
  referralCount: z.union([z.number(), z.string()]).optional().transform(v => Number(v ?? 0)),
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  updatedAt: z.string().optional().default(() => new Date().toISOString()),
}).passthrough();

interface ClientFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  birthDate: string;
  documentType: 'CC' | 'CE' | 'TI' | 'PP' | 'NIT';
  documentNumber: string;
  customerType: 'regular' | 'vip' | 'wholesale' | 'premium';
  creditLimit: number;
  discount: number;
  notes: string;
  tags: string[];
  preferredPaymentMethod: string;
  communicationPreferences: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    phone: boolean;
  };
  socialMedia: {
    facebook: string;
    instagram: string;
    twitter: string;
  };
  referredBy: string;
  isActive: boolean;
}

interface Purchase {
  id: string;
  date: string;
  total: number;
  items: number;
  paymentMethod: string;
  status: string;
}

interface FilterState {
  customerType: string;
  isActive: string;
  city: string;
  minPurchases: string;
  maxPurchases: string;
  hasEmail: string;
  hasPhone: string;
  lastPurchaseDays: string;
}

type ClientsPageProps = { testMode?: boolean };

const ClientsPage: React.FC<ClientsPageProps> = ({ testMode = false }) => {
  const { showSuccess, showError, showWarning } = useNotificationStore();
  // Removemos isOnline (no existe en OfflineState); usamos isOffline vÃ­a getState cuando se necesita

  // Estados del componente
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(!testMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<'name' | 'totalPurchases' | 'lastPurchase' | 'loyaltyPoints'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; clientId?: string; isLoading: boolean }>({ open: false, clientId: undefined, isLoading: false });
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');

  // Invalidar cachÃ© del Dashboard cuando se modifican clientes
  const DASHBOARD_PERIODS = ['today', 'week', 'month', 'quarter', 'year'] as const;
  const invalidateDashboardCache = () => {
    try {
      DASHBOARD_PERIODS.forEach((p) => localStorage.removeItem(`dashboard-cache:${p}`));
    } catch {/* noop */}
  };

  // Monitorear salud del backend y deshabilitar escrituras en modo degradado/caído
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

  // Estados para filtros
  const [filters, setFilters] = useState<FilterState>({
    customerType: '',
    isActive: 'true',
    city: '',
    minPurchases: '',
    maxPurchases: '',
    hasEmail: '',
    hasPhone: '',
    lastPurchaseDays: ''
  });

  // Normaliza un cliente desde cualquier payload a la forma esperada
  const normalizeClient = (c: any): Client => ({
    id: String(c?.id ?? ''),
    code: String(c?.code ?? ''),
    firstName: String(c?.firstName ?? ''),
    lastName: String(c?.lastName ?? ''),
    email: c?.email ? String(c.email) : undefined,
    phone: c?.phone ? String(c.phone) : undefined,
    address: c?.address ? String(c.address) : undefined,
    city: c?.city ? String(c.city) : undefined,
    country: c?.country ? String(c.country) : undefined,
    postalCode: c?.postalCode ? String(c.postalCode) : undefined,
    birthDate: c?.birthDate ? String(c.birthDate) : undefined,
    documentType: c?.documentType ?? 'CC',
    documentNumber: c?.documentNumber ? String(c.documentNumber) : undefined,
    customerType: (c?.customerType ?? 'regular') as Client['customerType'],
    creditLimit: Number(c?.creditLimit ?? 0),
    discount: Number(c?.discount ?? 0),
    loyaltyPoints: Number(c?.loyaltyPoints ?? 0),
    totalPurchases: Number(c?.totalPurchases ?? 0),
    purchaseCount: Number(c?.purchaseCount ?? 0),
    averageOrderValue: Number(c?.averageOrderValue ?? 0),
    lastPurchase: c?.lastPurchase ? String(c.lastPurchase) : undefined,
    isActive: typeof c?.isActive === 'string' ? c.isActive === 'true' : !!(c?.isActive ?? true),
    notes: c?.notes ? String(c.notes) : undefined,
    tags: Array.isArray(c?.tags) ? c.tags : (c?.tags ? [String(c.tags)] : []),
    preferredPaymentMethod: c?.preferredPaymentMethod ? String(c.preferredPaymentMethod) : undefined,
    communicationPreferences: {
      email: !!(c?.communicationPreferences?.email ?? true),
      sms: !!(c?.communicationPreferences?.sms ?? false),
      whatsapp: !!(c?.communicationPreferences?.whatsapp ?? false),
      phone: !!(c?.communicationPreferences?.phone ?? false),
    },
    socialMedia: {
      facebook: c?.socialMedia?.facebook ?? '',
      instagram: c?.socialMedia?.instagram ?? '',
      twitter: c?.socialMedia?.twitter ?? '',
    },
    referredBy: c?.referredBy ? String(c.referredBy) : undefined,
    referralCount: Number(c?.referralCount ?? 0),
    createdAt: String(c?.createdAt ?? new Date().toISOString()),
    updatedAt: String(c?.updatedAt ?? new Date().toISOString()),
  });

  // Estado del formulario
  const [formData, setFormData] = useState<ClientFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    birthDate: '',
    documentType: 'CC',
    documentNumber: '',
    customerType: 'regular',
    creditLimit: 0,
    discount: 0,
    notes: '',
    tags: [],
    preferredPaymentMethod: '',
    communicationPreferences: {
      email: true,
      sms: false,
      whatsapp: false,
      phone: false,
    },
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
    },
    referredBy: '',
    isActive: true,
  });





  // Cargar clientes
  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const { clients: storeClients, setClients: setStoreClients } = useClientsStore.getState();
      const { isOffline } = useOfflineStore.getState();

      // Si estamos offline y hay datos en el store, usarlos directamente
      if (isOffline && Array.isArray(storeClients) && storeClients.length > 0) {
        const normalized = storeClients.map(normalizeClient);
        setClients(normalized);
        setFilteredClients(normalized);
        showWarning('Sin conexiÃ³n. Mostrando clientes guardados localmente');
        return;
      }

      // Asegurar baseURL antes de llamar a la API
      try {
        await initializeApiBaseUrl();
      } catch { /* noop */ }
      const response = await api.get('/clients', { __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '600000' } } as any);
      const parsed = parsePaginatedResponse(response.data, ClientSchema);
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      if (items.length > 0) {
        const normalized: Client[] = items.map((c: any) => normalizeClient(c));
        setClients(normalized);
        setFilteredClients(normalized);
        // Persistir en store para uso posterior
        setStoreClients(normalized);
      } else {
        // Fallback a store si existe, de lo contrario usar mock
        if (Array.isArray(storeClients) && storeClients.length > 0) {
          console.warn('Clientes vacÃ­os desde API, usando store persistente');
          const normalized: Client[] = (storeClients as any[]).map((c) => normalizeClient(c));
          setClients(normalized);
          setFilteredClients(normalized);
        } else {
          console.warn('No hay clientes disponibles');
          setClients([]);
          setFilteredClients([]);
        }
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      const { clients: storeClients } = useClientsStore.getState();
      if (Array.isArray(storeClients) && storeClients.length > 0) {
        console.warn('API call failed, using store data as fallback');
        const normalized: Client[] = (storeClients as any[]).map((c) => normalizeClient(c));
        setClients(normalized);
        setFilteredClients(normalized);
        showWarning('Mostrando clientes guardados localmente');
      } else {
        // No hay datos disponibles
        console.warn('API call failed, no data available');
        setClients([]);
        setFilteredClients([]);
        showError('Error al cargar los clientes desde el servidor');
      }
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Filtrar y ordenar clientes
  const processedClients = useMemo(() => {
    // Validar que clients existe y es un array
    if (!clients || !Array.isArray(clients)) {
      return [];
    }

    let filtered = clients.filter(client => {
      // Validar que client existe
      if (!client) return false;

      const matchesSearch = !searchTerm || 
        client.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm) ||
        client.code?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = !filters.customerType || client.customerType === filters.customerType;
      const matchesActive = !filters.isActive || client.isActive?.toString() === filters.isActive;
      const matchesCity = !filters.city || client.city?.toLowerCase().includes(filters.city.toLowerCase());
      const matchesMinPurchases = !filters.minPurchases || (client.totalPurchases || 0) >= parseFloat(filters.minPurchases);
      const matchesMaxPurchases = !filters.maxPurchases || (client.totalPurchases || 0) <= parseFloat(filters.maxPurchases);
      const matchesEmail = !filters.hasEmail || (filters.hasEmail === 'true' ? !!client.email : !client.email);
      const matchesPhone = !filters.hasPhone || (filters.hasPhone === 'true' ? !!client.phone : !client.phone);
      
      let matchesLastPurchase = true;
      if (filters.lastPurchaseDays && client.lastPurchase) {
        const daysDiff = Math.floor((new Date().getTime() - new Date(client.lastPurchase).getTime()) / (1000 * 3600 * 24));
        matchesLastPurchase = daysDiff <= parseInt(filters.lastPurchaseDays);
      }

      return matchesSearch && matchesType && matchesActive && matchesCity && 
             matchesMinPurchases && matchesMaxPurchases && matchesEmail && 
             matchesPhone && matchesLastPurchase;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = `${a.firstName} ${a.lastName}`;
          bValue = `${b.firstName} ${b.lastName}`;
          break;
        case 'totalPurchases':
          aValue = a.totalPurchases;
          bValue = b.totalPurchases;
          break;
        case 'lastPurchase':
          aValue = a.lastPurchase ? new Date(a.lastPurchase) : new Date(0);
          bValue = b.lastPurchase ? new Date(b.lastPurchase) : new Date(0);
          break;
        case 'loyaltyPoints':
          aValue = a.loyaltyPoints;
          bValue = b.loyaltyPoints;
          break;
        default:
          aValue = a.firstName;
          bValue = b.firstName;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [clients, searchTerm, filters, sortBy, sortOrder]);

  // Funciones de utilidad
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX');
  };

  const getCustomerTypeColor = (type: string) => {
    switch (type) {
      case 'vip': return 'bg-purple-100 text-purple-800';
      case 'premium': return 'bg-yellow-100 text-yellow-800';
      case 'wholesale': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCustomerTypeIcon = (type: string) => {
    switch (type) {
      case 'vip': return Crown;
      case 'premium': return Star;
      case 'wholesale': return Building;
      default: return User;
    }
  };

  // Funciones del modal
  const openClientModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        country: client.country || '',
        postalCode: client.postalCode || '',
        birthDate: client.birthDate || '',
        documentType: client.documentType || 'CC',
        documentNumber: client.documentNumber || '',
        customerType: client.customerType,
        creditLimit: client.creditLimit || 0,
        discount: client.discount || 0,
        notes: client.notes || '',
        tags: client.tags,
        preferredPaymentMethod: client.preferredPaymentMethod || '',
        communicationPreferences: client.communicationPreferences,
        socialMedia: {
          facebook: client.socialMedia?.facebook ?? '',
          instagram: client.socialMedia?.instagram ?? '',
          twitter: client.socialMedia?.twitter ?? '',
        },
        referredBy: client.referredBy || '',
        isActive: client.isActive,
      });
    } else {
      setEditingClient(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        postalCode: '',
        birthDate: '',
        documentType: 'CC',
        documentNumber: '',
        customerType: 'regular',
        creditLimit: 0,
        discount: 0,
        notes: '',
        tags: [],
        preferredPaymentMethod: '',
        communicationPreferences: {
          email: true,
          sms: false,
          whatsapp: false,
          phone: false,
        },
        socialMedia: {
          facebook: '',
          instagram: '',
          twitter: '',
        },
        referredBy: '',
        isActive: true,
      });
    }
    setShowClientModal(true);
  };

  const closeClientModal = () => {
    setShowClientModal(false);
    setEditingClient(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Construir datos y sanitizar opcionales
      const rawData = {
        ...formData,
        creditLimit: Number(formData.creditLimit) || 0,
        discount: Number(formData.discount) || 0,
      };
      const sanitizeString = (v?: string) => {
        const t = (v ?? '').trim();
        return t.length > 0 ? t : undefined;
      };
      const clientData: any = {
        firstName: rawData.firstName,
        lastName: rawData.lastName,
        email: sanitizeString(rawData.email),
        phone: sanitizeString(rawData.phone),
        address: sanitizeString(rawData.address),
        city: sanitizeString(rawData.city),
        country: sanitizeString(rawData.country),
        birthDate: rawData.birthDate && rawData.birthDate.trim().length > 0 ? rawData.birthDate : undefined,
        documentType: rawData.documentType,
        documentNumber: sanitizeString(rawData.documentNumber),
        creditLimit: rawData.creditLimit,
        discount: rawData.discount,
        notes: sanitizeString(rawData.notes),
      };
      // Si es creaciÃ³n, generar un cÃ³digo Ãºnico requerido por el backend
      if (!editingClient) {
        clientData.code = `CLI${Date.now().toString(36).toUpperCase()}`;
      }

      // Asegurar baseURL antes de llamadas a API para evitar errores de conexiÃ³n
      try {
        await initializeApiBaseUrl();
      } catch {/* noop */}

      let apiSucceeded = false;
      let localFallbackUsed = false;

      if (editingClient) {
        // Actualizar cliente existente
        try {
          const response = await api.put(`/clients/${editingClient.id}`, clientData);
          if (response.data.success) {
            showSuccess(
              'Cliente actualizado exitosamente',
              `${clientData.firstName} ${clientData.lastName} | Documento: ${clientData.documentType}-${clientData.documentNumber} | Tipo: ${clientData.customerType.toUpperCase()}`
            );
            apiSucceeded = true;
          } else {
            throw new Error('API response not successful');
          }
        } catch (apiError: any) {
          console.error('Error updating client via API:', apiError);
          try {
            const status = apiError?.response?.status;
            if (status === 403) {
              showWarning('Sin permisos para editar en servidor. Guardando en modo local y se intentarÃ¡ sincronizar.');
            } else {
              showWarning('Error de servidor o conexiÃ³n. Guardando cambios en modo local y se intentarÃ¡ sincronizar.');
            }
          } catch {/* noop */}
          // Fallback: actualizar localmente y persistir en store
          const updatedClientsList = clients.map(client => 
            client.id === editingClient.id 
              ? { ...client, ...clientData, updatedAt: new Date().toISOString() }
              : client
          );
          setClients(updatedClientsList);
          try {
            const storeState = useClientsStore.getState();
            storeState.setClients(updatedClientsList as any);
          } catch (e) {
            console.warn('No se pudo persistir en clientsStore:', e);
          }
          try {
            useOfflineStore.getState().addPendingAction({
              type: 'UPDATE_CLIENT',
              data: { id: editingClient.id, ...clientData },
              priority: 'medium',
              maxRetries: 3,
            });
          } catch (e) {
            console.warn('No se pudo encolar acciÃ³n offline UPDATE_CLIENT:', e);
          }
          showSuccess(
            'Cliente actualizado exitosamente (modo local)',
            `${clientData.firstName} ${clientData.lastName} | Documento: ${clientData.documentType}-${clientData.documentNumber} | Tipo: ${clientData.customerType.toUpperCase()}`
          );
          localFallbackUsed = true;
          invalidateDashboardCache();
        }
      } else {
        // Crear nuevo cliente
        try {
          const response = await api.post('/clients', clientData);
          if (response.data.success) {
            showSuccess(
              'Cliente creado exitosamente',
              `${clientData.firstName} ${clientData.lastName} | Código: ${clientData.code} | Documento: ${clientData.documentType}-${clientData.documentNumber} | Tipo: ${clientData.customerType.toUpperCase()}`
            );
            apiSucceeded = true;
          } else {
            throw new Error('API response not successful');
          }
        } catch (apiError: any) {
          console.error('Error creating client via API:', apiError);
          try {
            const status = apiError?.response?.status;
            if (status === 403) {
              showWarning('Sin permisos para crear en servidor. Guardando en modo local y se intentarÃ¡ sincronizar.');
            } else {
              showWarning('Error de servidor o conexiÃ³n. Guardando en modo local y se intentarÃ¡ sincronizar.');
            }
          } catch {/* noop */}
          // Fallback: crear localmente y persistir en store
          const newClient = {
            ...clientData,
            id: Date.now().toString(),
            code: clientData.code || `CLI${String(clients.length + 1).padStart(3, '0')}`,
            loyaltyPoints: 0,
            totalPurchases: 0,
            purchaseCount: 0,
            averageOrderValue: 0,
            lastPurchase: undefined,
            referralCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const updatedClientsList = [...clients, newClient];
          setClients(updatedClientsList);
          try {
            const storeState = useClientsStore.getState();
            storeState.setClients(updatedClientsList as any);
          } catch (e) {
            console.warn('No se pudo persistir en clientsStore:', e);
          }
          try {
            useOfflineStore.getState().addPendingAction({
              type: 'CREATE_CLIENT',
              data: newClient,
              priority: 'medium',
              maxRetries: 3,
            });
          } catch (e) {
            console.warn('No se pudo encolar acciÃ³n offline CREATE_CLIENT:', e);
          }
          showSuccess(
            'Cliente creado exitosamente (modo local)',
            `${clientData.firstName} ${clientData.lastName} | Código: ${newClient.code} | Documento: ${clientData.documentType}-${clientData.documentNumber} | Tipo: ${clientData.customerType.toUpperCase()}`
          );
          localFallbackUsed = true;
          invalidateDashboardCache();
        }
      }
      closeClientModal();
      // Solo recargar desde servidor cuando la operaciÃ³n en API fue exitosa
      if (apiSucceeded) {
        invalidateDashboardCache();
        loadClients();
      }
    } catch (error) {
      console.error('Error saving client:', error);
      showError('Error al guardar el cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    try {
      // Asegurar baseURL antes de eliminar via API
      try {
        await initializeApiBaseUrl();
      } catch {/* noop */}
      // Intentar eliminar via API
      try {
        const response = await api.delete(`/clients/${clientId}`);
        if (response.data.success) {
          const client = clients.find(c => c.id === clientId);
          showSuccess(
            'Cliente eliminado exitosamente',
            `${client?.firstName} ${client?.lastName} | Código: ${client?.code} | Documento: ${client?.documentType}-${client?.documentNumber}`
          );
          // Actualizar UI local inmediatamente tras Ã©xito en API
          const updatedClients = clients.filter(client => client.id !== clientId);
          setClients(updatedClients);
          try {
            const storeState = useClientsStore.getState();
            storeState.setClients(updatedClients as any);
          } catch (e) {
            console.warn('No se pudo persistir en clientsStore:', e);
          }
          invalidateDashboardCache();
        } else {
          throw new Error('API response not successful');
        }
      } catch (apiError: any) {
        console.error('Error deleting client via API:', apiError);
        try {
          const status = apiError?.response?.status;
          if (status === 403) {
            showWarning('Sin permisos para eliminar en servidor. Eliminando en modo local y se intentarÃ¡ sincronizar.');
          } else {
            showWarning('Error de servidor o conexiÃ³n. Eliminando en modo local y se intentarÃ¡ sincronizar.');
          }
        } catch {/* noop */}
        // Fallback: eliminar localmente
        const updatedClients = clients.filter(client => client.id !== clientId);
        setClients(updatedClients);
        try {
          const storeState = useClientsStore.getState();
          storeState.setClients(updatedClients as any);
        } catch (e) {
          console.warn('No se pudo persistir en clientsStore:', e);
        }
        try {
          useOfflineStore.getState().addPendingAction({
            type: 'DELETE_CLIENT',
            data: { id: clientId },
            priority: 'low',
            maxRetries: 3,
          });
        } catch (e) {
          console.warn('No se pudo encolar acciÃ³n offline DELETE_CLIENT:', e);
        }
        showSuccess(
          'Cliente eliminado exitosamente (modo local)',
          `Cliente ID: ${clientId}`
        );
        invalidateDashboardCache();
      }
      // Recargar solo si la API tuvo Ã©xito (evitar sobreescribir cambios locales)
      try {
        // Nota: si la API fallÃ³, el catch anterior ya actualizÃ³ localmente
        const response = await api.get('/clients', { params: { isActive: true }, __suppressGlobalError: true } as any);
        if (response?.data?.success) {
          loadClients();
        }
      } catch {/* noop: mantener estado local */}
    } catch (error) {
      console.error('Error deleting client:', error);
      showError('Error al eliminar el cliente');
    }
  };

  const handleExport = () => {
    showSuccess(
      'Exportación de clientes iniciada',
      `Total de clientes: ${processedClients.length}`
    );
  };

  const openPurchaseHistory = (client: Client) => {
    setSelectedClientForHistory(client);
    setShowPurchaseHistory(true);
  };

  // EstadÃ­sticas
  const totalClients = processedClients.length;
  const activeClients = processedClients.filter(c => c.isActive).length;
  const totalRevenue = processedClients.reduce((sum, client) => sum + Number(client.totalPurchases || 0), 0);

  useEffect(() => { if (testMode) return; loadClients(); }, [loadClients, testMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona tu base de clientes y su informaciÃ³n
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ObservabilityChip
              label="Total"
              value={filteredClients.length}
              warnKey="CLIENTS_WARN_COUNT"
              critKey="CLIENTS_CRIT_COUNT"
              title="Conteo de clientes visibles"
            />
            <ObservabilityChip
              label="Activos"
              value={activeClients}
              warnKey="CLIENTS_ACTIVE_WARN_COUNT"
              critKey="CLIENTS_ACTIVE_CRIT_COUNT"
              title="Clientes activos"
            />
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            data-testid="clients-export-button"
            disabled={backendHealthMode !== 'ok'}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
          <button
            data-testid="clients-create-button"
            onClick={() => openClientModal()}
            disabled={backendHealthMode !== 'ok'}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
            className="inline-flex items-center px-4 py-2 bg-brand-gold text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Banner de estado degradado/caído */}
      {backendHealthMode !== 'ok' && (
        <div className={`mt-3 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>
              {backendHealthMode === 'down'
                ? 'Servidor no disponible. Escrituras deshabilitadas temporalmente.'
                : 'Modo degradado: escrituras críticas deshabilitadas temporalmente.'}
            </span>
          </div>
        </div>
      )}

      {/* EstadÃ­sticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Clientes</p>
              <p className="text-2xl font-bold text-gray-900">{totalClients}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Clientes Activos</p>
              <p className="text-2xl font-bold text-gray-900">{activeClients}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-8 w-8 text-brand-gold" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Ingresos Totales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex-1 max-w-lg">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar clientes..."
            dataTestId="clients-search-input"
          />
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            data-testid="clients-filters-button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </button>
          
          <div className="flex border border-gray-300 rounded-lg">
            <button
              data-testid="clients-view-table-button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'table'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tabla
            </button>
            <button
              data-testid="clients-view-grid-button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'grid'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              CuadrÃ­cula
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cliente</label>
              <select
                value={filters.customerType}
                onChange={(e) => setFilters(prev => ({ ...prev, customerType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="regular">Regular</option>
                <option value="vip">VIP</option>
                <option value="wholesale">Mayorista</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={filters.isActive}
                onChange={(e) => setFilters(prev => ({ ...prev, isActive: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                value={filters.city}
                onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Filtrar por ciudad"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compras MÃ­nimas</label>
              <input
                type="number"
                value={filters.minPurchases}
                onChange={(e) => setFilters(prev => ({ ...prev, minPurchases: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setFilters({
                customerType: '',
                isActive: '',
                city: '',
                minPurchases: '',
                maxPurchases: '',
                hasEmail: '',
                hasPhone: '',
                lastPurchaseDays: ''
              })}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Lista de clientes */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={processedClients && selectedClients.length === processedClients.length && processedClients.length > 0}
                      onChange={(e) => {
                        if (e.target.checked && processedClients) {
                          setSelectedClients(processedClients.map(c => c.id));
                        } else {
                          setSelectedClients([]);
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compras
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Puntos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(client.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedClients([...selectedClients, client.id]);
                          } else {
                            setSelectedClients(selectedClients.filter(id => id !== client.id));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {maybeFixMojibake(client.firstName)} {maybeFixMojibake(client.lastName)}
                          </div>
                          <div className="text-sm text-gray-500">{client.code}</div>
                          {Array.isArray(client.tags) && client.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(Array.isArray(client.tags) ? client.tags.slice(0, 2) : []).map((tag) => (
                                <span
                                  key={getStableKey(client.id, tag)}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {tag}
                                </span>
                              ))}
                              {Array.isArray(client.tags) && client.tags.length > 2 && (
                                <span className="text-xs text-gray-500">
                                  +{client.tags.length - 2} mÃ¡s
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{maybeFixMojibake(client.email || '')}</div>
                      <div className="text-sm text-gray-500">{client.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCustomerTypeColor(client.customerType || 'regular')}`}>
                        {React.createElement(getCustomerTypeIcon(client.customerType || 'regular'), { className: "h-3 w-3 mr-1" })}
                        {String(client.customerType || 'regular').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(client.totalPurchases)}</div>
                      <div className="text-sm text-gray-500">{client.purchaseCount} compras</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 mr-1" />
                        <span className="text-sm text-gray-900">{client.loyaltyPoints}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        client.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {client.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          data-testid="clients-view-history-button"
                          onClick={() => openPurchaseHistory(client)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver historial"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          data-testid="clients-edit-button"
                          onClick={() => openClientModal(client)}
                          disabled={backendHealthMode !== 'ok'}
                          className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                          title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Editar'}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          data-testid="clients-delete-button"
                          onClick={() => setDeleteConfirm({ open: true, clientId: client.id, isLoading: false })}
                          disabled={backendHealthMode !== 'ok'}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Eliminar'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 p-4 sm:p-6">
            {processedClients.map((client) => (
              <div key={client.id} className="bg-white border rounded-lg p-4 sm:p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                      <User className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {client.firstName} {client.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">{client.code}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCustomerTypeColor(client.customerType || 'regular')}`}>
                    {React.createElement(getCustomerTypeIcon(client.customerType || 'regular'), { className: "h-3 w-3 mr-1" })}
                    {String(client.customerType || 'regular').toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {client.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2" />
                      {client.email}
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2" />
                      {client.phone}
                    </div>
                  )}
                  {client.city && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2" />
                      {client.city}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Total Compras</p>
                    <p className="text-sm font-medium">{formatCurrency(client.totalPurchases)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Puntos</p>
                    <p className="text-sm font-medium flex items-center">
                      <Star className="h-3 w-3 text-yellow-400 mr-1" />
                      {client.loyaltyPoints}
                    </p>
                  </div>
                </div>

                {Array.isArray(client.tags) && client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(Array.isArray(client.tags) ? client.tags.slice(0, 3) : []).map((tag) => (
                      <span
                        key={getStableKey(client.id, tag)}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                    {Array.isArray(client.tags) && client.tags.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{client.tags.length - 3} mÃ¡s
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    client.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {client.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openPurchaseHistory(client)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver historial"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openClientModal(client)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Editar"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ open: true, clientId: client.id, isLoading: false })}
                      className="text-red-600 hover:text-red-900"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {(!processedClients || processedClients.length === 0) && (
              <div className="col-span-full text-center py-12">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay clientes</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comienza agregando un nuevo cliente.
                </p>
                <button
                  onClick={() => openClientModal()}
                  disabled={backendHealthMode !== 'ok'}
                  title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-brand-gold text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Cliente
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Cliente */}
      <Modal
        isOpen={showClientModal}
        onClose={closeClientModal}
        title={editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* InformaciÃ³n bÃ¡sica */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">InformaciÃ³n BÃ¡sica</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  TelÃ©fono
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Documento
                </label>
                <select
                  value={formData.documentType}
                  onChange={(e) => setFormData(prev => ({ ...prev, documentType: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="CC">CÃ©dula de CiudadanÃ­a</option>
                  <option value="CE">CÃ©dula de ExtranjerÃ­a</option>
                  <option value="TI">Tarjeta de Identidad</option>
                  <option value="PP">Pasaporte</option>
                  <option value="NIT">NIT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NÃºmero de Documento
                </label>
                <input
                  type="text"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, documentNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* InformaciÃ³n de contacto */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">InformaciÃ³n de Contacto</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DirecciÃ³n
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PaÃ­s
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CÃ³digo Postal
                </label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* InformaciÃ³n comercial */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">InformaciÃ³n Comercial</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cliente
                </label>
                <select
                  value={formData.customerType}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerType: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="regular">Regular</option>
                  <option value="vip">VIP</option>
                  <option value="wholesale">Mayorista</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LÃ­mite de CrÃ©dito
                </label>
                <input
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditLimit: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descuento (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discount}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.isActive.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Notas adicionales sobre el cliente..."
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={closeClientModal}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || backendHealthMode !== 'ok'}
              title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
            >
              {submitting && <LoadingSpinner size="sm" className="mr-2" />}
              {editingClient ? 'Actualizar' : 'Crear'} Cliente
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Historial de Compras */}
      <Modal
        isOpen={showPurchaseHistory}
        onClose={() => setShowPurchaseHistory(false)}
        title={`Historial de Compras - ${selectedClientForHistory?.firstName} ${selectedClientForHistory?.lastName}`}
        size="lg"
      >
        {selectedClientForHistory && (
          <div className="space-y-6">
            {/* EstadÃ­sticas del cliente */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <ShoppingBag className="h-8 w-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Total Compras</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedClientForHistory.totalPurchases)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Target className="h-8 w-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">NÃºmero de Compras</p>
                    <p className="text-lg font-bold text-gray-900">{selectedClientForHistory.purchaseCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-brand-gold" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Ticket Promedio</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedClientForHistory.averageOrderValue)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de compras */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Historial de Transacciones</h4>
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ArtÃ­culos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        MÃ©todo de Pago
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                        Historial de compras no disponible
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ConfirmaciÃ³n de eliminaciÃ³n */}
      <ConfirmationModal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, clientId: undefined, isLoading: false })}
        onConfirm={async () => {
          if (!deleteConfirm.clientId) return;
          setDeleteConfirm(prev => ({ ...prev, isLoading: true }));
          await handleDelete(deleteConfirm.clientId);
          setDeleteConfirm({ open: false, clientId: undefined, isLoading: false });
        }}
        title="Eliminar Cliente"
        message="Â¿EstÃ¡s seguro de que deseas eliminar este cliente? Esta acciÃ³n no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        isLoading={deleteConfirm.isLoading}
        itemName={`${(clients.find(c => c.id === deleteConfirm.clientId)?.firstName || '')} ${(clients.find(c => c.id === deleteConfirm.clientId)?.lastName || '')}`.trim()}
      />
    </div>
  );
};

export default ClientsPage;


