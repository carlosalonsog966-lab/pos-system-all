import React from 'react';
import { TrophyIcon, StarIcon, BuildingOfficeIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { RankingData } from '@/services/rankingService';
import { getStableKey } from '@/lib/utils';

interface AgencyRankingsProps {
  data: RankingData;
}

const AgencyRankings: React.FC<AgencyRankingsProps> = ({ data }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-MX').format(num);
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
        return <BuildingOfficeIcon className="h-6 w-6 text-gray-300" />;
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'activa':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactiva':
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'suspendida':
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!data.agencies || data.agencies.length === 0) {
    return (
      <div className="text-center py-12">
        <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No hay agencias para mostrar
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          No se encontraron datos de agencias para el período seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Rankings de Agencias ({data.agencies.length})
        </h3>
        <div className="text-sm text-gray-500">
          Ordenado por ingresos totales
        </div>
      </div>

      <div className="space-y-4">
        {data.agencies.map((agency) => (
          <div
            key={getStableKey(agency.id, agency.rank, agency.agency?.name, agency.totalRevenue)}
            className={`border rounded-lg p-6 transition-all hover:shadow-md ${getCardBorder(agency.rank)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  {getRankIcon(agency.rank)}
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${getRankBadgeColor(agency.rank)}`}>
                    #{agency.rank}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {agency.agency.name}
                  </h4>
                  <div className="flex items-center space-x-4 mt-1">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPinIcon className="h-4 w-4 mr-1" />
                      {agency.agency.location}
                    </div>
                    {(agency.agency as any).phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <PhoneIcon className="h-4 w-4 mr-1" />
                        {(agency.agency as any).phone}
                      </div>
                    )}
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor((agency.agency as any).status || 'activa')}`}
                    >
                      {(agency.agency as any).status || 'Activa'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(agency.totalRevenue)}
                </p>
                <p className="text-sm text-gray-600">
                  {formatNumber(agency.totalSales)} ventas
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Ventas Totales</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatNumber(agency.totalSales)}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Ticket Promedio</p>
                <p className="text-lg font-semibold text-blue-600">
                  {formatCurrency(agency.averageTicket)}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Comisión Total</p>
                <p className="text-lg font-semibold text-purple-600">
                  {formatCurrency((agency as any).totalCommission || 0)}
                </p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Ingresos Totales</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(agency.totalRevenue)}
                </p>
              </div>
            </div>

            {/* Información adicional de la agencia */}
            {(agency.agency as any).manager && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Gerente:</span> {(agency.agency as any).manager}
                </p>
                {(agency.agency as any).email && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Email:</span> {(agency.agency as any).email}
                  </p>
                )}
              </div>
            )}

            {/* Barra de progreso basada en rendimiento */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Rendimiento</span>
                <span>{formatCurrency(agency.totalRevenue)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.max(10, 100 - (agency.rank - 1) * 8)}%` 
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgencyRankings;
