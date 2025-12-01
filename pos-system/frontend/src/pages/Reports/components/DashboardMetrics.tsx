import React from 'react';
import { getStableKey } from '@/lib/utils';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface DashboardMetricsProps {
  data: {
    totalSales: number;
    totalRevenue?: number;
    totalCustomers?: number;
    totalProducts?: number;
    totalTransactions?: number;
    averageTicket?: number;
    activeCustomers?: number;
    salesGrowth: number;
    revenueGrowth?: number;
    transactionGrowth?: number;
    ticketGrowth?: number;
    customerGrowth?: number;
    topProducts?: Array<{
      id: string;
      name: string;
      quantity: number;
      revenue: number;
    }>;
    recentSales?: Array<{
      id: string;
      total: number;
      date: string;
      customerName?: string;
    }>;
    salesByHour?: Array<{
      hour: string;
      sales: number;
      revenue: number;
    }>;
    hourlySales?: Array<{
      hour: number;
      sales: number;
      transactions: number;
    }>;
    monthlySales?: Array<{
      month: string;
      sales: number;
      transactions: number;
      customers: number;
    }>;
    paymentMethods?: Array<{
      method: string;
      amount: number;
      transactions: number;
      percentage: number;
    }>;
    categoryDistribution?: Array<{
      category: string;
      value: number;
      percentage: number;
    }>;
  };
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ data }) => {
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

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
  };

  // Preparar datos para gráficas
  const salesTrendData = (data.recentSales || []).slice(-7).map((sale, index) => ({
    day: `Día ${index + 1}`,
    sales: sale.total,
    date: sale.date
  }));

  const topProductsData = (data.topProducts || []).slice(0, 5).map(product => ({
    name: product.name.length > 15 ? product.name.substring(0, 15) + '...' : product.name,
    quantity: product.quantity,
    revenue: product.revenue
  }));

  return (
    <div className="space-y-6" data-testid="chart-container">
      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.totalRevenue || 0)}
              </p>
              <div className={`flex items-center mt-1 ${getGrowthColor(data.revenueGrowth || 0)}`}>
                {React.createElement(getGrowthIcon(data.revenueGrowth || 0), { className: 'w-4 h-4 mr-1' })}
                <span className="text-sm font-medium">
                  {(data.revenueGrowth || 0) >= 0 ? '+' : ''}{(data.revenueGrowth || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <ShoppingCartIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Ventas Totales</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(data.totalSales)}
              </p>
              <div className={`flex items-center mt-1 ${getGrowthColor(data.salesGrowth || 0)}`}>
                {React.createElement(getGrowthIcon(data.salesGrowth || 0), { className: 'w-4 h-4 mr-1' })}
                <span className="text-sm font-medium">
                  {(data.salesGrowth || 0) >= 0 ? '+' : ''}{(data.salesGrowth || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                <UserGroupIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Clientes Totales</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(data.totalCustomers || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Clientes activos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <CubeIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Joyas Activas</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(data.totalProducts || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">En inventario</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficas principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        {/* Tendencia de ventas */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Tendencia de Ventas (Últimos 7 días)
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <AreaChart data={salesTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [formatCurrency(Number(value)), 'Ventas']}
                labelFormatter={(label) => `${label}`}
              />
              <Area 
                type="monotone" 
                dataKey="sales" 
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Joyas más vendidas */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Joyas Más Vendidas
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <BarChart data={topProductsData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'quantity' ? `${value} unidades` : formatCurrency(Number(value)),
                  name === 'quantity' ? 'Cantidad' : 'Ingresos'
                ]}
              />
              <Bar dataKey="quantity" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficas adicionales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por hora */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Ventas por Hora del Día
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <LineChart data={data.salesByHour || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'sales' ? `${value} ventas` : formatCurrency(Number(value)),
                  name === 'sales' ? 'Ventas' : 'Ingresos'
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Ventas"
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Ingresos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución por categorías */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución por Categorías
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <PieChart>
              <Pie
                data={data.categoryDistribution || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage }) => `${category} (${percentage}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {(data.categoryDistribution || []).map((entry, index) => (
                  <Cell key={getStableKey(entry.category, entry.value)} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Cantidad']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de ventas recientes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Ventas Recientes
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(data.recentSales || []).slice(0, 10).map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sale.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sale.customerName || 'Cliente general'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sale.date).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(sale.total)}
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
