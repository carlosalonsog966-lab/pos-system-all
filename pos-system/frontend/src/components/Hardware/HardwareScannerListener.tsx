import React, { useEffect, useRef, useCallback } from 'react';

interface HardwareScannerListenerProps {
  onScan: (code: string) => void;
  minLength?: number;
  maxLength?: number;
  timeout?: number;
  triggerKeys?: string[];
  ignoreIfFocused?: boolean;
  targetInputClass?: string;
}

const DEFAULT_MIN_LENGTH = 3;
const DEFAULT_MAX_LENGTH = 128;
const DEFAULT_TIMEOUT = 50; // ms entre caracteres para considerar escaneo
const DEFAULT_TRIGGER_KEYS = ['Enter', 'Tab'];

/**
 * Componente que escucha eventos de teclado para detectar escaneo de código de barras
 * Funciona con escáneres que operan como teclado (keyboard wedge) como el Eclinepos EC-CD-8100
 */
const HardwareScannerListener: React.FC<HardwareScannerListenerProps> = ({
  onScan,
  minLength = DEFAULT_MIN_LENGTH,
  maxLength = DEFAULT_MAX_LENGTH,
  timeout = DEFAULT_TIMEOUT,
  triggerKeys = DEFAULT_TRIGGER_KEYS,
  ignoreIfFocused = true,
  targetInputClass = 'scanner-input',
}) => {
  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  const isInputFocused = useCallback((): boolean => {
    if (!ignoreIfFocused) return false;
    
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    // Verificar si el elemento enfocado es un campo de entrada
    const tagName = activeElement.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea';
    const isContentEditable = (activeElement as HTMLElement).isContentEditable;
    
    // Verificar si tiene la clase específica para escáner
    const hasScannerClass = activeElement.classList.contains(targetInputClass);
    
    return isInput || isContentEditable || hasScannerClass;
  }, [ignoreIfFocused, targetInputClass]);

  const handleScan = useCallback((code: string) => {
    if (code.length >= minLength && code.length <= maxLength) {
      onScan(code);
    }
  }, [onScan, minLength, maxLength]);

  const resetBuffer = useCallback(() => {
    bufferRef.current = [];
    lastKeyTimeRef.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetEl = event.target as HTMLElement | null;
      if (isInputFocused() && !(targetEl?.classList?.contains(targetInputClass))) {
        return;
      }

      const currentTime = Date.now();
      const key = event.key;

      // Verificar si es una tecla de disparo (Enter/Tab)
      if (triggerKeys.includes(key)) {
        if (bufferRef.current.length > 0) {
          const code = bufferRef.current.join('');
          handleScan(code);
          resetBuffer();
          event.preventDefault();
        }
        return;
      }

      // Verificar si es un carácter imprimible
      if (key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        const timeSinceLastKey = currentTime - lastKeyTimeRef.current;
        
        // Si el tiempo entre teclas es muy corto, es probable un escaneo
        if (timeSinceLastKey < timeout * 2 || bufferRef.current.length === 0) {
          bufferRef.current.push(key);
          lastKeyTimeRef.current = currentTime;
          
          // Limpiar el temporizador anterior
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
          
          // Establecer nuevo temporizador para resetear el buffer si no hay más entrada
          timerRef.current = setTimeout(() => {
            resetBuffer();
          }, timeout * 3);
          
          event.preventDefault();
        } else {
          // Si el tiempo es largo, resetear y empezar de nuevo
          resetBuffer();
          bufferRef.current.push(key);
          lastKeyTimeRef.current = currentTime;
        }
      } else if (key === 'Escape') {
        // Permitir Escape para cancelar
        resetBuffer();
      }
    };

    // Agregar listener global
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [handleScan, resetBuffer, isInputFocused, triggerKeys, timeout, targetInputClass]);

  // Limpiar buffer cuando el componente se desmonta
  useEffect(() => {
    return () => {
      resetBuffer();
    };
  }, [resetBuffer]);

  return null; // Este componente no renderiza nada
};

export default HardwareScannerListener;
