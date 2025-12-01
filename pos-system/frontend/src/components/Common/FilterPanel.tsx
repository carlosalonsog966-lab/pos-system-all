import React, { useState } from 'react';
import { 
  FunnelIcon, 
  XMarkIcon, 
  ChevronDownIcon,
  ChevronUpIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

export interface FilterOption {
  id: string;
  label: string;
  value: any;
  count?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'range' | 'date' | 'boolean';
  options?: FilterOption[];
  value?: any;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

interface FilterPanelProps {
  filters: FilterGroup[];
  onFilterChange: (filterId: string, value: any) => void;
  onClearAll: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeFiltersCount?: number;
  className?: string;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  onClearAll,
  isCollapsed = false,
  onToggleCollapse,
  activeFiltersCount = 0,
  className = ''
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const renderFilterInput = (filter: FilterGroup) => {
    switch (filter.type) {
      case 'select':
        return (
          <select
            value={filter.value || ''}
            onChange={(e) => onFilterChange(filter.id, e.target.value)}
            className="w-full px-3 py-2 border border-line-soft rounded-md bg-white text-text-warm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold transition-colors"
          >
            <option value="">{filter.placeholder || 'Seleccionar...'}</option>
            {filter.options?.map((option) => (
              <option key={option.id} value={option.value}>
                {option.label} {option.count !== undefined && `(${option.count})`}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filter.options?.map((option) => (
              <label key={option.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Array.isArray(filter.value) && filter.value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(filter.value) ? filter.value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter(v => v !== option.value);
                    onFilterChange(filter.id, newValues);
                  }}
                  className="rounded border-line-soft text-brand-gold focus:ring-brand-gold"
                />
                <span className="text-sm text-text-warm">
                  {option.label} {option.count !== undefined && `(${option.count})`}
                </span>
              </label>
            ))}
          </div>
        );

      case 'range':
        return (
          <div className="space-y-2">
            <div className="flex space-x-2">
              <input
                type="number"
                placeholder="Mín"
                value={filter.value?.min || ''}
                onChange={(e) => onFilterChange(filter.id, { 
                  ...filter.value, 
                  min: e.target.value ? Number(e.target.value) : undefined 
                })}
                min={filter.min}
                max={filter.max}
                step={filter.step}
                className="flex-1 px-3 py-2 border border-line-soft rounded-md bg-white text-text-warm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold transition-colors"
              />
              <input
                type="number"
                placeholder="Máx"
                value={filter.value?.max || ''}
                onChange={(e) => onFilterChange(filter.id, { 
                  ...filter.value, 
                  max: e.target.value ? Number(e.target.value) : undefined 
                })}
                min={filter.min}
                max={filter.max}
                step={filter.step}
                className="flex-1 px-3 py-2 border border-line-soft rounded-md bg-white text-text-warm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold transition-colors"
              />
            </div>
          </div>
        );

      case 'date':
        return (
          <div className="space-y-2">
            <div className="flex space-x-2">
              <input
                type="date"
                value={filter.value?.from || ''}
                onChange={(e) => onFilterChange(filter.id, { 
                  ...filter.value, 
                  from: e.target.value 
                })}
                className="flex-1 px-3 py-2 border border-line-soft rounded-md bg-white text-text-warm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold transition-colors"
              />
              <input
                type="date"
                value={filter.value?.to || ''}
                onChange={(e) => onFilterChange(filter.id, { 
                  ...filter.value, 
                  to: e.target.value 
                })}
                className="flex-1 px-3 py-2 border border-line-soft rounded-md bg-white text-text-warm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold transition-colors"
              />
            </div>
          </div>
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.value || false}
              onChange={(e) => onFilterChange(filter.id, e.target.checked)}
              className="rounded border-line-soft text-brand-gold focus:ring-brand-gold"
            />
            <span className="text-sm text-text-warm">
              {filter.placeholder || 'Activar filtro'}
            </span>
          </label>
        );

      default:
        return null;
    }
  };

  if (isCollapsed) {
    return (
      <div className={`bg-white border border-line-soft rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-text-muted" />
            <span className="text-sm font-medium text-text-warm">Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="bg-brand-gold text-white text-xs px-2 py-1 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {activeFiltersCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-text-muted hover:text-text-warm transition-colors"
              >
                Limpiar
              </button>
            )}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="text-text-muted hover:text-text-warm transition-colors"
              >
                <AdjustmentsHorizontalIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-line-soft rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-line-soft">
        <div className="flex items-center space-x-2">
          <FunnelIcon className="h-5 w-5 text-text-muted" />
          <h3 className="text-lg font-semibold text-text-warm">Filtros</h3>
          {activeFiltersCount > 0 && (
            <span className="bg-brand-gold text-white text-xs px-2 py-1 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearAll}
              className="text-sm text-text-muted hover:text-text-warm transition-colors flex items-center space-x-1"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Limpiar todo</span>
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-text-muted hover:text-text-warm transition-colors"
            >
              <ChevronUpIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Groups */}
      <div className="p-4 space-y-4">
        {filters.map((filter) => (
          <div key={filter.id} className="border-b border-line-soft last:border-b-0 pb-4 last:pb-0">
            <button
              onClick={() => toggleGroup(filter.id)}
              className="flex items-center justify-between w-full text-left mb-3"
            >
              <span className="text-sm font-medium text-text-warm">{filter.label}</span>
              {expandedGroups.has(filter.id) ? (
                <ChevronUpIcon className="h-4 w-4 text-text-muted" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-text-muted" />
              )}
            </button>
            
            {expandedGroups.has(filter.id) && (
              <div className="space-y-2">
                {renderFilterInput(filter)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterPanel;