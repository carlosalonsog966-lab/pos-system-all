import React from 'react';
import { getStableKey } from '@/lib/utils';
import {
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Banknote,
  Calculator
} from 'lucide-react';

interface FinancialChartsProps {
  financialData: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    cashFlow: Array<{
      date: string;
      income: number;
      expenses: number;
      netFlow: number;
      cumulativeFlow: number;
    }>;
    monthlyProfitLoss: Array<{
      month: string;
      revenue: number;
      expenses: number;
      profit: number;
      margin: number;
    }>;
    expenseCategories: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
    paymentMethods: Array<{
      method: string;
      amount: number;
      transactions: number;
      percentage: number;
    }>;
    dailyRevenue: Array<{
      date: string;
      revenue: number;
      transactions: number;
      averageTicket: number;
    }>;
  };
  kpis: {
    revenueGrowth: number;
    profitGrowth: number;
    expenseRatio: number;
    cashPosition: number;
  };
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16'];
const PROFIT_COLORS = {
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#6B7280'
};

export const FinancialCharts: React.FC<FinancialChartsProps> = ({ 
  financialData, 
  kpis 
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

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Preparar datos para gráficas
  const profitLossData = financialData.monthlyProfitLoss.map(item => ({
    ...item,
    profitColor: item.profit > 0 ? PROFIT_COLORS.positive : 
                 item.profit < 0 ? PROFIT_COLORS.negative : PROFIT_COLORS.neutral
  }));

  const cashFlowTrendData = financialData.cashFlow.map(item => ({
    ...item,
    flowColor: item.netFlow > 0 ? PROFIT_COLORS.positive : 
               item.netFlow < 0 ? PROFIT_COLORS.negative : PROFIT_COLORS.neutral
  }));

  const kpiData = [
    { name: 'Crecimiento Ingresos', value: Math.abs(kpis.revenueGrowth), fill: kpis.revenueGrowth >= 0 ? '#10B981' : '#EF4444' },
    { name: 'Crecimiento Utilidad', value: Math.abs(kpis.profitGrowth), fill: kpis.profitGrowth >= 0 ? '#10B981' : '#EF4444' },
    { name: 'Ratio Gastos', value: kpis.expenseRatio, fill: kpis.expenseRatio <= 70 ? '#10B981' : kpis.expenseRatio <= 85 ? '#F59E0B' : '#EF4444' }
  ];

  return (
    <div className="space-y-6" data-testid="chart-container">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(financialData.totalRevenue)}
              </p>
              <div className="flex items-center mt-1">
                {kpis.revenueGrowth >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  )}
                <span className={`text-sm ${kpis.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(Math.abs(kpis.revenueGrowth))}
                </span>
              </div>
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
              <p className="text-sm font-medium text-gray-600">Utilidad Neta</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(financialData.netProfit)}
              </p>
              <div className="flex items-center mt-1">
                {kpis.profitGrowth >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  )}
                <span className={`text-sm ${kpis.profitGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(Math.abs(kpis.profitGrowth))}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                <Calculator className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Margen de Utilidad</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(financialData.profitMargin)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Del total de ingresos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <Banknote className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Posición de Efectivo</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(kpis.cashPosition)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Disponible</p>
            </div>
          </div>
        </div>
      </div>

      {/* Flujo de caja */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Flujo de Caja Acumulado
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <ComposedChart data={cashFlowTrendData}>
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
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                name === 'income' ? 'Ingresos' : 
                name === 'expenses' ? 'Gastos' : 
                name === 'netFlow' ? 'Flujo Neto' : 'Flujo Acumulado'
              ]}
              labelFormatter={(label) => new Date(label).toLocaleDateString('es-MX')}
            />
            <Legend />
            <Bar dataKey="income" fill="#10B981" name="Ingresos" />
            <Bar dataKey="expenses" fill="#EF4444" name="Gastos" />
            <Line type="monotone" dataKey="cumulativeFlow" stroke="#3B82F6" strokeWidth={3} name="Flujo Acumulado" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Gráficas en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado de resultados mensual */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Estado de Resultados Mensual
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <BarChart data={profitLossData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === 'revenue' ? 'Ingresos' : 
                  name === 'expenses' ? 'Gastos' : 'Utilidad'
                ]}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#3B82F6" name="Ingresos" />
              <Bar dataKey="expenses" fill="#EF4444" name="Gastos" />
              <Bar dataKey="profit" fill="#10B981" name="Utilidad" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución de gastos */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución de Gastos por Categoría
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <PieChart>
              <Pie
                data={financialData.expenseCategories}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage }) => `${category}: ${Number(percentage || 0).toFixed(1)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="amount"
              >
                {financialData.expenseCategories.map((entry, index) => (
                  <Cell key={getStableKey(entry.category, entry.amount)} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Monto']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Análisis de métodos de pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingresos por método de pago */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Ingresos por Método de Pago
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <BarChart data={financialData.paymentMethods} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="method" type="category" width={100} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'amount' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
                  name === 'amount' ? 'Monto' : 'Transacciones'
                ]}
              />
              <Legend />
              <Bar dataKey="amount" fill="#3B82F6" name="Monto" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* KPIs radiales */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Indicadores de Rendimiento
          </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={kpiData}>
              <RadialBar
                label={{ position: 'insideStart', fill: '#fff' }}
                background
                dataKey="value"
              />
              <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
              <Tooltip formatter={(value) => [`${typeof value === 'number' ? value.toFixed(1) : value}%`, 'Valor']} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tendencia de ingresos diarios */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Tendencia de Ingresos Diarios
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <ComposedChart data={financialData.dailyRevenue}>
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
              formatter={(value, name) => [
                name === 'revenue' ? formatCurrency(Number(value)) : 
                name === 'averageTicket' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
                name === 'revenue' ? 'Ingresos' : 
                name === 'transactions' ? 'Transacciones' : 'Ticket Promedio'
              ]}
              labelFormatter={(label) => new Date(label).toLocaleDateString('es-MX')}
            />
            <Legend />
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="revenue" 
              fill="#3B82F6" 
              fillOpacity={0.3}
              stroke="#3B82F6"
              name="Ingresos" 
            />
            <Bar yAxisId="right" dataKey="transactions" fill="#10B981" name="Transacciones" />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="averageTicket" 
              stroke="#F59E0B" 
              strokeWidth={3}
              name="Ticket Promedio" 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Margen de utilidad por mes */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Evolución del Margen de Utilidad
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <AreaChart data={profitLossData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Margen']}
            />
            <Area 
              type="monotone" 
              dataKey="margin" 
              stroke="#8B5CF6" 
              fill="#8B5CF6" 
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen financiero */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Resumen Financiero
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {formatCurrency(financialData.totalRevenue)}
              </div>
              <div className="text-sm text-gray-600">Ingresos Totales</div>
              <div className="text-xs text-gray-500 mt-1">Período actual</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {formatCurrency(financialData.totalExpenses)}
              </div>
              <div className="text-sm text-gray-600">Gastos Totales</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatPercentage(kpis.expenseRatio)} de ingresos
              </div>
            </div>
            
            <div className="text-center">
              <div className={`text-3xl font-bold mb-2 ${
                financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(financialData.netProfit)}
              </div>
              <div className="text-sm text-gray-600">Utilidad Neta</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatPercentage(financialData.profitMargin)} margen
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {formatCurrency(kpis.cashPosition)}
              </div>
              <div className="text-sm text-gray-600">Efectivo Disponible</div>
              <div className="text-xs text-gray-500 mt-1">Posición actual</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
