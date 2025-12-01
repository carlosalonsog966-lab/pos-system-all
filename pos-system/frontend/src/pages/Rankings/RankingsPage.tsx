import React, { useEffect, useState } from 'react';
import { Tab } from '@headlessui/react';
import { CalendarIcon, TrophyIcon, UsersIcon, CubeIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useRankingStore } from '@/store/rankingStore';
import { api } from '@/lib/api';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import { 
  PeriodSelector, 
  RankingSummary, 
  GuideRankings, 
  EmployeeRankings, 
  ProductRankings, 
  AgencyRankings 
} from './components';

type RankingsPageProps = { testMode?: boolean };
const RankingsPage: React.FC<RankingsPageProps> = ({ testMode = false }) => {
  const {
    rankings,
    loading,
    error,
    currentPeriod,
    loadRankings,
    clearError
  } = useRankingStore();

  const isLoading = testMode ? false : loading;

  const [selectedTab, setSelectedTab] = useState(0);

  const [rankingsAvailable, setRankingsAvailable] = useState(true);

  useEffect(() => {
    if (testMode) return;
    (async () => {
      try {
        await initializeApiBaseUrlSafely();
        const resp = await api.get('/meta/endpoints', { params: { base: '/rankings', method: 'GET' } } as any);
        const list = (resp.data?.endpoints || resp.data || []);
        const ok = Array.isArray(list) && list.length > 0;
        setRankingsAvailable(ok);
        if (ok) {
          loadRankings();
        }
      } catch {
        setRankingsAvailable(false);
      }
    })();
  }, [loadRankings, testMode]);

  const initializeApiBaseUrlSafely = async () => {
    try {
      const { initializeApiBaseUrl } = await import('@/lib/api');
      await initializeApiBaseUrl();
    } catch {}
  };

  const tabs = [
    {
      name: 'Guías',
      icon: TrophyIcon,
      component: GuideRankings,
      count: rankings?.guides?.length || 0
    },
    {
      name: 'Empleados',
      icon: UsersIcon,
      component: EmployeeRankings,
      count: rankings?.employees?.length || 0
    },
    {
      name: 'Productos',
      icon: CubeIcon,
      component: ProductRankings,
      count: rankings?.products?.length || 0
    },
    {
      name: 'Agencias',
      icon: BuildingOfficeIcon,
      component: AgencyRankings,
      count: rankings?.agencies?.length || 0
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rankings</h1>
          <p className="text-gray-600">
            Rendimiento y estadísticas de ventas
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <CalendarIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600 capitalize">
            Período: {currentPeriod === 'weekly' ? 'Semanal' : currentPeriod === 'monthly' ? 'Mensual' : 'Personalizado'}
          </span>
        </div>
      </div>

      {/* Selector de período */}
      <PeriodSelector />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error al cargar rankings
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
              <div className="mt-4">
                <button
                  onClick={clearError}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rankings && <RankingSummary data={rankings} />}

      {rankingsAvailable && rankings && (
        <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
          <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 ${
                    selected
                      ? 'bg-white shadow'
                      : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                  }`
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {tab.count}
                  </span>
                </div>
              </Tab>
            ))}
          </Tab.List>
          
          <Tab.Panels className="mt-6">
            {tabs.map((tab) => (
              <Tab.Panel
                key={tab.name}
                className="rounded-xl bg-white p-6 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2"
              >
                <tab.component data={rankings} />
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      )}

      {!isLoading && !rankingsAvailable && (
        <div className="text-center py-12">
          <TrophyIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Rankings no disponibles</h3>
          <p className="mt-1 text-sm text-gray-500">Módulo de turismo deshabilitado o sin endpoints.</p>
        </div>
      )}
      {!isLoading && rankingsAvailable && !rankings && !error && (
        <div className="text-center py-12">
          <TrophyIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No hay datos de rankings
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Selecciona un período para ver los rankings.
          </p>
        </div>
      )}
    </div>
  );
};

export default RankingsPage;
