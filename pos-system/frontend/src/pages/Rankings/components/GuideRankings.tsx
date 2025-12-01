import React, { useState } from 'react';
import { TrophyIcon, StarIcon, UserIcon } from '@heroicons/react/24/outline';
import { RankingData, GuidePerformance, rankingService } from '@/services/rankingService';
import { getStableKey } from '@/lib/utils';
import LoadingSpinner from '@/components/Common/LoadingSpinner';

interface GuideRankingsProps {
  data: RankingData;
}

const GuideRankings: React.FC<GuideRankingsProps> = ({ data }) => {
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null);
  const [perfByGuide, setPerfByGuide] = useState<Record<string, { loading: boolean; error: string | null; data?: GuidePerformance }>>({});

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <TrophyIcon className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <StarIcon className="h-6 w-6 text-gray-400" />;
      case 3:
        return <StarIcon className="h-6 w-6 text-amber-600" />;
      default:
        return <UserIcon className="h-6 w-6 text-gray-300" />;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-600 text-white';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getCardBorder = (rank: number) => {
    switch (rank) {
      case 1:
        return 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-white';
      case 2:
        return 'border-gray-300 bg-gradient-to-r from-gray-50 to-white';
      case 3:
        return 'border-amber-300 bg-gradient-to-r from-amber-50 to-white';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const toggleDetails = async (guideId: string) => {
    const isOpen = expandedGuideId === guideId;
    setExpandedGuideId(isOpen ? null : guideId);
    if (!isOpen) {
      const current = perfByGuide[guideId];
      if (!current?.data && !current?.loading) {
        setPerfByGuide(prev => ({ ...prev, [guideId]: { loading: true, error: null } }));
        try {
          const perf = await rankingService.getGuidePerformance(guideId, data.period);
          setPerfByGuide(prev => ({ ...prev, [guideId]: { loading: false, error: null, data: perf } }));
        } catch (e: any) {
          setPerfByGuide(prev => ({ ...prev, [guideId]: { loading: false, error: e?.message || 'Error al cargar desempeño' } }));
        }
      }
    }
  };

  if (!data.guides || data.guides.length === 0) {
    return (
      <div className="text-center py-12">
        <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No hay guías para mostrar
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          No se encontraron datos de guías para el período seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Rankings de Guías ({data.guides.length})
        </h3>
        <div className="text-sm text-gray-500">
          Ordenado por ingresos totales
        </div>
      </div>

      <div className="space-y-4">
        {data.guides.map((guide) => (
          <div
            key={getStableKey(guide.id, guide.rank, guide.guide?.name, guide.totalRevenue)}
            className={`border rounded-lg p-6 transition-all hover:shadow-md ${getCardBorder(guide.rank)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  {getRankIcon(guide.rank)}
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${getRankBadgeColor(guide.rank)}`}>
                    #{guide.rank}
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {guide.guide.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {guide.guide.agency?.name || 'Sin agencia'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(guide.totalRevenue)}
                </p>
                <p className="text-sm text-gray-600">
                  {guide.totalSales} ventas
                </p>
                <button
                  onClick={() => toggleDetails(guide.guide.id)}
                  className="mt-2 inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  {expandedGuideId === guide.guide.id ? 'Ocultar desempeño' : 'Ver desempeño'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Ticket Promedio</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(guide.averageTicket)}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Comisión</p>
                <p className="text-lg font-semibold text-blue-600">
                  {formatCurrency(guide.totalCommission)}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Personas Registradas</p>
                <p className="text-lg font-semibold text-purple-600">
                  {guide.totalPeopleRegistered}
                </p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  <span className="text-xs text-gray-600 mr-1">%</span>
                  <p className="text-xs text-gray-600">Cierre</p>
                </div>
                <p className="text-lg font-semibold text-green-600">
                  {formatPercentage(guide.closurePercentage)}
                </p>
              </div>
            </div>

            {/* Barra de progreso para % de cierre */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Efectividad de Cierre</span>
                <span>{formatPercentage(guide.closurePercentage)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(guide.closurePercentage, 100)}%` }}
                />
              </div>
            </div>

            {expandedGuideId === guide.guide.id && (
              <div className="mt-6 border-t pt-4">
                {perfByGuide[guide.guide.id]?.loading && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <LoadingSpinner size="sm" />
                    <span>Cargando desempeño...</span>
                  </div>
                )}
                {perfByGuide[guide.guide.id]?.error && (
                  <div className="text-sm text-red-600">{perfByGuide[guide.guide.id]?.error}</div>
                )}
                {perfByGuide[guide.guide.id]?.data && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Ventas (detalle)</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {perfByGuide[guide.guide.id]!.data!.sales.totalSales}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Ingresos (detalle)</p>
                      <p className="text-lg font-semibold text-green-700">
                        {formatCurrency(perfByGuide[guide.guide.id]!.data!.sales.totalRevenue)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Ticket Promedio (detalle)</p>
                      <p className="text-lg font-semibold text-blue-700">
                        {formatCurrency(perfByGuide[guide.guide.id]!.data!.sales.averageTicket)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Comisión (detalle)</p>
                      <p className="text-lg font-semibold text-purple-700">
                        {formatCurrency(perfByGuide[guide.guide.id]!.data!.sales.totalCommission)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuideRankings;
