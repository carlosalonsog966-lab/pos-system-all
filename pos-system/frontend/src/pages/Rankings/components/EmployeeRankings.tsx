import React, { useState } from 'react';
import { TrophyIcon, StarIcon, UserIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { RankingData, EmployeePerformance, rankingService } from '@/services/rankingService';
import { getStableKey } from '@/lib/utils';
import LoadingSpinner from '@/components/Common/LoadingSpinner';

interface EmployeeRankingsProps {
  data: RankingData;
}

const EmployeeRankings: React.FC<EmployeeRankingsProps> = ({ data }) => {
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [perfByEmployee, setPerfByEmployee] = useState<Record<string, { loading: boolean; error: string | null; data?: EmployeePerformance }>>({});

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
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

  const toggleDetails = async (employeeId: string) => {
    const isOpen = expandedEmployeeId === employeeId;
    setExpandedEmployeeId(isOpen ? null : employeeId);
    if (!isOpen) {
      const current = perfByEmployee[employeeId];
      if (!current?.data && !current?.loading) {
        setPerfByEmployee(prev => ({ ...prev, [employeeId]: { loading: true, error: null } }));
        try {
          const perf = await rankingService.getEmployeePerformance(employeeId, data.period);
          setPerfByEmployee(prev => ({ ...prev, [employeeId]: { loading: false, error: null, data: perf } }));
        } catch (e: any) {
          setPerfByEmployee(prev => ({ ...prev, [employeeId]: { loading: false, error: e?.message || 'Error al cargar desempeño' } }));
        }
      }
    }
  };

  if (!data.employees || data.employees.length === 0) {
    return (
      <div className="text-center py-12">
        <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No hay empleados para mostrar
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          No se encontraron datos de empleados para el período seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Rankings de Empleados ({data.employees.length})
        </h3>
        <div className="text-sm text-gray-500">
          Ordenado por ingresos totales
        </div>
      </div>

      <div className="space-y-4">
        {data.employees.map((employee) => (
          <div
            key={getStableKey(employee.id, employee.rank, employee.employee?.name, employee.totalRevenue)}
            className={`border rounded-lg p-6 transition-all hover:shadow-md ${getCardBorder(employee.rank)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  {getRankIcon(employee.rank)}
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${getRankBadgeColor(employee.rank)}`}>
                    #{employee.rank}
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {employee.employee.name}
                  </h4>
                  <div className="flex items-center text-sm text-gray-600">
                    <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                    {employee.employee.branch?.name || 'Sin sucursal'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(employee.totalRevenue)}
                </p>
                <p className="text-sm text-gray-600">
                  {employee.totalSales} ventas
                </p>
                <button
                  onClick={() => toggleDetails(employee.employee.id)}
                  className="mt-2 inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  {expandedEmployeeId === employee.employee.id ? 'Ocultar desempeño' : 'Ver desempeño'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Ticket Promedio</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(employee.averageTicket)}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Comisión Total</p>
                <p className="text-lg font-semibold text-blue-600">
                  {formatCurrency(employee.totalCommission)}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Total Ventas</p>
                <p className="text-lg font-semibold text-purple-600">
                  {employee.totalSales}
                </p>
              </div>
            </div>

            {/* Barra de progreso basada en el rendimiento relativo */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Rendimiento</span>
                <span>Posición #{employee.rank}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.max(10, 100 - (employee.rank - 1) * 10)}%` 
                  }}
                />
              </div>
            </div>

            {expandedEmployeeId === employee.employee.id && (
              <div className="mt-6 border-t pt-4">
                {perfByEmployee[employee.employee.id]?.loading && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <LoadingSpinner size="sm" />
                    <span>Cargando desempeño...</span>
                  </div>
                )}
                {perfByEmployee[employee.employee.id]?.error && (
                  <div className="text-sm text-red-600">{perfByEmployee[employee.employee.id]?.error}</div>
                )}
                {perfByEmployee[employee.employee.id]?.data && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Ventas (detalle)</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {perfByEmployee[employee.employee.id]!.data!.sales.totalSales}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Ingresos (detalle)</p>
                      <p className="text-lg font-semibold text-green-700">
                        {formatCurrency(perfByEmployee[employee.employee.id]!.data!.sales.totalRevenue)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Ticket Promedio (detalle)</p>
                      <p className="text-lg font-semibold text-blue-700">
                        {formatCurrency(perfByEmployee[employee.employee.id]!.data!.sales.averageTicket)}
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

export default EmployeeRankings;
