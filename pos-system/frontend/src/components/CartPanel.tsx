import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartPanelProps {
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  onUpdateQuantity?: (id: string, quantity: number) => void;
  onRemoveItem?: (id: string) => void;
  onCheckout?: () => void;
  onSaveOffline?: () => void;
  onSync?: () => void;
}

const CartPanel: React.FC<CartPanelProps> = ({
  items,
  subtotal,
  discount,
  tax,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onSaveOffline,
  onSync
}) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  return (
    <div className="card w-[380px] p-4 h-fit">
      <h3 className="title-display text-xl text-text-warm mb-4">Carrito de Compras</h3>
      
      {/* Lista de items */}
      <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-2 bg-white rounded-lg">
            {item.image && (
              <img 
                src={item.image} 
                alt={item.name}
                className="w-10 h-10 rounded-md object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-ui font-medium text-sm text-text-charcoal truncate">
                {item.name}
              </div>
              <div className="font-ui text-xs text-[#8F8F8F]">
                {item.sku}
              </div>
              <div className="font-ui text-sm text-text-warm font-medium">
                {formatPrice(item.price)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateQuantity?.(item.id, Math.max(0, item.quantity - 1))}
                className="w-6 h-6 rounded-full bg-line-soft flex items-center justify-center hover:bg-brand-gold hover:text-white transition-colors"
              >
                <Minus size={12} />
              </button>
              <span className="w-8 text-center font-ui text-sm font-medium">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity?.(item.id, item.quantity + 1)}
                className="w-6 h-6 rounded-full bg-line-soft flex items-center justify-center hover:bg-brand-gold hover:text-white transition-colors"
              >
                <Plus size={12} />
              </button>
              <button
                onClick={() => onRemoveItem?.(item.id)}
                className="w-6 h-6 rounded-full bg-danger-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors ml-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        
        {items.length === 0 && (
          <div className="text-center py-8 text-[#8F8F8F] font-ui">
            Carrito vacío
          </div>
        )}
      </div>

      {/* Totales */}
      <div className="space-y-2 mb-4 pt-4 border-t border-line-soft">
        <div className="flex justify-between font-ui text-sm">
          <span className="text-[#8F8F8F]">Subtotal:</span>
          <span className="text-text-charcoal">{formatPrice(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between font-ui text-sm">
            <span className="text-[#8F8F8F]">Descuento:</span>
            <span className="text-danger-600">-{formatPrice(discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-ui text-sm">
          <span className="text-[#8F8F8F]">Impuesto:</span>
          <span className="text-text-charcoal">{formatPrice(tax)}</span>
        </div>
        <div className="flex justify-between font-ui text-lg font-semibold pt-2 border-t border-line-soft">
          <span className="text-text-warm">Total:</span>
          <span className="text-text-warm">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Botones */}
      <div className="space-y-2">
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed font-ui font-medium"
        >
          Cobrar
        </button>
        <button
          onClick={onSaveOffline}
          className="btn-ghost w-full mt-2 font-ui font-medium"
        >
          Guardar Offline
        </button>
        <button
          onClick={onSync}
          className="btn-ghost w-full mt-2 bg-white font-ui font-medium"
        >
          Sincronizar
        </button>
      </div>
    </div>
  );
};

export default CartPanel;