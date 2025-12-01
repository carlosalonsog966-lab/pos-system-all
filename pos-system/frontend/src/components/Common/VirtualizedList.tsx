import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  containerHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  scrollToIndex?: number;
  scrollToAlignment?: 'start' | 'center' | 'end' | 'auto';
  estimatedItemSize?: number;
  getItemKey?: (index: number, item: T) => string | number;
}

interface VirtualizedListState {
  scrollTop: number;
  isScrolling: boolean;
  scrollDirection: 'forward' | 'backward';
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  scrollToIndex,
  scrollToAlignment = 'auto',
  // estimatedItemSize = 50,
  getItemKey,
}: VirtualizedListProps<T>) {
  const [state, setState] = useState<VirtualizedListState>({
    scrollTop: 0,
    isScrolling: false,
    scrollDirection: 'forward',
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const itemSizeCache = useRef<Map<number, number>>(new Map());
  const itemOffsetCache = useRef<Map<number, number>>(new Map());

  // Función para obtener el tamaño de un item
  const getItemSize = useCallback((index: number): number => {
    if (typeof itemHeight === 'number') {
      return itemHeight;
    }

    // Verificar caché primero
    const cached = itemSizeCache.current.get(index);
    if (cached !== undefined) {
      return cached;
    }

    // Calcular y cachear
    const size = itemHeight(index, items[index]);
    itemSizeCache.current.set(index, size);
    return size;
  }, [itemHeight, items]);

  // Función para obtener el offset de un item
  const getItemOffset = useCallback((index: number): number => {
    if (index === 0) return 0;

    // Verificar caché primero
    const cached = itemOffsetCache.current.get(index);
    if (cached !== undefined) {
      return cached;
    }

    // Calcular offset acumulativo
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemSize(i);
    }

    itemOffsetCache.current.set(index, offset);
    return offset;
  }, [getItemSize]);

  // Calcular el tamaño total de la lista
  const totalSize = useMemo(() => {
    if (typeof itemHeight === 'number') {
      return items.length * itemHeight;
    }

    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += getItemSize(i);
    }
    return total;
  }, [items.length, itemHeight, getItemSize]);

  // Encontrar el índice del primer item visible
  const findStartIndex = useCallback((scrollTop: number): number => {
    if (typeof itemHeight === 'number') {
      return Math.floor(scrollTop / itemHeight);
    }

    // Búsqueda binaria para tamaños variables
    let low = 0;
    let high = items.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const offset = getItemOffset(mid);

      if (offset === scrollTop) {
        return mid;
      } else if (offset < scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return Math.max(0, high);
  }, [itemHeight, items.length, getItemOffset]);

  // Encontrar el índice del último item visible
  const findEndIndex = useCallback((startIndex: number, scrollTop: number): number => {
    const visibleHeight = containerHeight;
    let currentOffset = getItemOffset(startIndex);
    let index = startIndex;

    while (index < items.length && currentOffset < scrollTop + visibleHeight) {
      currentOffset += getItemSize(index);
      index++;
    }

    return Math.min(items.length - 1, index);
  }, [containerHeight, getItemOffset, getItemSize, items.length]);

  // Calcular los items visibles
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, findStartIndex(state.scrollTop) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      findEndIndex(startIndex + overscan, state.scrollTop) + overscan
    );

    return { startIndex, endIndex };
  }, [state.scrollTop, findStartIndex, findEndIndex, overscan, items.length]);

  // Manejar scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    const scrollLeft = event.currentTarget.scrollLeft;

    setState(prevState => ({
      ...prevState,
      scrollTop,
      isScrolling: true,
      scrollDirection: scrollTop > prevState.scrollTop ? 'forward' : 'backward',
    }));

    onScroll?.(scrollTop, scrollLeft);

    // Limpiar el timeout anterior
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Establecer isScrolling a false después de un delay
    scrollTimeoutRef.current = setTimeout(() => {
      setState(prevState => ({
        ...prevState,
        isScrolling: false,
      }));
    }, 150);
  }, [onScroll]);

  // Scroll programático
  const scrollToItem = useCallback((index: number, alignment: string = 'auto') => {
    if (!containerRef.current || index < 0 || index >= items.length) return;

    const itemOffset = getItemOffset(index);
    const itemSize = getItemSize(index);
    const containerScrollTop = state.scrollTop;
    const containerHeight = containerRef.current.clientHeight;

    let scrollTop: number;

    switch (alignment) {
      case 'start':
        scrollTop = itemOffset;
        break;
      case 'end':
        scrollTop = itemOffset + itemSize - containerHeight;
        break;
      case 'center':
        scrollTop = itemOffset + itemSize / 2 - containerHeight / 2;
        break;
      default: // 'auto'
        if (itemOffset < containerScrollTop) {
          scrollTop = itemOffset;
        } else if (itemOffset + itemSize > containerScrollTop + containerHeight) {
          scrollTop = itemOffset + itemSize - containerHeight;
        } else {
          return; // Ya está visible
        }
    }

    containerRef.current.scrollTop = Math.max(0, Math.min(scrollTop, totalSize - containerHeight));
  }, [getItemOffset, getItemSize, state.scrollTop, totalSize]);

  // Efecto para scroll programático
  useEffect(() => {
    if (scrollToIndex !== undefined) {
      scrollToItem(scrollToIndex, scrollToAlignment);
    }
  }, [scrollToIndex, scrollToAlignment, scrollToItem]);

  // Limpiar caché cuando cambian los items
  useEffect(() => {
    itemSizeCache.current.clear();
    itemOffsetCache.current.clear();
  }, [items]);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Renderizar items visibles
  const visibleItems = useMemo(() => {
    const items_to_render = [];

    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      const item = items[i];
      const offset = getItemOffset(i);
      const size = getItemSize(i);

      const style: React.CSSProperties = {
        position: 'absolute',
        top: offset,
        left: 0,
        width: '100%',
        height: size,
      };

      const key = getItemKey ? getItemKey(i, item) : i;

      items_to_render.push(
        <div key={key} style={style}>
          {renderItem(item, i, style)}
        </div>
      );
    }

    return items_to_render;
  }, [visibleRange, items, getItemOffset, getItemSize, renderItem, getItemKey]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalSize,
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
}

