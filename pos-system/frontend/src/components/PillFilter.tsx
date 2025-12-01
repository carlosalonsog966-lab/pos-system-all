import React from 'react';
import { JEWELRY_CATEGORIES } from '../constants/jewelry';

interface PillFilterProps {
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

const PillFilter: React.FC<PillFilterProps> = ({ activeFilter = 'todos', onFilterChange }) => {
  const filters = [
    { id: 'todos', label: 'Todos' },
    ...JEWELRY_CATEGORIES.map(category => ({
      id: category.toLowerCase(),
      label: category
    }))
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id;
        
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange?.(filter.id)}
            className={`badge transition-colors ${
              isActive 
                ? 'border-brand-gold text-text-warm bg-[#F0E7D9]' 
                : 'border-line-soft text-[#8F8F8F] hover:border-brand-gold hover:text-text-warm'
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
};

export default PillFilter;