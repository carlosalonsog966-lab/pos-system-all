import { Op } from 'sequelize';
import { Client } from '../models/Client';
import { CreateClientInput, UpdateClientInput, ClientQueryInput } from '../schemas/client';

export class ClientService {
  static async createClient(data: CreateClientInput) {
    // Verificar si el código ya existe
    const existingClient = await Client.findOne({
      where: { code: data.code },
    });

    if (existingClient) {
      throw new Error('El código de cliente ya existe');
    }

    // Verificar si el email ya existe (si se proporciona)
    if (data.email) {
      const existingEmail = await Client.findOne({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new Error('El email ya está registrado');
      }
    }

    // Verificar si el documento ya existe (si se proporciona)
    if (data.documentNumber) {
      const existingDocument = await Client.findOne({
        where: { documentNumber: data.documentNumber },
      });

      if (existingDocument) {
        throw new Error('El número de documento ya está registrado');
      }
    }

    const client = await Client.create(data);
    return client;
  }

  static async getClients(query: ClientQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      vip,
    } = query;

    const offset = (page - 1) * limit;
    const where: any = {};

    // Filtros
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { documentNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive !== undefined) where.isActive = isActive;

    // Filtro VIP (clientes con compras > 5000)
    if (vip) {
      where.totalPurchases = { [Op.gt]: 5000 };
    }

    const { rows: clients, count } = await Client.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      clients,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    };
  }

  static async getClientById(id: string) {
    const client = await Client.findByPk(id);
    if (!client) {
      throw new Error('Cliente no encontrado');
    }
    return client;
  }

  static async getClientByCode(code: string) {
    const client = await Client.findOne({
      where: { code, isActive: true },
    });
    if (!client) {
      throw new Error('Cliente no encontrado');
    }
    return client;
  }

  static async updateClient(id: string, data: UpdateClientInput) {
    const client = await Client.findByPk(id);
    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    // Verificar código único si se está actualizando
    if (data.code && data.code !== client.code) {
      const existingClient = await Client.findOne({
        where: { code: data.code, id: { [Op.ne]: id } },
      });
      if (existingClient) {
        throw new Error('El código de cliente ya existe');
      }
    }

    // Verificar email único si se está actualizando
    if (data.email && data.email !== client.email) {
      const existingEmail = await Client.findOne({
        where: { email: data.email, id: { [Op.ne]: id } },
      });
      if (existingEmail) {
        throw new Error('El email ya está registrado');
      }
    }

    // Verificar documento único si se está actualizando
    if (data.documentNumber && data.documentNumber !== client.documentNumber) {
      const existingDocument = await Client.findOne({
        where: { documentNumber: data.documentNumber, id: { [Op.ne]: id } },
      });
      if (existingDocument) {
        throw new Error('El número de documento ya está registrado');
      }
    }

    await client.update(data);
    return client;
  }

  static async deleteClient(id: string) {
    const client = await Client.findByPk(id);
    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    // Soft delete - marcar como inactivo
    await client.update({ isActive: false });
    return { message: 'Cliente eliminado exitosamente' };
  }

  static async getVipClients() {
    const clients = await Client.findAll({
      where: {
        isActive: true,
        totalPurchases: { [Op.gt]: 5000 },
      },
      order: [['totalPurchases', 'DESC']],
    });

    return clients;
  }

  static async getClientStats(id: string) {
    const client = await Client.findByPk(id);
    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    return {
      id: client.id,
      fullName: client.getFullName(),
      totalPurchases: client.totalPurchases,
      lastPurchaseDate: client.lastPurchaseDate,
      isVip: client.isVipClient(),
      age: client.getAge(),
      memberSince: client.createdAt,
    };
  }
}