import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import StoredFile from '../models/StoredFile';
import { ensureUploadsSubdir, getUploadsBasePath } from '../utils/uploads';

export interface SaveFileInput {
  filename: string;
  mimeType: string;
  dataBase64: string; // contenido del archivo en base64
  entityType?: string;
  entityId?: string;
  storage?: 'local';
  metadata?: Record<string, any> | null;
}

export interface StoredFileDTO {
  id: string;
  filename: string;
  mimeType?: string;
  size?: number;
  checksum: string;
  storage?: string;
  path: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  createdAt?: Date;
}

export class FileStorageService {
  static async saveFile(input: SaveFileInput): Promise<StoredFileDTO> {
    const storage = input.storage || 'local';
    const baseDir = ensureUploadsSubdir('files');
    const safeName = path.basename(input.filename);
    const uniqueName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
    const targetPath = path.join(baseDir, uniqueName);

    const buffer = Buffer.from(input.dataBase64, 'base64');
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    fs.writeFileSync(targetPath, buffer);

    const relativePath = path.relative(getUploadsBasePath(), targetPath);

    const record = await StoredFile.create({
      filename: safeName,
      mimeType: input.mimeType,
      size: buffer.length,
      checksum,
      storage,
      path: relativePath.replace(/\\/g, '/'),
      entityType: input.entityType ?? undefined,
      entityId: input.entityId ?? undefined,
      metadata: input.metadata ?? undefined,
    });

    return FileStorageService.toDTO(record);
  }

  static computeChecksumFromBuffer(buffer: Buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  static computeChecksumFromFile(fullPath: string) {
    const buffer = fs.readFileSync(fullPath);
    return FileStorageService.computeChecksumFromBuffer(buffer);
  }

  static async verifyFile(id: string): Promise<{
    id: string;
    exists: boolean;
    checksumDb?: string;
    checksumActual?: string;
    match?: boolean;
    path?: string;
  } | null> {
    const record = await StoredFile.findByPk(id);
    if (!record) return null;
    const fullPath = path.join(getUploadsBasePath(), record.path);
    const exists = fs.existsSync(fullPath);
    if (!exists) {
      return { id: record.id, exists: false, checksumDb: record.checksum, path: record.path };
    }
    try {
      const checksumActual = FileStorageService.computeChecksumFromFile(fullPath);
      const match = checksumActual === record.checksum;
      return {
        id: record.id,
        exists: true,
        checksumDb: record.checksum,
        checksumActual,
        match,
        path: record.path,
      };
    } catch {
      return { id: record.id, exists: false, checksumDb: record.checksum, path: record.path };
    }
  }

  static async listFiles(filter: { entityType?: string; entityId?: string }) {
    const where: any = {};
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;
    const rows = await StoredFile.findAll({ where, order: [['createdAt', 'DESC']] });
    return rows.map(FileStorageService.toDTO);
  }

  static async getFile(id: string) {
    const record = await StoredFile.findByPk(id);
    if (!record) return null;
    return FileStorageService.toDTO(record);
  }

  static async deleteFile(id: string) {
    const record = await StoredFile.findByPk(id);
    if (!record) return false;
    const fullPath = path.join(getUploadsBasePath(), record.path);
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (e) {
      // continuar incluso si falla el borrado físico
    }
    await record.destroy();
    return true;
  }

  static async verifyAll(filter: { entityType?: string; entityId?: string; limit?: number } = {}) {
    const where: any = {};
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;
    const rows = await StoredFile.findAll({ where, order: [['createdAt', 'DESC']], limit: filter.limit || undefined });

    const items: Array<{
      id: string;
      filename: string;
      path: string;
      exists: boolean;
      checksumDb?: string;
      checksumActual?: string;
      match?: boolean;
      entityType?: string;
      entityId?: string;
      createdAt?: Date;
    }> = [];

    let ok = 0;
    let missing = 0;
    let mismatch = 0;

    for (const record of rows) {
      const fullPath = path.join(getUploadsBasePath(), record.path);
      const exists = fs.existsSync(fullPath);
      if (!exists) {
        items.push({
          id: (record as any).id,
          filename: (record as any).filename,
          path: (record as any).path,
          exists: false,
          checksumDb: (record as any).checksum,
          entityType: (record as any).entityType || undefined,
          entityId: (record as any).entityId || undefined,
          createdAt: (record as any).createdAt,
        });
        missing++;
        continue;
      }

      try {
        const checksumActual = FileStorageService.computeChecksumFromFile(fullPath);
        const match = checksumActual === (record as any).checksum;
        items.push({
          id: (record as any).id,
          filename: (record as any).filename,
          path: (record as any).path,
          exists: true,
          checksumDb: (record as any).checksum,
          checksumActual,
          match,
          entityType: (record as any).entityType || undefined,
          entityId: (record as any).entityId || undefined,
          createdAt: (record as any).createdAt,
        });
        if (match) ok++; else mismatch++;
      } catch {
        items.push({
          id: (record as any).id,
          filename: (record as any).filename,
          path: (record as any).path,
          exists: false,
          checksumDb: (record as any).checksum,
          entityType: (record as any).entityType || undefined,
          entityId: (record as any).entityId || undefined,
          createdAt: (record as any).createdAt,
        });
        missing++;
      }
    }

    const summary = {
      total: rows.length,
      ok,
      missing,
      mismatch,
    };

    return { summary, items };
  }

  static toDTO(record: StoredFile): StoredFileDTO {
    return {
      id: record.id,
      filename: record.filename,
      mimeType: record.mimeType,
      size: record.size,
      checksum: record.checksum,
      storage: record.storage,
      path: record.path,
      entityType: (record as any).entityType || undefined,
      entityId: (record as any).entityId || undefined,
      metadata: (record as any).metadata || undefined,
      createdAt: (record as any).createdAt,
    };
  }
}
