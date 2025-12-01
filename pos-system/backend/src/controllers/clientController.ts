import { Request, Response } from 'express';
import { ClientService } from '../services/clientService';
import { AuditTrailService } from '../services/AuditTrailService';
import { CreateClientInput, UpdateClientInput, ClientQueryInput } from '../schemas/client';

export class ClientController {
  static async createClient(req: Request, res: Response) {
    try {
      const data: CreateClientInput = req.body;
      const result = await ClientService.createClient(data);
      // Auditoría: creación de cliente
      try {
        const actor = (req as any).user ? { id: (req as any).user.id, role: (req as any).user.role } : null;
        await AuditTrailService.log({
          operation: 'client.create',
          entityType: 'client',
          entityId: result.id,
          result: 'success',
          message: `Cliente creado: ${result.code} ${result.firstName} ${result.lastName}`,
          details: { email: result.email, phone: result.phone },
          actor,
        });
      } catch (err) { console.error('Audit log error (client.create):', err); }
      
      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al crear cliente',
      });
    }
  }

  static async getClients(req: Request, res: Response) {
    try {
      const query: ClientQueryInput = req.query;
      const result = await ClientService.getClients(query);
      
      res.json({
        success: true,
        data: result.clients,
        pagination: result.pagination,
      });
    } catch (error) {
      res.json({ success: true, data: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 0 } });
    }
  }

  static async getClientById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await ClientService.getClientById(id);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Cliente no encontrado',
      });
    }
  }

  static async getClientByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const result = await ClientService.getClientByCode(code);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Cliente no encontrado',
      });
    }
  }

  static async updateClient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: UpdateClientInput = req.body;
      const result = await ClientService.updateClient(id, data);
      // Auditoría: actualización de cliente
      try {
        const actor = (req as any).user ? { id: (req as any).user.id, role: (req as any).user.role } : null;
        await AuditTrailService.log({
          operation: 'client.update',
          entityType: 'client',
          entityId: id,
          result: 'success',
          message: `Cliente actualizado: ${result.code}`,
          details: { changed: Object.keys(data || {}) },
          actor,
        });
      } catch (err) { console.error('Audit log error (client.update):', err); }
      
      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar cliente',
      });
    }
  }

  static async deleteClient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await ClientService.deleteClient(id);
      // Auditoría: eliminación (soft delete) de cliente
      try {
        const actor = (req as any).user ? { id: (req as any).user.id, role: (req as any).user.role } : null;
        await AuditTrailService.log({
          operation: 'client.delete',
          entityType: 'client',
          entityId: id,
          result: 'success',
          message: `Cliente marcado inactivo: ${id}`,
          actor,
        });
      } catch (err) { console.error('Audit log error (client.delete):', err); }
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al eliminar cliente',
      });
    }
  }

  static async getVipClients(req: Request, res: Response) {
    try {
      const result = await ClientService.getVipClients();
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener clientes VIP',
      });
    }
  }

  static async getClientStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await ClientService.getClientStats(id);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener estadísticas del cliente',
      });
    }
  }
}
