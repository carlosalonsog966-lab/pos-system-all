import React from 'react';

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  image?: string;
}

interface DataTableProps {
  products: Product[];
  onProductSelect?: (product: Product) => void;
}

const DataTable: React.FC<DataTableProps> = ({ products, onProductSelect }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full">
        <thead className="table-head sticky top-0">
          <tr>
            <th className="text-left py-3 px-4 font-medium">Nombre</th>
            <th className="text-left py-3 px-4 font-medium">SKU</th>
            <th className="text-center py-3 px-4 font-medium">Existencias</th>
            <th className="text-right py-3 px-4 font-medium">Precio (MXN)</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr
              key={product.id}
              onClick={() => onProductSelect?.(product)}
              className={`cursor-pointer transition-colors hover:bg-[#F3ECE2] ${
                index % 2 === 0 ? 'bg-white' : 'bg-[#FCF9F3]'
              }`}
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {product.image && (
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-10 h-10 rounded-md object-cover"
                    />
                  )}
                  <div>
                    <div className="font-ui font-medium text-text-charcoal">
                      {product.name}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="font-ui text-sm text-[#8F8F8F]">
                  {product.sku}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span className={`font-ui font-medium ${
                  product.stock > 10 
                    ? 'text-success-600' 
                    : product.stock > 0 
                    ? 'text-warning-600' 
                    : 'text-danger-600'
                }`}>
                  {product.stock}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-ui font-medium text-text-charcoal">
                  {formatPrice(product.price)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {products.length === 0 && (
        <div className="text-center py-8">
          <div className="text-[#8F8F8F] font-ui">
            No se encontraron joyas
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;