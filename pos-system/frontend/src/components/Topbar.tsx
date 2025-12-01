import React, { useEffect, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { api } from '@/lib/api';
import HealthStatus from '@/components/Common/HealthStatus';

interface TopbarProps {
  title: string;
  showSyncToast?: boolean;
  onSyncToastClose?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ title, showSyncToast = false, onSyncToastClose }) => {
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [stores, setStores] = useState<string[]>([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await api.get('/branches', { params: { isActive: true }, __suppressGlobalError: true } as any);
        const branchNames: string[] = (response.data?.data || response.data || [])
          .map((b: any) => b.name)
          .filter((name: string) => !!name);

        setStores(branchNames);
        if (branchNames.length > 0) {
          setSelectedStore(branchNames[0]);
        }
      } catch (error) {
        // Si falla la carga de sucursales, dejamos el selector vacío
        setStores([]);
      }
    };

    fetchBranches();
  }, []);

  return (
    <div className="h-14 bg-base-porcelain border-b border-line-soft px-6 flex items-center justify-between">
      <h1 className="title-display text-3xl text-text-warm">{title}</h1>
      
      <div className="flex items-center gap-4">
        {/* Indicador de salud del backend */}
        <HealthStatus />
        {/* Toast de sincronización */}
        {showSyncToast && (
          <div className="bg-success-600 text-white rounded-lg px-3 h-8 flex items-center gap-2 animate-fade-in">
            <Check size={16} />
            <span className="text-sm font-medium">Sincronización completada</span>
            <button 
              onClick={onSyncToastClose}
              className="ml-2 text-white/80 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Selector de tienda */}
        {stores.length > 0 ? (
          <div className="relative">
            <button
              onClick={() => setShowStoreSelector(!showStoreSelector)}
              className="flex items-center gap-2 px-3 py-2 bg-base-ivory border border-line-soft rounded-lg hover:bg-[#F0E7D9] transition-colors"
            >
              <span className="font-ui text-sm text-text-warm">{selectedStore}</span>
              <ChevronDown size={16} className="text-text-warm" />
            </button>

            {showStoreSelector && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-base-ivory border border-line-soft rounded-lg shadow-panel z-50">
                {stores.map((store) => (
                  <button
                    key={store}
                    onClick={() => {
                      setSelectedStore(store);
                      setShowStoreSelector(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F0E7D9] first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    <span className="font-ui text-sm text-text-warm">{store}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-3 py-2 bg-base-ivory border border-line-soft rounded-lg text-text-muted text-sm">
            Sin sucursales disponibles
          </div>
        )}
      </div>
    </div>
  );
};

export default Topbar;
