import React from 'react';
import {
  LineChart,
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
  RadialBar,
  ScatterChart,
  Scatter
} from 'recharts';
import {
  Gem,
  Crown,
  Star,
  Award,
  Sparkles,
  Diamond,
  Heart,
  Zap,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { getStableKey } from '@/lib/utils';

interface JewelryChartsProps {
  jewelryData: {
    // Datos por categoría de joyería
    salesByCategory: Array<{
      category: string;
      sales: number;
      revenue: number;
      units: number;
      avgPrice: number;
    }>;
    
    // Datos por metal
    salesByMetal: Array<{
      metal: string;
      sales: number;
      revenue: number;
      units: number;
      purity: string;
    }>;
    
    // Datos por pureza de metal
    salesByPurity: Array<{
      purity: string;
      sales: number;
      revenue: number;
      units: number;
      avgWeight: number;
    }>;
    
    // Datos por tipo de piedra
    salesByStone: Array<{
      stoneType: string;
      sales: number;
      revenue: number;
      units: number;
      avgCarat: number;
    }>;
    
    // Datos por rango de peso
    salesByWeight: Array<{
      weightRange: string;
      sales: number;
      revenue: number;
      units: number;
      avgPrice: number;
    }>;
    
    // Datos por rango de precio
    salesByPriceRange: Array<{
      priceRange: string;
      sales: number;
      units: number;
      percentage: number;
    }>;
    
    // Datos por género
    salesByGender: Array<{
      gender: string;
      sales: number;
      revenue: number;
      units: number;
      topCategory: string;
    }>;
    
    // Datos por colección
    salesByCollection: Array<{
      collection: string;
      sales: number;
      revenue: number;
      units: number;
      avgPrice: number;
    }>;
    
    // Análisis de márgenes por categoría
    marginsByCategory: Array<{
      category: string;
      revenue: number;
      cost: number;
      margin: number;
      marginPercent: number;
    }>;
    
    // Inventario por valor
    inventoryValue: Array<{
      category: string;
      totalValue: number;
      units: number;
      avgValue: number;
      turnover: number;
    }>;
    
    // Tendencias estacionales
    seasonalTrends: Array<{
      month: string;
      anillos: number;
      collares: number;
      aretes: number;
      pulseras: number;
      relojes: number;
    }>;
    
    // Análisis de quilates
    caratAnalysis: Array<{
      caratRange: string;
      sales: number;
      revenue: number;
      units: number;
      avgPrice: number;
    }>;
    
    // Análisis de tallas de anillos
    ringSizeAnalysis: Array<{
      size: string;
      sales: number;
      units: number;
      percentage: number;
    }>;
    
    // Análisis de longitud de cadenas
    chainLengthAnalysis: Array<{
      length: string;
      sales: number;
      units: number;
      avgPrice: number;
    }>;
    
    // Top joyas más vendidas
    topJewelry: Array<{
      name: string;
      category: string;
      sales: number;
      revenue: number;
      units: number;
      metal: string;
      stone?: string;
    }>;
    
    // Análisis de acabados
    finishAnalysis: Array<{
      finish: string;
      sales: number;
      revenue: number;
      units: number;
      preference: number;
    }>;
    
    // Análisis de garantías
    warrantyAnalysis: Array<{
      warrantyMonths: number;
      sales: number;
      revenue: number;
      units: number;
      avgPrice: number;
    }>;
    
    // Piezas únicas vs regulares
    uniquePiecesAnalysis: {
      unique: { sales: number; revenue: number; units: number; avgPrice: number };
      regular: { sales: number; revenue: number; units: number; avgPrice: number };
    };
    
    // Análisis de baños/recubrimientos
    platingAnalysis: Array<{
      plating: string;
      sales: number;
      revenue: number;
      units: number;
      avgPrice: number;
    }>;
    
    // Correlación peso-precio
    weightPriceCorrelation: Array<{
      weight: number;
      price: number;
      category: string;
      metal: string;
    }>;
  };
}

const JEWELRY_COLORS = [
  '#FFD700', // Oro
  '#C0C0C0', // Plata
  '#E5E4E2', // Platino
  '#FF6B6B', // Rubí
  '#4ECDC4', // Esmeralda
  '#45B7D1', // Zafiro
  '#96CEB4', // Jade
  '#FFEAA7', // Topacio
  '#DDA0DD', // Amatista
  '#F39C12', // Ámbar
  '#E74C3C', // Coral
  '#3498DB', // Aguamarina
  '#9B59B6', // Violeta
  '#1ABC9C', // Turquesa
  '#F1C40F', // Citrino
  '#E67E22', // Granate
  '#2ECC71', // Peridoto
  '#34495E', // Hematita
  '#95A5A6', // Perla
  '#D35400'  // Ópalo
];

export const JewelryCharts: React.FC<JewelryChartsProps> = ({ jewelryData }) => {
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

  const formatWeight = (value: number) => {
    return `${value.toFixed(1)}g`;
  };



  return (
    <div className="space-y-6">
      {/* 1. Ventas por Categoría de Joyería */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <Crown className="h-5 w-5 text-yellow-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Ventas por Categoría de Joyería</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <BarChart data={jewelryData.salesByCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              name === 'revenue' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
              name === 'revenue' ? 'Ingresos' : name === 'units' ? 'Unidades' : 'Ventas'
            ]} />
            <Legend />
            <Bar dataKey="revenue" fill={JEWELRY_COLORS[0]} name="Ingresos" />
            <Bar dataKey="units" fill={JEWELRY_COLORS[1]} name="Unidades" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Distribución por Tipo de Metal */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <Gem className="h-5 w-5 text-yellow-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Distribución por Tipo de Metal</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <PieChart>
            <Pie
              data={jewelryData.salesByMetal}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ metal, percentage }) => `${metal} ${Number(percentage || 0).toFixed(1)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="revenue"
            >
              {jewelryData.salesByMetal.map((entry, index) => (
                <Cell key={getStableKey(entry.metal, entry.revenue)} fill={JEWELRY_COLORS[index % JEWELRY_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Ingresos']} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 3. Análisis por Pureza de Metal */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <Star className="h-5 w-5 text-yellow-400 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Ventas por Pureza de Metal</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <AreaChart data={jewelryData.salesByPurity}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="purity" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              name === 'revenue' ? formatCurrency(Number(value)) : 
              name === 'avgWeight' ? formatWeight(Number(value)) : formatNumber(Number(value)),
              name === 'revenue' ? 'Ingresos' : 
              name === 'avgWeight' ? 'Peso Promedio' : 'Unidades'
            ]} />
            <Legend />
            <Area type="monotone" dataKey="revenue" stackId="1" stroke={JEWELRY_COLORS[2]} fill={JEWELRY_COLORS[2]} />
            <Area type="monotone" dataKey="units" stackId="2" stroke={JEWELRY_COLORS[3]} fill={JEWELRY_COLORS[3]} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Análisis por Tipo de Piedra */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <Diamond className="h-5 w-5 text-blue-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Ventas por Tipo de Piedra</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" data={jewelryData.salesByStone}>
            <RadialBar label={{ position: 'insideStart', fill: '#fff' }} background dataKey="revenue" />
            <Legend iconSize={18} layout="vertical" verticalAlign="middle" wrapperStyle={{ paddingLeft: '20px' }} />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Ingresos']} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      {/* 5. Distribución por Rango de Peso */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="h-5 w-5 text-green-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Ventas por Rango de Peso</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <ComposedChart data={jewelryData.salesByWeight}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="weightRange" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={(value, name) => [
              name === 'revenue' ? formatCurrency(Number(value)) : 
              name === 'avgPrice' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
              name === 'revenue' ? 'Ingresos' : 
              name === 'avgPrice' ? 'Precio Promedio' : 'Unidades'
            ]} />
            <Legend />
            <Bar yAxisId="left" dataKey="units" fill={JEWELRY_COLORS[4]} name="Unidades" />
            <Line yAxisId="right" type="monotone" dataKey="avgPrice" stroke={JEWELRY_COLORS[5]} name="Precio Promedio" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 6. Segmentación por Rango de Precio */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-purple-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Segmentación por Rango de Precio</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <PieChart>
            <Pie
              data={jewelryData.salesByPriceRange}
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#8884d8"
              dataKey="percentage"
              label={({ priceRange, percentage }) => `${priceRange}: ${percentage}%`}
            >
              {jewelryData.salesByPriceRange.map((entry, index) => (
                <Cell key={getStableKey(entry.priceRange, entry.percentage)} fill={JEWELRY_COLORS[index % JEWELRY_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value}%`, 'Porcentaje']} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 7. Preferencias por Género */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Heart className="h-5 w-5 text-pink-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Preferencias por Género</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <BarChart data={jewelryData.salesByGender} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="gender" type="category" />
            <Tooltip formatter={(value, name) => [
              name === 'revenue' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
              name === 'revenue' ? 'Ingresos' : 'Unidades'
            ]} />
            <Legend />
            <Bar dataKey="revenue" fill={JEWELRY_COLORS[6]} name="Ingresos" />
            <Bar dataKey="units" fill={JEWELRY_COLORS[7]} name="Unidades" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 8. Rendimiento por Colección */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Award className="h-5 w-5 text-orange-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Rendimiento por Colección</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <AreaChart data={jewelryData.salesByCollection}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="collection" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              name === 'revenue' ? formatCurrency(Number(value)) : 
              name === 'avgPrice' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
              name === 'revenue' ? 'Ingresos' : 
              name === 'avgPrice' ? 'Precio Promedio' : 'Unidades'
            ]} />
            <Legend />
            <Area type="monotone" dataKey="revenue" stroke={JEWELRY_COLORS[8]} fill={JEWELRY_COLORS[8]} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 9. Análisis de Márgenes por Categoría */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Márgenes de Ganancia por Categoría</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <ComposedChart data={jewelryData.marginsByCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={(value, name) => [
              name === 'marginPercent' ? `${Number(value).toFixed(1)}%` : formatCurrency(Number(value)),
              name === 'marginPercent' ? 'Margen %' : 
              name === 'revenue' ? 'Ingresos' : 'Costo'
            ]} />
            <Legend />
            <Bar yAxisId="left" dataKey="revenue" fill={JEWELRY_COLORS[9]} name="Ingresos" />
            <Bar yAxisId="left" dataKey="cost" fill={JEWELRY_COLORS[10]} name="Costo" />
            <Line yAxisId="right" type="monotone" dataKey="marginPercent" stroke={JEWELRY_COLORS[11]} name="Margen %" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 10. Valor de Inventario por Categoría */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <PieChartIcon className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Valor de Inventario por Categoría</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <BarChart data={jewelryData.inventoryValue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Valor Total']} />
            <Legend />
            <Bar dataKey="totalValue" fill={JEWELRY_COLORS[0]} name="Valor de Inventario" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 11. Tendencias Estacionales */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Sparkles className="h-5 w-5 text-cyan-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Tendencias Estacionales por Categoría</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <LineChart data={jewelryData.seasonalTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Ventas']} />
            <Legend />
            <Line type="monotone" dataKey="anillos" stroke={JEWELRY_COLORS[12]} name="Anillos" />
            <Line type="monotone" dataKey="collares" stroke={JEWELRY_COLORS[13]} name="Collares" />
            <Line type="monotone" dataKey="aretes" stroke={JEWELRY_COLORS[14]} name="Aretes" />
            <Line type="monotone" dataKey="pulseras" stroke={JEWELRY_COLORS[15]} name="Pulseras" />
            <Line type="monotone" dataKey="relojes" stroke={JEWELRY_COLORS[16]} name="Relojes" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 12. Análisis de Quilates */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Diamond className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Distribución por Quilates de Piedras</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <BarChart data={jewelryData.caratAnalysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="caratRange" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              name === 'revenue' ? formatCurrency(Number(value)) : 
              name === 'avgPrice' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
              name === 'revenue' ? 'Ingresos' : 
              name === 'avgPrice' ? 'Precio Promedio' : 'Unidades'
            ]} />
            <Legend />
            <Bar dataKey="revenue" fill={JEWELRY_COLORS[17]} name="Ingresos" />
            <Bar dataKey="units" fill={JEWELRY_COLORS[18]} name="Unidades" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 13. Análisis de Tallas de Anillos */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Crown className="h-5 w-5 text-yellow-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Distribución de Tallas de Anillos</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <AreaChart data={jewelryData.ringSizeAnalysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="size" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              name === 'percentage' ? `${Number(value)}%` : formatNumber(Number(value)),
              name === 'percentage' ? 'Porcentaje' : 'Unidades'
            ]} />
            <Legend />
            <Area type="monotone" dataKey="units" stroke={JEWELRY_COLORS[19]} fill={JEWELRY_COLORS[19]} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 14. Análisis de Longitud de Cadenas */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Zap className="h-5 w-5 text-purple-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Preferencias de Longitud de Cadenas</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <ComposedChart data={jewelryData.chainLengthAnalysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="length" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={(value, name) => [
              name === 'avgPrice' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
              name === 'avgPrice' ? 'Precio Promedio' : 'Unidades'
            ]} />
            <Legend />
            <Bar yAxisId="left" dataKey="units" fill={JEWELRY_COLORS[0]} name="Unidades" />
            <Line yAxisId="right" type="monotone" dataKey="avgPrice" stroke={JEWELRY_COLORS[1]} name="Precio Promedio" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 15. Top Joyas Más Vendidas */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Star className="h-5 w-5 text-yellow-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Top 10 Joyas Más Vendidas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joya</th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metal</th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Piedra</th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unidades</th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jewelryData.topJewelry.slice(0, 10).map((item, index) => (
                <tr key={getStableKey(item.name, item.category, item.metal, item.stone, item.units, item.revenue)} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-500">{typeof item.category === 'string' ? item.category : (item as any)?.category?.name ?? '(Sin categoría)'}</td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-500">{item.metal}</td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-500">{item.stone || 'Sin piedra'}</td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-500 text-right">{formatNumber(item.units)}</td>
                  <td className="px-4 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 16. Análisis de Acabados */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Sparkles className="h-5 w-5 text-pink-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Preferencias de Acabados</h3>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(420, Math.round(window.innerHeight * 0.4)))}>
          <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={jewelryData.finishAnalysis}>
            <RadialBar label={{ fill: '#666', position: 'insideStart' }} background dataKey="preference" />
            <Legend iconSize={18} layout="vertical" verticalAlign="middle" />
            <Tooltip formatter={(value) => [`${value}%`, 'Preferencia']} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      {/* 17. Análisis de Garantías */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Award className="h-5 w-5 text-green-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Distribución por Período de Garantía</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={jewelryData.warrantyAnalysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="warrantyMonths" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              name === 'avgPrice' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
              name === 'avgPrice' ? 'Precio Promedio' : 'Unidades'
            ]} />
            <Legend />
            <Area type="monotone" dataKey="units" stroke={JEWELRY_COLORS[2]} fill={JEWELRY_COLORS[2]} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 18. Piezas Únicas vs Regulares */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Diamond className="h-5 w-5 text-purple-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Piezas Únicas vs Regulares</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center">
            <h4 className="text-lg font-medium text-gray-900 mb-2">Piezas Únicas</h4>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(jewelryData.uniquePiecesAnalysis.unique.revenue)}</p>
              <p className="text-sm text-gray-500">Ingresos</p>
              <p className="text-lg font-semibold">{formatNumber(jewelryData.uniquePiecesAnalysis.unique.units)} unidades</p>
              <p className="text-sm text-gray-500">Precio promedio: {formatCurrency(jewelryData.uniquePiecesAnalysis.unique.avgPrice)}</p>
            </div>
          </div>
          <div className="text-center">
            <h4 className="text-lg font-medium text-gray-900 mb-2">Piezas Regulares</h4>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(jewelryData.uniquePiecesAnalysis.regular.revenue)}</p>
              <p className="text-sm text-gray-500">Ingresos</p>
              <p className="text-lg font-semibold">{formatNumber(jewelryData.uniquePiecesAnalysis.regular.units)} unidades</p>
              <p className="text-sm text-gray-500">Precio promedio: {formatCurrency(jewelryData.uniquePiecesAnalysis.regular.avgPrice)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 19. Análisis de Baños/Recubrimientos */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Gem className="h-5 w-5 text-orange-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Ventas por Tipo de Baño/Recubrimiento</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={jewelryData.platingAnalysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="plating" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              name === 'revenue' ? formatCurrency(Number(value)) : 
              name === 'avgPrice' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
              name === 'revenue' ? 'Ingresos' : 
              name === 'avgPrice' ? 'Precio Promedio' : 'Unidades'
            ]} />
            <Legend />
            <Bar dataKey="revenue" fill={JEWELRY_COLORS[3]} name="Ingresos" />
            <Bar dataKey="units" fill={JEWELRY_COLORS[4]} name="Unidades" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 20. Correlación Peso-Precio */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-red-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Correlación Peso vs Precio</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart data={jewelryData.weightPriceCorrelation}>
            <CartesianGrid />
            <XAxis type="number" dataKey="weight" name="Peso (g)" />
            <YAxis type="number" dataKey="price" name="Precio" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} 
              formatter={(value, name) => [
                name === 'price' ? formatCurrency(Number(value)) : formatWeight(Number(value)),
                name === 'price' ? 'Precio' : 'Peso'
              ]} 
            />
            <Scatter name="Joyas" data={jewelryData.weightPriceCorrelation} fill={JEWELRY_COLORS[5]} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default JewelryCharts;
