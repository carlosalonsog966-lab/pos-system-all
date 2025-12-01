import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Camera, X, Scan } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
  title?: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Escanear Código'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const readerRef = useRef<any | null>(null);
  const notFoundRef = useRef<any>(null);
  const location = useLocation();

  useEffect(() => {
    if (isOpen) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  // Cerrar escáner automáticamente al cambiar de ruta
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const startScanning = async () => {
    try {
      setError(null);
      setIsScanning(true);

      // Cargar zxing bajo demanda
      const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library');
      notFoundRef.current = NotFoundException;

      // Solicitar permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // Usar cámara trasera si está disponible
        } 
      });
      setHasPermission(true);

      // Detener el stream temporal
      stream.getTracks().forEach(track => track.stop());

      // Inicializar el lector de códigos
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }

      const videoElement = videoRef.current;
      if (!videoElement) return;

      // Comenzar a escanear
      await readerRef.current.decodeFromVideoDevice(
        null, // Usar dispositivo por defecto
        videoElement,
        (result: any, error: any) => {
          if (result) {
            const scannedText = result.getText();
            onScan(scannedText);
            onClose();
          }
          
          if (error && !(error instanceof notFoundRef.current)) {
            console.warn('Error de escaneo:', error);
          }
        }
      );

    } catch (err) {
      console.error('Error al iniciar el escáner:', err);
      setHasPermission(false);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Permisos de cámara denegados. Por favor, permite el acceso a la cámara.');
        } else if (err.name === 'NotFoundError') {
          setError('No se encontró ninguna cámara disponible.');
        } else {
          setError('Error al acceder a la cámara: ' + err.message);
        }
      } else {
        setError('Error desconocido al acceder a la cámara.');
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    setIsScanning(false);
  };

  const handleManualInput = () => {
    const input = prompt('Ingresa el código manualmente:');
    if (input && input.trim()) {
      onScan(input.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Scan className="w-5 h-5 mr-2" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error ? (
          <div className="text-center py-8">
            <Camera className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={startScanning}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Intentar de nuevo
              </button>
              <button
                onClick={handleManualInput}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Ingresar manualmente
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover"
                autoPlay
                playsInline
                muted
              />
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-white border-dashed w-48 h-32 rounded-lg"></div>
                </div>
              )}
            </div>

            <div className="text-center text-sm text-gray-600">
              <p>Apunta la cámara hacia el código QR o código de barras</p>
              <p className="mt-1">El escaneo se realizará automáticamente</p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleManualInput}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                Ingresar manualmente
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
