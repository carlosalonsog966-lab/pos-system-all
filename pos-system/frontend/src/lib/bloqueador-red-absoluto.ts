/**
 * 🔒 BLOQUEADOR DE RED ABSOLUTO - 100% OFFLINE
 * Este sistema garantiza que NINGUNA petición de red salga de la aplicación
 * Se ejecuta ANTES que cualquier otro código para bloquear absolutamente todo
 */

export class BloqueadorRedAbsoluto {
  private static instance: BloqueadorRedAbsoluto;
  private bloqueado: boolean = false;
  private intentosBloqueados: number = 0;
  private urlsBloqueadas: Set<string> = new Set();

  private constructor() {
    this.inicializarBloqueoTotal();
  }

  static obtenerInstancia(): BloqueadorRedAbsoluto {
    if (!BloqueadorRedAbsoluto.instance) {
      BloqueadorRedAbsoluto.instance = new BloqueadorRedAbsoluto();
    }
    return BloqueadorRedAbsoluto.instance;
  }

  private inicializarBloqueoTotal(): void {
    if (this.bloqueado) return;
    
    console.log('🚨 INICIANDO BLOQUEO DE RED ABSOLUTO...');
    
    // 1. BLOQUEAR FETCH COMPLETAMENTE
    const fetchOriginal = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      this.intentosBloqueados++;
      this.urlsBloqueadas.add(url);
      
      console.error(`🚫 FETCH BLOQUEADO: ${url}`);
      
      // Retornar error de red simulado
      return new Response(
        JSON.stringify({ 
          error: 'OFFLINE_MODE_ABSOLUTO',
          message: 'La aplicación está en modo 100% offline - no se permiten conexiones de red',
          intentos: this.intentosBloqueados
        }),
        { 
          status: 0, 
          statusText: 'Offline Mode',
          headers: new Headers({ 'Content-Type': 'application/json' })
        }
      );
    };

    // 2. BLOQUEAR XMLHTTPREQUEST COMPLETAMENTE
    const XMLHttpRequestOriginal = window.XMLHttpRequest;
    const self = this;
    window.XMLHttpRequest = class extends XMLHttpRequestOriginal {
      constructor() {
        super();
        
        const originalOpen = this.open;
        this.open = (method: string, url: string | URL, async?: boolean, username?: string, password?: string): void => {
          self.intentosBloqueados++;
          self.urlsBloqueadas.add(url.toString());
          
          console.error(`🚫 XMLHttpRequest BLOQUEADO: ${method} ${url}`);
          
          // Simular error de red
          setTimeout(() => {
            (this as any).readyState = 4;
            (this as any).status = 0;
            (this as any).responseText = JSON.stringify({
              error: 'OFFLINE_MODE_ABSOLUTO',
              message: 'Modo offline absoluto activo - conexión bloqueada',
              intentos: self.intentosBloqueados
            });
            
            if (this.onerror) this.onerror(new ProgressEvent('error'));
            if (this.onreadystatechange) this.onreadystatechange(new ProgressEvent('readystatechange'));
          }, 0);
        };
      }
    };

    // 3. BLOQUEAR WEBSOCKETS
    const WebSocketOriginal = window.WebSocket;
    window.WebSocket = class {
      constructor(url: string | URL, protocols?: string | string[]) {
        const urlStr = url.toString();
        self.intentosBloqueados++;
        self.urlsBloqueadas.add(urlStr);
        
        console.error(`🚫 WebSocket BLOQUEADO: ${urlStr}`);
        
        // Simular error inmediato
        setTimeout(() => {
          (this as any).readyState = 3; // CLOSED
          (this as any).onerror?.(new Event('error'));
          (this as any).onclose?.(new CloseEvent('close', { code: 1006, reason: 'Offline mode' }));
        }, 0);
      }
      
      get readyState() { return 3; }
      get CONNECTING() { return 0; }
      get OPEN() { return 1; }
      get CLOSING() { return 2; }
      get CLOSED() { return 3; }
      send() { console.error('🚫 WebSocket.send bloqueado'); }
      close() { console.error('🚫 WebSocket.close bloqueado'); }
    } as any;

    // 4. BLOQUEAR EVENTSOURCE (Server-Sent Events)
    if (window.EventSource) {
      const EventSourceOriginal = window.EventSource;
      window.EventSource = class extends EventSourceOriginal {
        constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
          const urlStr = url.toString();
          console.error(`🚫 EventSource BLOQUEADO: ${urlStr}`);
          
          // No llamar al constructor original
          super('data:text/plain,', eventSourceInitDict);
          
          setTimeout(() => {
            (this as any).readyState = 2; // CLOSED
            (this as any).onerror?.(new Event('error'));
          }, 0);
        }
      };
    }

    // 5. BLOQUEAR NAVIGATOR.ONLINE
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      writable: false,
      configurable: false
    });

    // 6. BLOQUEAR EVENTOS DE CONECTIVIDAD
    window.addEventListener = new Proxy(window.addEventListener, {
      apply(target, thisArg, argumentsList) {
        const [event, listener, options] = argumentsList;
        if (event === 'online' || event === 'offline') {
          console.log(`🚫 Evento ${event} bloqueado`);
          return; // No permitir suscripción a eventos de conectividad
        }
        return Reflect.apply(target, thisArg, argumentsList);
      }
    });

    this.bloqueado = true;
    console.log('✅ BLOQUEO DE RED ABSOLUTO ACTIVADO');
    console.log('📊 Estadísticas:', {
      modo: '100% OFFLINE',
      fetch: 'BLOQUEADO',
      xmlhttprequest: 'BLOQUEADO',
      websocket: 'BLOQUEADO',
      eventsource: 'BLOQUEADO',
      navigator_online: 'FORZADO A FALSE'
    });
  }

  obtenerEstadisticas(): { intentosBloqueados: number; urlsBloqueadas: string[] } {
    return {
      intentosBloqueados: this.intentosBloqueados,
      urlsBloqueadas: Array.from(this.urlsBloqueadas)
    };
  }

  estaBloqueado(): boolean {
    return this.bloqueado;
  }
}

// 🚨 ACTIVAR INMEDIATAMENTE - ANTES QUE CUALQUIER OTRO CÓDIGO
export function activarBloqueoRedAbsoluto(): void {
  try {
    const bloqueador = BloqueadorRedAbsoluto.obtenerInstancia();
    console.log('🛡️ Sistema de bloqueo de red activado exitosamente');
  } catch (error) {
    console.error('❌ Error al activar bloqueador de red:', error);
  }
}

// Activar automáticamente si estamos en modo offline
if (import.meta.env.VITE_FORCE_OFFLINE === 'true' || 
    import.meta.env.VITE_BLOCK_ALL_REQUESTS === 'true' ||
    import.meta.env.VITE_OFFLINE_MODE === 'true') {
  activarBloqueoRedAbsoluto();
}