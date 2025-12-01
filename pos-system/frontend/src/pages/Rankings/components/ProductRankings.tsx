import React from 'react';
import { TrophyIcon, StarIcon, CubeIcon, TagIcon } from '@heroicons/react/24/outline';
import { RankingData } from '@/services/rankingService';
import { getStableKey } from '@/lib/utils';

interface ProductRankingsProps {
  data: RankingData;
}

const ProductRankings: React.FC<ProductRankingsProps> = ({ data }) => {
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
        return <CubeIcon className="h-6 w-6 text-gray-300" />;
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

  const getCategoryColor = (category: string) => {
    const colors = {
      'anillos': 'bg-pink-100 text-pink-800',
      'collares': 'bg-purple-100 text-purple-800',
      'aretes': 'bg-blue-100 text-blue-800',
      'pulseras': 'bg-green-100 text-green-800',
      'relojes': 'bg-yellow-100 text-yellow-800',
      'default': 'bg-gray-100 text-gray-800'
    };
    return colors[category.toLowerCase() as keyof typeof colors] || colors.default;
  };

  if (!data.products || data.products.length === 0) {
    return (
      <div className="text-center py-12">
        <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No hay productos para mostrar
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          No se encontraron datos de productos para el período seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Rankings de Productos ({data.products.length})
        </h3>
        <div className="text-sm text-gray-500">
          Ordenado por ingresos totales
        </div>
      </div>

      <div className="space-y-4">
        {data.products.map((product) => (
          <div
            key={getStableKey(product.id, product.rank, product.product?.code, product.product?.name, product.totalRevenue)}
            className={`border rounded-lg p-6 transition-all hover:shadow-md ${getCardBorder(product.rank)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  {getRankIcon(product.rank)}
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${getRankBadgeColor(product.rank)}`}>
                    #{product.rank}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {product.product.name}
                  </h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex items-center text-sm text-gray-600">
                      <TagIcon className="h-4 w-4 mr-1" />
                      {product.product.code}
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(product.product.category)}`}
                    >
                      {product.product.category}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(product.totalRevenue)}
                </p>
                <p className="text-sm text-gray-600">
                  {formatNumber(product.totalQuantitySold)} unidades
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Precio Promedio</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(product.totalRevenue / product.totalQuantitySold)}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Unidades Vendidas</p>
                <p className="text-lg font-semibold text-blue-600">
                  {formatNumber(product.totalQuantitySold)}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Ingresos Totales</p>
                <p className="text-lg font-semibold text-purple-600">
                  {formatCurrency(product.totalRevenue)}
                </p>
              </div>
            </div>

            {/* Barra de progreso basada en cantidad vendida */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Popularidad</span>
                <span>{formatNumber(product.totalQuantitySold)} unidades</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.max(10, 100 - (product.rank - 1) * 8)}%` 
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

export default ProductRankings;
