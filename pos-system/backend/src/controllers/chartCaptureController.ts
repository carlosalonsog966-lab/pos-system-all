import { Request, Response } from 'express';
import chartCaptureService from '../services/chartCaptureService';
import path from 'path';
import fs from 'fs/promises';
import { sha256OfBuffer } from '../utils/hash';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';

interface CaptureChartRequest {
  chartType: 'dashboard' | 'sales' | 'inventory' | 'financial';
  selector?: string;
  width?: number;
  height?: number;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

interface CaptureAllChartsRequest {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export const captureChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chartType, selector, width, height, dateRange }: CaptureChartRequest = req.body;
    const { frontendUrl } = req.body as any;

    if (!chartType || !['dashboard', 'sales', 'inventory', 'financial'].includes(chartType)) {
      res.status(400).json({
        success: false,
        message: 'Tipo de gráfica inválido. Debe ser: dashboard, sales, inventory o financial'
      });
      return;
    }

    const options = {
      width: width || 1200,
      height: height || 800,
      selector,
      delay: 3000
    };

    const filename = await chartCaptureService.captureChart({
      chartType,
      dateRange,
      options,
      frontendUrl
    });

    res.json({
      success: true,
      message: 'Gráfica capturada exitosamente',
      data: {
        filename,
        downloadUrl: `/api/charts/download/${filename}`
      }
    });
  } catch (error) {
    console.error('Error capturing chart:', error);
    res.status(500).json({
      success: false,
      message: 'Error al capturar la gráfica',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

export const captureAllCharts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateRange }: CaptureAllChartsRequest = req.body;
    const { frontendUrl } = req.body as any;

    const chartTypes: Array<'dashboard' | 'sales' | 'inventory' | 'financial'> = ['dashboard','sales','inventory','financial'];
    const filenames: string[] = [];
    for (const chartType of chartTypes) {
      const filename = await chartCaptureService.captureChart({ chartType, dateRange, frontendUrl, options: { width: 1400, height: 900, delay: 4000 } });
      filenames.push(filename);
    }

    res.json({
      success: true,
      message: 'Todas las gráficas capturadas exitosamente',
      data: {
        filenames,
        downloadUrls: filenames.map(filename => `/api/charts/download/${filename}`)
      }
    });
  } catch (error) {
    console.error('Error capturing all charts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al capturar las gráficas',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

export const downloadChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    if (!filename || !filename.endsWith('.png')) {
      res.status(400).json({
        success: false,
        message: 'Nombre de archivo inválido'
      });
      return;
    }

    const filepath = path.join(process.cwd(), 'exports', 'charts', filename);

    try {
      await fs.access(filepath);
    } catch {
      res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
      return;
    }

    const fileBuffer = await fs.readFile(filepath);
    const checksum = sha256OfBuffer(fileBuffer);
    const manifest = ExportsIntegrityService.readManifest();
    const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
    applyIntegrityHeaders(res, { filename, contentType: 'image/png', body: fileBuffer, setContentLength: true });
    res.send(fileBuffer);
  } catch (error) {
    console.error('Error downloading chart:', error);
    res.status(500).json({
      success: false,
      message: 'Error al descargar la gráfica',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

export const listCharts = async (req: Request, res: Response): Promise<void> => {
  try {
    const charts = await chartCaptureService.getAvailableCharts();

    res.json({
      success: true,
      message: 'Lista de gráficas obtenida exitosamente',
      data: {
        charts: charts.map(filename => ({
          filename,
          downloadUrl: `/api/charts/download/${filename}`,
          createdAt: filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)?.[1]?.replace(/-/g, ':') || null
        }))
      }
    });
  } catch (error) {
    console.error('Error listing charts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de gráficas',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

export const deleteChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    if (!filename || !filename.endsWith('.png')) {
      res.status(400).json({
        success: false,
        message: 'Nombre de archivo inválido'
      });
      return;
    }

    const deleted = await chartCaptureService.deleteChart(filename);

    if (deleted) {
      res.json({
        success: true,
        message: 'Gráfica eliminada exitosamente'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Archivo no encontrado o no se pudo eliminar'
      });
    }
  } catch (error) {
    console.error('Error deleting chart:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la gráfica',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

export const cleanupOldCharts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { days } = req.query;
    const daysOld = days ? parseInt(days as string) : 7;

    if (isNaN(daysOld) || daysOld < 1) {
      res.status(400).json({
        success: false,
        message: 'Número de días inválido'
      });
      return;
    }

    const deletedCount = await chartCaptureService.cleanupOldCharts(daysOld);

    res.json({
      success: true,
      message: `Limpieza completada. ${deletedCount} archivos eliminados`,
      data: {
        deletedCount,
        daysOld
      }
    });
  } catch (error) {
    console.error('Error cleaning up charts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar gráficas antiguas',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};
