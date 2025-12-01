import React from 'react';
import { getStableKey } from '@/lib/utils';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar
} from 'recharts';

interface SalesChartsProps {
  salesData: {
    dailySales: Array<{
      date: string;
      sales: number;
      revenue: number;
      transactions: number;
    }>;
    monthlySales?: Array<{
      month: string;
      sales: number;
      revenue: number;
      growth: number;
    }>;
    monthlyTrend?: Array<{
      month: string;
      sales: number;
      transactions: number;
      customers: number;
    }>;
    salesByPaymentMethod?: Array<{
      method: string;
      amount: number;
      percentage: number;
    }>;
    paymentMethods?: Array<{
      method: string;
      amount: number;
      transactions: number;
      percentage: number;
    }>;
    salesByTimeOfDay?: Array<{
      hour: string;
      sales: number;
      revenue: number;
    }>;
    hourlySales?: Array<{
      hour: number;
      sales: number;
      transactions: number;
    }>;
    topProducts?: Array<{
      id: string;
      name: string;
      quantity: number;
      revenue: number;
      category: string;
    }>;
    categorySales?: Array<{
      category: string;
      sales: number;
      percentage: number;
      transactions: number;
    }>;
  };
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    category: string;
  }>;
  movements: {
    totalMovements: number;
    salesMovements: number;
    purchaseMovements: number;
    adjustmentMovements: number;
  };
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];
const PAYMENT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export const SalesCharts: React.FC<SalesChartsProps> = ({ 
  salesData, 
  topProducts, 
  movements 
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
  const topProductsChart = topProducts.slice(0, 10).map(product => ({
    name: product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name,
    quantity: product.quantity,
    revenue: product.revenue,
    category: product.category
  }));

  const salesByCategory = topProducts.reduce((acc, product) => {
    const existing = acc.find(item => item.category === product.category);
    if (existing) {
      existing.quantity += product.quantity;
      existing.revenue += product.revenue;
    } else {
      acc.push({
        category: product.category,
        quantity: product.quantity,
        revenue: product.revenue
      });
    }
    return acc;
  }, [] as Array<{ category: string; quantity: number; revenue: number }>);

  const movementData = [
    { name: 'Ventas', value: movements.salesMovements, color: '#10B981' },
    { name: 'Compras', value: movements.purchaseMovements, color: '#3B82F6' },
    { name: 'Ajustes', value: movements.adjustmentMovements, color: '#F59E0B' }
  ];

  return (
    <div className="space-y-6" data-testid="chart-container">
      {/* Ventas diarias */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Tendencia de Ventas Diarias
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <ComposedChart data={salesData.dailySales}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => new Date(value).toLocaleDateString('es-MX', { 
                month: 'short', 
                day: 'numeric' 
              })}
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'revenue') return [formatCurrency(Number(value)), 'Ingresos'];
                if (name === 'sales') return [formatNumber(Number(value)), 'Ventas'];
                if (name === 'transactions') return [formatNumber(Number(value)), 'Transacciones'];
                return [value, name];
              }}
              labelFormatter={(label) => new Date(label).toLocaleDateString('es-MX')}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="sales" fill="#3B82F6" name="Ventas" />
            <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} name="Ingresos" />
            <Line yAxisId="left" type="monotone" dataKey="transactions" stroke="#F59E0B" strokeWidth={2} name="Transacciones" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Ventas mensuales */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Comparativo Mensual de Ventas
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <AreaChart data={salesData.monthlySales}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'revenue') return [formatCurrency(Number(value)), 'Ingresos'];
                if (name === 'sales') return [formatNumber(Number(value)), 'Ventas'];
                if (name === 'growth') return [`${Number(value).toFixed(1)}%`, 'Crecimiento'];
                return [value, name];
              }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stackId="1"
              stroke="#3B82F6" 
              fill="#3B82F6" 
              fillOpacity={0.6}
              name="Ingresos"
            />
            <Area 
              type="monotone" 
              dataKey="sales" 
              stackId="2"
              stroke="#10B981" 
              fill="#10B981" 
              fillOpacity={0.6}
              name="Ventas"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gráficas en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Joyas más vendidas */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top 10 Joyas Más Vendidas
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <BarChart data={topProductsChart} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'quantity' ? `${value} unidades` : formatCurrency(Number(value)),
                  name === 'quantity' ? 'Cantidad' : 'Ingresos'
                ]}
              />
              <Legend />
              <Bar dataKey="quantity" fill="#3B82F6" name="Cantidad" />
              <Bar dataKey="revenue" fill="#10B981" name="Ingresos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas por método de pago */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Ventas por Método de Pago
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <PieChart>
              <Pie
                data={salesData.salesByPaymentMethod}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ method, percentage }) => `${method} (${percentage}%)`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="amount"
              >
                {salesData.salesByPaymentMethod?.map((entry, index) => (
                  <Cell key={getStableKey(entry.method, entry.amount, entry.percentage)} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Monto']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Más gráficas en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por hora del día */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Patrón de Ventas por Hora
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <AreaChart data={salesData.salesByTimeOfDay}>
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
              <Area 
                type="monotone" 
                dataKey="sales" 
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.6}
                name="Ventas"
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10B981" 
                fill="#10B981" 
                fillOpacity={0.3}
                name="Ingresos"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas por categoría */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Ventas por Categoría de Joya
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={salesByCategory}>
              <RadialBar 
                label={{ position: 'insideStart', fill: '#fff' }} 
                background 
                dataKey="quantity" 
              >
                {salesByCategory.map((entry, index) => (
                  <Cell key={getStableKey(entry.category, entry.quantity, entry.revenue)} fill={COLORS[index % COLORS.length]} />
                ))}
              </RadialBar>
              <Legend 
                iconSize={10} 
                layout="vertical" 
                verticalAlign="middle" 
                align="right"
              />
              <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Cantidad']} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Movimientos de inventario */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Distribución de Movimientos de Inventario
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <PieChart>
              <Pie
                data={movementData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${formatNumber(Number(value))}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {movementData.map((entry) => (
                  <Cell key={getStableKey(entry.name, entry.value)} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Movimientos']} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="flex flex-col justify-center space-y-4">
            {movementData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div 
                    className="w-4 h-4 rounded-full mr-3"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="font-medium text-gray-900">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatNumber(item.value)}</div>
                  <div className="text-sm text-gray-500">
                    {((item.value / movements.totalMovements) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen de métricas */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Resumen de Métricas de Ventas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(salesData.dailySales.reduce((sum, day) => sum + day.sales, 0))}
            </div>
            <div className="text-sm text-gray-600">Total Ventas</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(salesData.dailySales.reduce((sum, day) => sum + day.revenue, 0))}
            </div>
            <div className="text-sm text-gray-600">Total Ingresos</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {formatNumber(salesData.dailySales.reduce((sum, day) => sum + day.transactions, 0))}
            </div>
            <div className="text-sm text-gray-600">Total Transacciones</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(
                salesData.dailySales.reduce((sum, day) => sum + day.revenue, 0) /
                salesData.dailySales.reduce((sum, day) => sum + day.transactions, 0)
              )}
            </div>
            <div className="text-sm text-gray-600">Ticket Promedio</div>
          </div>
        </div>
      </div>
    </div>
  );
};

