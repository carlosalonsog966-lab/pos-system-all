import React from 'react';
import { CurrencyDollarIcon, ShoppingCartIcon, UsersIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { RankingData } from '@/services/rankingService';

interface RankingSummaryProps {
  data: RankingData;
}

const RankingSummary: React.FC<RankingSummaryProps> = ({ data }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const stats = [
    {
      name: 'Ingresos Totales',
      value: formatCurrency(data.totalRevenue),
      icon: CurrencyDollarIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      name: 'Ventas Totales',
      value: data.totalSales.toString(),
      icon: ShoppingCartIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      name: 'Guías Activos',
      value: data.guides.length.toString(),
      icon: UsersIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      name: 'Agencias',
      value: data.agencies.length.toString(),
      icon: BuildingOfficeIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">Resumen del Período</h3>
        <p className="text-sm text-gray-600">
          {formatDate(data.period.startDate)} - {formatDate(data.period.endDate)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className={`${stat.bgColor} ${stat.borderColor} border rounded-lg p-4`}
          >
            <div className="flex items-center">
              <div className={`${stat.color} p-2 rounded-md`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top performers */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Guide */}
        {data.guides.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">🏆 Mejor Guía</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {data.guides[0].guide.name}
                </p>
                <p className="text-sm text-gray-600">
                  {data.guides[0].guide.agency?.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(data.guides[0].totalRevenue)}
                </p>
                <p className="text-sm text-gray-600">
                  {data.guides[0].totalSales} ventas
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top Product */}
        {data.products.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">🥇 Producto Estrella</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {data.products[0].product.name}
                </p>
                <p className="text-sm text-gray-600">
                  {data.products[0].product.code}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(data.products[0].totalRevenue)}
                </p>
                <p className="text-sm text-gray-600">
                  {data.products[0].totalQuantitySold} unidades
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RankingSummary;
