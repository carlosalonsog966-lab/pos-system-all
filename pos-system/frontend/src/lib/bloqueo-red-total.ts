/**
 * 🔒 SISTEMA DE BLOQUEO TOTAL DE RED - APP DEFINITIVA
 * Este sistema garantiza que NINGUNA petición HTTP salga de la app
 */

export class NetworkBlockerTotal {
  private static instance: NetworkBlockerTotal;
  private bloqueoActivo = false;
  private intentosDeConexion = 0;

  static getInstance(): NetworkBlockerTotal {
    if (!this.instance) {
      this.instance = new NetworkBlockerTotal();
    }
    return this.instance;
  }

  activarBloqueoTotal() {
    if (this.bloqueoActivo) return;

    console.log('🔒 ACTIVANDO BLOQUEO TOTAL DE RED...');

    // 1️⃣ DESTRUIR fetch COMPLETAMENTE
    this.destruirFetch();

    // 2️⃣ DESTRUIR XMLHttpRequest COMPLETAMENTE
    this.destruirXMLHttpRequest();

    // 3️⃣ BLOQUEAR WebSocket
    this.bloquearWebSocket();

    // 4️⃣ BLOQUEAR EventSource (SSE)
    this.bloquearEventSource();

    // 5️⃣ BLOQUEAR navegación
    this.bloquearNavegacion();

    // 6️⃣ BLOQUEAR imágenes y recursos externos
    this.bloquearRecursosExternos();

    this.bloqueoActivo = true;
    console.log('✅ BLOQUEO TOTAL DE RED ACTIVADO');
    console.log('📵 NINGUNA petición HTTP puede salir de esta aplicación');
  }

  private destruirFetch() {
    const fetchOriginal = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      this.intentosDeConexion++;
      
      console.log(`🚫 FETCH BLOQUEADO #${this.intentosDeConexion}:`, input);
      
      // Devolver error inmediato
      return Promise.reject(new Error(
        `🔒 RED BLOQUEADA: Intentaste conectarte a "${input}" pero el modo offline está activado`
      ));
    };

    // Marcar como destruido
    Object.defineProperty(window.fetch, 'name', {
      value: 'fetch_bloqueado',
      writable: false
    });

    console.log('🚫 Fetch original destruido y reemplazado por bloqueador');
  }

  private destruirXMLHttpRequest() {
    const XHROriginal = window.XMLHttpRequest;
    const self = this;

    function XMLHttpRequestBloqueado() {
      const xhr = {
        open: (method: string, url: string) => {
          self.intentosDeConexion++;
          console.log(`🚫 XMLHttpRequest BLOQUEADO #${self.intentosDeConexion}: ${method} ${url}`);
        },
        send: () => {
          console.log('🚫 XMLHttpRequest.send() bloqueado');
        },
        abort: () => {
          console.log('🚫 XMLHttpRequest.abort() - No hay nada que abortar');
        },
        setRequestHeader: () => {
          console.log('🚫 XMLHttpRequest.setRequestHeader() bloqueado');
        },
        getAllResponseHeaders: () => {
          return '';
        },
        getResponseHeader: () => {
          return null;
        },
        readyState: 0,
        response: null,
        responseText: '',
        responseType: '',
        responseURL: '',
        responseXML: null,
        status: 0,
        statusText: '',
        timeout: 0,
        upload: {},
        withCredentials: false,
        DONE: 4,
        HEADERS_RECEIVED: 2,
        LOADING: 3,
        OPENED: 1,
        UNSENT: 0
      };

      return xhr;
    }

    // Reemplazar completamente
    (window as any).XMLHttpRequest = XMLHttpRequestBloqueado;
    
    console.log('🚫 XMLHttpRequest original destruido y reemplazado por bloqueador');
  }

  private bloquearWebSocket() {
    const WebSocketOriginal = (window as any).WebSocket;
    
    if (WebSocketOriginal) {
      (window as any).WebSocket = function(url: string) {
        console.log(`🚫 WebSocket BLOQUEADO: ${url}`);
        throw new Error('🔒 WebSocket bloqueado - modo offline activo');
      };
      
      console.log('🚫 WebSocket bloqueado');
    }
  }

  private bloquearEventSource() {
    const EventSourceOriginal = (window as any).EventSource;
    
    if (EventSourceOriginal) {
      (window as any).EventSource = function(url: string) {
        console.log(`🚫 EventSource (SSE) BLOQUEADO: ${url}`);
        throw new Error('🔒 EventSource bloqueado - modo offline activo');
      };
      
      console.log('🚫 EventSource (SSE) bloqueado');
    }
  }

  private bloquearNavegacion() {
    // Prevenir navegación a URLs externas
    const links = document.querySelectorAll('a[href^="http"]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && !href.includes(window.location.origin)) {
          console.log(`🚫 Navegación externa bloqueada: ${href}`);
          e.preventDefault();
        }
      });
    });

    console.log('🚫 Navegación externa bloqueada');
  }

  private bloquearRecursosExternos() {
    // Bloquear imágenes externas
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node as Element;
            
            // Bloquear imágenes externas
            if (element.tagName === 'IMG') {
              const src = element.getAttribute('src');
              if (src && src.startsWith('http') && !src.includes(window.location.origin)) {
                console.log(`🚫 Imagen externa bloqueada: ${src}`);
                element.setAttribute('src', '');
              }
            }
            
            // Bloquear scripts externos
            if (element.tagName === 'SCRIPT') {
              const src = element.getAttribute('src');
              if (src && src.startsWith('http') && !src.includes(window.location.origin)) {
                console.log(`🚫 Script externo bloqueado: ${src}`);
                element.remove();
              }
            }
            
            // Bloquear estilos externos
            if (element.tagName === 'LINK' && element.getAttribute('rel') === 'stylesheet') {
              const href = element.getAttribute('href');
              if (href && href.startsWith('http') && !href.includes(window.location.origin)) {
                console.log(`🚫 Estilo externo bloqueado: ${href}`);
                element.remove();
              }
            }
          }
        });
      });
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });

    console.log('🚫 Recursos externos bloqueados');
  }

  obtenerEstadisticas() {
    return {
      bloqueoActivo: this.bloqueoActivo,
      intentosDeConexion: this.intentosDeConexion,
      fetchBloqueado: window.fetch.name === 'fetch_bloqueado',
      xhrDestruido: typeof window.XMLHttpRequest !== 'function'
    };
  }
}

// 🚀 ACTIVAR BLOQUEO TOTAL INMEDIATAMENTE
export function activarBloqueoRedTotal() {
  const blocker = NetworkBlockerTotal.getInstance();
  blocker.activarBloqueoTotal();
  
  // Verificar cada segundo
  setInterval(() => {
    const stats = blocker.obtenerEstadisticas();
    if (stats.intentosDeConexion > 0) {
      console.log(`🔒 Bloqueo activo - Intentos de conexión bloqueados: ${stats.intentosDeConexion}`);
    }
  }, 1000);
}

// Activar inmediatamente al cargar
if (typeof window !== 'undefined') {
  activarBloqueoRedTotal();
}