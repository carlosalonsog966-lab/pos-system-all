import React, { useState } from 'react';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useRankingStore } from '@/store/rankingStore';

const PeriodSelector: React.FC = () => {
  const {
    currentPeriod,
    customPeriod,
    setCurrentPeriod,
    setCustomPeriod,
    loadRankings
  } = useRankingStore();

  const [tempCustomPeriod, setTempCustomPeriod] = useState({
    startDate: customPeriod?.startDate || '',
    endDate: customPeriod?.endDate || ''
  });

  const handlePeriodChange = (period: 'weekly' | 'monthly' | 'custom') => {
    setCurrentPeriod(period);
    if (period !== 'custom') {
      loadRankings();
    }
  };

  const handleCustomPeriodApply = () => {
    if (tempCustomPeriod.startDate && tempCustomPeriod.endDate) {
      setCustomPeriod(tempCustomPeriod);
      loadRankings();
    }
  };

  const isCustomPeriodValid = tempCustomPeriod.startDate && tempCustomPeriod.endDate;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <ClockIcon className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900">Período de Análisis</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Selector de período */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Tipo de Período
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="period"
                value="weekly"
                checked={currentPeriod === 'weekly'}
                onChange={() => handlePeriodChange('weekly')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Esta Semana</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="period"
                value="monthly"
                checked={currentPeriod === 'monthly'}
                onChange={() => handlePeriodChange('monthly')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Este Mes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="period"
                value="custom"
                checked={currentPeriod === 'custom'}
                onChange={() => handlePeriodChange('custom')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Período Personalizado</span>
            </label>
          </div>
        </div>

        {/* Fechas personalizadas */}
        {currentPeriod === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Inicio
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tempCustomPeriod.startDate}
                  onChange={(e) => setTempCustomPeriod(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Fin
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tempCustomPeriod.endDate}
                  onChange={(e) => setTempCustomPeriod(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Botón aplicar para período personalizado */}
      {currentPeriod === 'custom' && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCustomPeriodApply}
            disabled={!isCustomPeriodValid}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              isCustomPeriodValid
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Aplicar Período
          </button>
        </div>
      )}
    </div>
  );
};

export default PeriodSelector;