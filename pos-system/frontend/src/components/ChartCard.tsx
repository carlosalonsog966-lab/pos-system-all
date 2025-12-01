import React from 'react';
import { ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onExportPNG?: () => void;
  className?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({ 
  title, 
  subtitle, 
  children, 
  onExportPNG,
  className = ''
}) => {
  return (
    <div className={`card p-6 ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-display text-xl font-semibold text-text-warm mb-1">
            {title}
          </h3>
          {subtitle && (
            <p className="font-ui text-sm text-[#8F8F8F]">
              {subtitle}
            </p>
          )}
        </div>
        {onExportPNG && (
          <button
            onClick={onExportPNG}
            className="btn-ghost px-3 py-2 text-sm flex items-center gap-2"
          >
            <Download size={16} />
            Exportar PNG
          </button>
        )}
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartCard;