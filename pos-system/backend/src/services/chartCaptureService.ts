import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { ExportsIntegrityService } from './ExportsIntegrityService';

interface CaptureOptions {
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  fullPage?: boolean;
  selector?: string;
  delay?: number;
}

interface ChartCaptureRequest {
  chartType: 'dashboard' | 'sales' | 'inventory' | 'financial';
  chartId?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  options?: CaptureOptions;
  frontendUrl?: string; // override de URL del frontend para entornos dev
}

class ChartCaptureService {
  private browser: Browser | null = null;
  private readonly frontendUrl: string;
  private readonly outputDir: string;

  constructor() {
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const base = ExportsIntegrityService.getExportsBasePath();
    this.outputDir = path.join(base, 'charts');
    this.ensureOutputDirectory();
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }

  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  private async createPage(): Promise<Page> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    // Configurar viewport por defecto
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    });

    return page;
  }

  private getReportsUrl(chartType: string, overrideFrontendUrl?: string): string {
    const base = overrideFrontendUrl || this.frontendUrl;
    const url = `${base}/#/reports?tab=${chartType}`;
    console.log('Frontend URL:', this.frontendUrl);
    console.log('Generated URL:', url);
    return url;
  }

  private async waitForChartsToLoad(page: Page, delay: number = 3000): Promise<void> {
    try {
      // Primero esperar a que la aplicación React se cargue
      await page.waitForSelector('body', { timeout: 5000 });
      
      // Esperar a que aparezca algún contenido de la aplicación
      await page.waitForFunction(() => {
        return document.querySelector('[data-testid="chart-container"]') !== null ||
               document.querySelector('.recharts-wrapper') !== null ||
               document.querySelector('.recharts-responsive-container') !== null;
      }, { timeout: 15000 });
      
      // Esperar un poco más para que las animaciones terminen
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.log('Error waiting for charts to load:', error);
      // Intentar esperar por cualquier contenido de gráficas
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  async captureChart(request: ChartCaptureRequest): Promise<string> {
    const page = await this.createPage();
    
    try {
      const { chartType, options = {}, frontendUrl } = request;
      const {
        width = 1200,
        height = 800,
        deviceScaleFactor = 2,
        fullPage = false,
        selector,
        delay = 3000
      } = options;

      // Configurar viewport específico si se proporciona
      await page.setViewport({ width, height, deviceScaleFactor });

      // Navegar a la página de reportes
      const url = this.getReportsUrl(chartType, frontendUrl);
      await page.goto(url, { waitUntil: 'networkidle0' });

      // Esperar a que las gráficas se carguen
      await this.waitForChartsToLoad(page, delay);

      // Generar nombre de archivo único
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${chartType}-chart-${timestamp}.png`;
      const filepath = path.join(this.outputDir, filename);

      // Capturar screenshot
      const screenshotOptions: any = {
        path: filepath,
        type: 'png',
        fullPage
      };

      if (selector) {
        const element = await page.$(selector);
        if (element) {
          await element.screenshot(screenshotOptions);
        } else {
          throw new Error(`Selector ${selector} not found`);
        }
      } else {
        await page.screenshot(screenshotOptions);
      }

      // Registrar integridad en manifest de exports
      try {
        const { ExportsIntegrityService } = await import('./ExportsIntegrityService');
        ExportsIntegrityService.recordFile(filepath, 'chart');
      } catch (e) {
        console.warn('[ChartCaptureService] No se pudo registrar manifest de integridad', (e as any)?.message);
      }

      return filename;
    } finally {
      await page.close();
    }
  }

  async captureAllCharts(dateRange?: { startDate: string; endDate: string }): Promise<string[]> {
    const chartTypes: Array<'dashboard' | 'sales' | 'inventory' | 'financial'> = [
      'dashboard',
      'sales', 
      'inventory',
      'financial'
    ];

    const results: string[] = [];

    for (const chartType of chartTypes) {
      try {
        const filename = await this.captureChart({
          chartType,
          dateRange,
          options: {
            width: 1400,
            height: 900,
            delay: 4000
          }
        });
        results.push(filename);
      } catch (error) {
        console.error(`Error capturing ${chartType} chart:`, error);
        throw error;
      }
    }

    return results;
  }

  async captureSpecificChart(
    chartType: 'dashboard' | 'sales' | 'inventory' | 'financial',
    selector: string,
    options?: CaptureOptions
  ): Promise<string> {
    return this.captureChart({
      chartType,
      options: {
        ...options,
        selector
      }
    });
  }

  async getAvailableCharts(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.outputDir);
      return files.filter(file => file.endsWith('.png')).sort().reverse();
    } catch (error) {
      console.error('Error reading charts directory:', error);
      return [];
    }
  }

  async deleteChart(filename: string): Promise<boolean> {
    try {
      const filepath = path.join(this.outputDir, filename);
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      console.error('Error deleting chart:', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Método para limpiar capturas antiguas (más de 7 días)
  async cleanupOldCharts(daysOld: number = 7): Promise<number> {
    try {
      const files = await fs.readdir(this.outputDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          const filepath = path.join(this.outputDir, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filepath);
            deletedCount++;
          }
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old charts:', error);
      return 0;
    }
  }
}

export default new ChartCaptureService();
