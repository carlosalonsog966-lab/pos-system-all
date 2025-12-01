import React from 'react';
import { getStableKey } from '@/lib/utils';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface KPIData {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  sparklineData: Array<{ value: number }>;
}

interface KPIGroupProps {
  kpis: KPIData[];
}

const KPIGroup: React.FC<KPIGroupProps> = ({ kpis }) => {
  const getTrendColor = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-success-600';
      case 'down':
        return 'text-danger-600';
      default:
        return 'text-[#8F8F8F]';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <div key={getStableKey(kpi.title, kpi.value, kpi.change, kpi.trend)} className="card p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h4 className="font-ui text-sm text-[#8F8F8F] mb-1">
                {kpi.title}
              </h4>
              <div className="font-display text-2xl font-semibold text-text-warm mb-1">
                {kpi.value}
              </div>
              {kpi.change && (
                <div className={`font-ui text-sm ${getTrendColor(kpi.trend)}`}>
                  {kpi.change}
                </div>
              )}
            </div>
            <div className="w-16 h-12 ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={kpi.sparklineData}>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--graph-1)"
                    fill="var(--graph-1)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPIGroup;
