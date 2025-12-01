import React from 'react';
import { getStableKey } from '@/lib/utils';
import Modal from '../Modal';
import SubmitButton from './SubmitButton';
import { ExclamationTriangleIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  itemName?: string;
  details?: string[];
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
  isLoading = false,
  itemName,
  details = [],
}) => {
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <TrashIcon className="h-6 w-6 text-danger-600" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-6 w-6 text-warning-600" />;
      case 'info':
        return <CheckIcon className="h-6 w-6 text-brand-gold" />;
      default:
        return <ExclamationTriangleIcon className="h-6 w-6 text-warning-600" />;
    }
  };

  const getConfirmVariant = () => {
    switch (type) {
      case 'danger':
        return 'danger';
      case 'warning':
        return 'primary';
      case 'info':
        return 'success';
      default:
        return 'danger';
    }
  };

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="p-6">
        {/* Header con icono */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-warm mb-1">
              {title}
            </h3>
            <p className="text-text-muted text-sm">
              {message}
            </p>
          </div>
        </div>

        {/* Nombre del elemento si se proporciona */}
        {itemName && (
          <div className="bg-base-ivory border border-line-soft rounded-lg p-3 mb-4">
            <p className="text-sm text-text-muted mb-1">Elemento seleccionado:</p>
            <p className="font-medium text-text-warm">{itemName}</p>
          </div>
        )}

        {/* Detalles adicionales */}
        {details.length > 0 && (
          <div className="bg-base-ivory border border-line-soft rounded-lg p-3 mb-4">
            <p className="text-sm text-text-muted mb-2">Detalles:</p>
            <ul className="space-y-1">
              {details.map((detail) => (
                <li key={getStableKey(title, detail)} className="text-sm text-text-warm flex items-center gap-2">
                  <span className="w-1 h-1 bg-text-muted rounded-full flex-shrink-0"></span>
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Advertencia para acciones peligrosas */}
        {type === 'danger' && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 mb-6">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-danger-800 mb-1">
                  ¡Atención!
                </p>
                <p className="text-sm text-danger-700">
                  Esta acción no se puede deshacer. Asegúrate de que realmente deseas continuar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3 justify-end">
          <SubmitButton
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </SubmitButton>
          
          <SubmitButton
            type="button"
            variant={getConfirmVariant()}
            onClick={handleConfirm}
            isLoading={isLoading}
            loadingText="Procesando..."
          >
            {confirmText}
          </SubmitButton>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
