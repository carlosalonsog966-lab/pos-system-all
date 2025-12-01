import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  CreditCard, 
  BarChart3, 
  RefreshCw, 
  Settings 
} from 'lucide-react';

interface SidebarNavProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({ activeItem = 'dashboard', onItemClick }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'productos', label: 'Joyas', icon: Package },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'caja', label: 'Caja', icon: CreditCard },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 },
    { id: 'sync', label: 'Sync', icon: RefreshCw },
    { id: 'ajustes', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className="w-[280px] bg-base-ivory border-r border-line-soft p-4 h-full">
      <div className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onItemClick?.(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                isActive 
                  ? 'bg-[#F0E7D9] text-text-warm' 
                  : 'text-[#8F8F8F] hover:bg-[#F0E7D9] hover:text-text-warm'
              }`}
            >
              <Icon 
                size={20} 
                className={isActive ? 'text-brand-gold' : 'text-[#8F8F8F]'} 
              />
              <span className="font-ui font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SidebarNav;