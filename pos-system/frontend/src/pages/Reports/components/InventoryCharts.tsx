import React from 'react';
import {
  BarChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle,
  Package,
  TrendingUp
} from 'lucide-react';
import { getStableKey } from '@/lib/utils';

interface InventoryChartsProps {
  inventoryData: {
    totalProducts: number;
    totalValue: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    categories: Array<{
      category: string;
      products: number;
      value: number;
      averageStock: number;
    }>;
    stockLevels: Array<{
      productName: string;
      currentStock: number;
      minStock: number;
      maxStock: number;
      value: number;
      category: string;
    }>;
    stockMovements: Array<{
      date: string;
      inbound: number;
      outbound: number;
      adjustments: number;
    }>;
    topValueProducts: Array<{
      name: string;
      stock: number;
      value: number;
      category: string;
    }>;
  };
}

const STATUS_COLORS = {
  normal: '#10B981',
  low: '#F59E0B',
  out: '#EF4444',
  high: '#3B82F6'
};

export const InventoryCharts: React.FC<InventoryChartsProps> = ({ 
  inventoryData
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-MX').format(value);
  };

  // Preparar datos para gráficas
  const stockStatusData = inventoryData.stockLevels.map(product => ({
    name: product.productName.length > 15 ? product.productName.substring(0, 15) + '...' : product.productName,
    current: product.currentStock,
    min: product.minStock,
    max: product.maxStock,
    status: product.currentStock <= product.minStock ? 'low' : 
            product.currentStock === 0 ? 'out' : 
            product.currentStock > product.maxStock ? 'high' : 'normal',
    value: product.value,
    category: product.category
  }));

  const categoryValueData = inventoryData.categories.map(cat => ({
    category: cat.category,
    products: cat.products,
    value: cat.value,
    averageStock: cat.averageStock
  }));

  const stockTurnoverData = inventoryData.stockLevels.map(product => ({
    name: product.productName.length > 10 ? product.productName.substring(0, 10) + '...' : product.productName,
    stock: product.currentStock,
    value: product.value,
    turnover: product.value / Math.max(product.currentStock, 1) // Valor por unidad como proxy de rotación
  }));

  const lowStockProducts = stockStatusData.filter(p => p.status === 'low' || p.status === 'out');
  const normalStockProducts = stockStatusData.filter(p => p.status === 'normal');
  const highStockProducts = stockStatusData.filter(p => p.status === 'high');

  const stockDistribution = [
    { name: 'Stock Normal', value: normalStockProducts.length, color: STATUS_COLORS.normal },
    { name: 'Stock Bajo', value: lowStockProducts.length, color: STATUS_COLORS.low },
    { name: 'Sin Stock', value: inventoryData.outOfStockProducts, color: STATUS_COLORS.out },
    { name: 'Sobre Stock', value: highStockProducts.length, color: STATUS_COLORS.high }
  ];

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="chart-container">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Total Joyas</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(inventoryData.totalProducts)}
              </p>
              <p className="text-sm text-gray-500 mt-1">En inventario</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(inventoryData.totalValue)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Inventario</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(inventoryData.lowStockProducts)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Joyas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Sin Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(inventoryData.outOfStockProducts)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Joyas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Movimientos de stock */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Movimientos de Stock por Fecha
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <ComposedChart data={inventoryData.stockMovements}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => new Date(value).toLocaleDateString('es-MX', { 
                month: 'short', 
                day: 'numeric' 
              })}
            />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [formatNumber(Number(value)), 
                name === 'inbound' ? 'Entradas' : 
                name === 'outbound' ? 'Salidas' : 'Ajustes'
              ]}
              labelFormatter={(label) => new Date(label).toLocaleDateString('es-MX')}
            />
            <Legend />
            <Bar dataKey="inbound" fill="#10B981" name="Entradas" />
            <Bar dataKey="outbound" fill="#EF4444" name="Salidas" />
            <Line type="monotone" dataKey="adjustments" stroke="#F59E0B" strokeWidth={3} name="Ajustes" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Gráficas en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución de stock */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución de Niveles de Stock
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <PieChart>
              <Pie
                data={stockDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {stockDistribution.map((entry) => (
                  <Cell key={getStableKey(entry.name, entry.value)} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Joyas']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Valor por categoría */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Valor de Inventario por Categoría
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <BarChart data={categoryValueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'value' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
                  name === 'value' ? 'Valor' : 
                  name === 'products' ? 'Joyas' : 'Stock Promedio'
                ]}
              />
              <Legend />
              <Bar dataKey="value" fill="#3B82F6" name="Valor" />
              <Bar dataKey="products" fill="#10B981" name="Joyas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Análisis de rotación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Joyas de mayor valor */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Joyas de Mayor Valor en Stock
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <BarChart data={inventoryData.topValueProducts.slice(0, 10)} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={120}
                tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
              />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'value' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
                  name === 'value' ? 'Valor' : 'Stock'
                ]}
              />
              <Legend />
              <Bar dataKey="value" fill="#3B82F6" name="Valor" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Análisis de rotación */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Análisis de Rotación de Inventario
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <ScatterChart data={stockTurnoverData.slice(0, 20)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stock" name="Stock" />
              <YAxis dataKey="turnover" name="Rotación" />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'turnover' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
                  name === 'turnover' ? 'Valor/Unidad' : 'Stock'
                ]}
                labelFormatter={(label) => `Joya: ${label}`}
              />
              <Scatter dataKey="turnover" fill="#8B5CF6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stock actual vs mínimo */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Comparativo: Stock Actual vs Stock Mínimo
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <BarChart data={stockStatusData.slice(0, 15)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                formatNumber(Number(value)),
                name === 'current' ? 'Stock Actual' : 
                name === 'min' ? 'Stock Mínimo' : 'Stock Máximo'
              ]}
            />
            <Legend />
            <Bar dataKey="current" fill="#3B82F6" name="Stock Actual" />
            <Bar dataKey="min" fill="#F59E0B" name="Stock Mínimo" />
            <Bar dataKey="max" fill="#10B981" name="Stock Máximo" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Alertas de inventario */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Alertas de Inventario
          </h3>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
            {/* Joyas sin stock */}
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <h4 className="font-medium text-red-900">Sin Stock</h4>
              </div>
              <div className="text-2xl font-bold text-red-600 mb-2">
                {inventoryData.outOfStockProducts}
              </div>
              <p className="text-sm text-red-700">Joyas agotadas</p>
            </div>

            {/* Joyas con stock bajo */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                <h4 className="font-medium text-yellow-900">Stock Bajo</h4>
              </div>
              <div className="text-2xl font-bold text-yellow-600 mb-2">
                {inventoryData.lowStockProducts}
              </div>
              <p className="text-sm text-yellow-700">Requieren reposición</p>
            </div>

            {/* Joyas con stock normal */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <h4 className="font-medium text-green-900">Stock Normal</h4>
              </div>
              <div className="text-2xl font-bold text-green-600 mb-2">
                {normalStockProducts.length}
              </div>
              <p className="text-sm text-green-700">Niveles adecuados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de joyas críticas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Joyas que Requieren Atención
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joya
                  </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Actual
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Mínimo
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lowStockProducts.slice(0, 10).map((product) => (
                <tr key={getStableKey((product as any)?.id, product.name, product.category, product.min, product.current)} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-500">
                    {typeof (product as any)?.category === 'string' ? (product as any).category : (product as any)?.category?.name ?? '(Sin categoría)'}
                  </td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatNumber(product.current)}
                  </td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                    {formatNumber(product.min)}
                  </td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(product.value)}
                  </td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      product.status === 'out' ? 'bg-red-100 text-red-800' :
                      product.status === 'low' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {product.status === 'out' ? 'Sin Stock' :
                       product.status === 'low' ? 'Stock Bajo' : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
