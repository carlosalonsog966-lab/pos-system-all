import React, { useState, useRef, useEffect, useCallback } from 'react';
import { assetCache } from '../../lib/cache';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  blurDataURL?: string;
  quality?: number;
  priority?: boolean;
  lazy?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  fallback?: string;
  sizes?: string;
  srcSet?: string;
}

interface ImageState {
  isLoading: boolean;
  isLoaded: boolean;
  hasError: boolean;
  currentSrc: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder,
  blurDataURL,
  quality = 75,
  priority = false,
  lazy = true,
  onLoad,
  onError,
  fallback = '/images/placeholder.svg',
  sizes,
  srcSet,
}) => {
  const [imageState, setImageState] = useState<ImageState>({
    isLoading: true,
    isLoaded: false,
    hasError: false,
    currentSrc: placeholder || blurDataURL || '',
  });

  const [isInView, setIsInView] = useState(!lazy || priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver>();

  // Generar URL optimizada
  const getOptimizedSrc = useCallback((originalSrc: string, w?: number, q?: number) => {
    if (!originalSrc) return fallback;
    
    // Si es una URL externa, devolverla tal como está
    if (originalSrc.startsWith('http')) {
      return originalSrc;
    }

    // Para imágenes locales, agregar parámetros de optimización
    const url = new URL(originalSrc, window.location.origin);
    
    if (w) url.searchParams.set('w', w.toString());
    if (q) url.searchParams.set('q', q.toString());
    
    return url.toString();
  }, [fallback]);

  // Configurar Intersection Observer para lazy loading
  useEffect(() => {
    if (!lazy || priority || isInView) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy, priority, isInView]);

  // Cargar imagen cuando esté en vista
  useEffect(() => {
    if (!isInView || !src) return;

    const optimizedSrc = getOptimizedSrc(src, width, quality);
    
    // Verificar caché primero
    const cachedImage = assetCache.get(optimizedSrc);
    if (cachedImage) {
      setImageState({
        isLoading: false,
        isLoaded: true,
        hasError: false,
        currentSrc: optimizedSrc,
      });
      onLoad?.();
      return;
    }

    // Cargar imagen
    const img = new Image();
    
    img.onload = () => {
      // Guardar en caché
      assetCache.set(optimizedSrc, optimizedSrc, 30 * 60 * 1000); // 30 minutos
      
      setImageState({
        isLoading: false,
        isLoaded: true,
        hasError: false,
        currentSrc: optimizedSrc,
      });
      onLoad?.();
    };

    img.onerror = () => {
      const error = new Error(`Failed to load image: ${optimizedSrc}`);
      
      setImageState({
        isLoading: false,
        isLoaded: false,
        hasError: true,
        currentSrc: fallback,
      });
      onError?.(error);
    };

    img.src = optimizedSrc;
    if (srcSet) img.srcset = srcSet;
    if (sizes) img.sizes = sizes;

  }, [isInView, src, width, quality, getOptimizedSrc, onLoad, onError, fallback, srcSet, sizes]);

  // Generar srcSet automático para diferentes densidades
  const generateSrcSet = useCallback(() => {
    if (srcSet) return srcSet;
    if (!src || !width) return undefined;

    const densities = [1, 1.5, 2, 3];
    return densities
      .map(density => {
        const w = Math.round(width * density);
        const optimizedSrc = getOptimizedSrc(src, w, quality);
        return `${optimizedSrc} ${density}x`;
      })
      .join(', ');
  }, [src, width, quality, srcSet, getOptimizedSrc]);

  // Estilos para el contenedor
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    overflow: 'hidden',
    width: width ? `${width}px` : 'auto',
    height: height ? `${height}px` : 'auto',
  };

  // Estilos para la imagen
  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease-in-out',
    opacity: imageState.isLoaded ? 1 : 0,
  };

  // Estilos para el placeholder
  const placeholderStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: imageState.isLoaded ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
  };

  // Estilos para el blur placeholder
  const blurStyle: React.CSSProperties = blurDataURL ? {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundImage: `url(${blurDataURL})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(10px)',
    transform: 'scale(1.1)',
    opacity: imageState.isLoaded ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
  } : {};

  return (
    <div style={containerStyle} className={className}>
      {/* Blur placeholder */}
      {blurDataURL && <div style={blurStyle} />}
      
      {/* Loading placeholder */}
      {!blurDataURL && (
        <div style={placeholderStyle}>
          {imageState.isLoading && (
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            </div>
          )}
          
          {imageState.hasError && (
            <div className="text-gray-400 text-center">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-xs">Error al cargar</span>
            </div>
          )}
        </div>
      )}

      {/* Imagen principal */}
      <img
        ref={imgRef}
        src={imageState.currentSrc}
        alt={alt}
        style={imageStyle}
        srcSet={generateSrcSet()}
        sizes={sizes}
        loading={lazy && !priority ? 'lazy' : 'eager'}
        decoding="async"
      />
    </div>
  );
};

// Hook para precargar imágenes
export const useImagePreloader = () => {
  const preloadImage = useCallback((src: string, priority: boolean = false): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Verificar caché primero
      const cached = assetCache.get(src);
      if (cached) {
        resolve();
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        assetCache.set(src, src, 30 * 60 * 1000);
        resolve();
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${src}`));
      };

      img.src = src;
      
      // Para imágenes de alta prioridad, usar fetchpriority
      if (priority && 'fetchPriority' in img) {
        (img as any).fetchPriority = 'high';
      }
    });
  }, []);

  const preloadImages = useCallback(async (sources: string[]): Promise<void> => {
    const promises = sources.map(src => preloadImage(src));
    await Promise.allSettled(promises);
  }, [preloadImage]);

  return {
    preloadImage,
    preloadImages,
  };
};

// Componente para avatar optimizado
export const OptimizedAvatar: React.FC<{
  src?: string;
  name: string;
  size?: number;
  className?: string;
}> = ({ src, name, size = 40, className = '' }) => {
  const initials = name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: src ? 'transparent' : '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.4,
    fontWeight: 'bold',
    color: '#6b7280',
  };

  if (src) {
    return (
      <OptimizedImage
        src={src}
        alt={`Avatar de ${name}`}
        width={size}
        height={size}
        className={`rounded-full ${className}`}
        fallback={`data:image/svg+xml,${encodeURIComponent(`
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#e5e7eb"/>
            <text x="50%" y="50%" text-anchor="middle" dy="0.35em" font-family="Arial" font-size="${size * 0.4}" font-weight="bold" fill="#6b7280">${initials}</text>
          </svg>
        `)}`}
      />
    );
  }

  return (
    <div style={avatarStyle} className={className}>
      {initials}
    </div>
  );
};

export default OptimizedImage;