// Hook para usar con VirtualizedList
export function useVirtualizedList<T>(
  items: T[],
  options: {
    itemHeight: number | ((index: number, item: T) => number);
    containerHeight: number;
    overscan?: number;
  }
) {
  const [scrollToIndex, setScrollToIndex] = useState<number>();
  const [isScrolling, setIsScrolling] = useState(false);

  const scrollToItem = useCallback((index: number, _alignment?: 'start' | 'center' | 'end' | 'auto') => {
    setScrollToIndex(index);
  }, []);

  const handleScroll = useCallback((_scrollTop: number) => {
    setIsScrolling(true);
    
    // Debounce para detectar cuando termina el scroll
    const timeoutId = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, []);

  return {
    scrollToItem,
    scrollToIndex,
    isScrolling,
    handleScroll,
    listProps: {
      items,
      ...options,
      scrollToIndex,
      onScroll: handleScroll,
    },
  };
}

// Componente especializado para listas de productos
export const VirtualizedProductList: React.FC<{
  products: any[];
  onProductClick: (product: any) => void;
  containerHeight: number;
  className?: string;
}> = ({ products, onProductClick, containerHeight, className }) => {
  const renderProduct = useCallback((product: any, _index: number, _style: React.CSSProperties) => (
    <div
      className="flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
      onClick={() => onProductClick(product)}
    >
      <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-lg mr-4">
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover rounded-lg"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {product.name}
        </h3>
        <p className="text-sm text-gray-500 truncate">
          {product.category}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-medium text-gray-900">
          ${product.price?.toFixed(2)}
        </p>
        <p className="text-xs text-gray-500">
          Stock: {product.stock}
        </p>
      </div>
    </div>
  ), [onProductClick]);

  return (
    <VirtualizedList
      items={products}
      itemHeight={80}
      containerHeight={containerHeight}
      renderItem={renderProduct}
      className={className}
      getItemKey={(index, product) => product.id || index}
    />
  );
};

// Componente especializado para listas de ventas
export const VirtualizedSalesList: React.FC<{
  sales: any[];
  onSaleClick: (sale: any) => void;
  containerHeight: number;
  className?: string;
}> = ({ sales, onSaleClick, containerHeight, className }) => {
  const renderSale = useCallback((sale: any, _index: number, _style: React.CSSProperties) => (
    <div
      className="flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
      onClick={() => onSaleClick(sale)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            Venta #{sale.id}
          </h3>
          <span className={`px-2 py-1 text-xs rounded-full ${
            sale.status === 'completed' ? 'bg-green-100 text-green-800' :
            sale.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {sale.status}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {sale.client?.name || 'Cliente anónimo'}
        </p>
        <p className="text-xs text-gray-400">
          {new Date(sale.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-medium text-gray-900">
          ${sale.total?.toFixed(2)}
        </p>
        <p className="text-xs text-gray-500">
          {sale.items?.length || 0} items
        </p>
      </div>
    </div>
  ), [onSaleClick]);

  return (
    <VirtualizedList
      items={sales}
      itemHeight={90}
      containerHeight={containerHeight}
      renderItem={renderSale}
      className={className}
      getItemKey={(index, sale) => sale.id || index}
    />
  );
};

export default VirtualizedList;