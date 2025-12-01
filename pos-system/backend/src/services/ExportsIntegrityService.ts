import fs from 'fs';
import path from 'path';
import { sha256OfFile } from '../utils/hash';

type ManifestEntry = {
  type: 'ticket' | 'chart' | 'backup' | 'report' | 'other';
  filename: string;
  urlPath: string; // e.g. /exports/tickets/<file>
  relPath: string; // relative path under exports
  size: number;
  sha256: string;
  createdAt: string;
  correlationId?: string | null;
};

type Manifest = {
  version: string;
  updatedAt: string;
  entries: ManifestEntry[];
};

export type VerificationResultEntry = {
  filename: string;
  urlPath: string;
  relPath: string;
  exists: boolean;
  checksumExpected: string | null;
  checksumActual: string | null;
  match: boolean;
  type: ManifestEntry['type'];
  correlationId?: string | null;
  manifestCreatedAt?: string | null;
};

export type VerifyOptions = {
  limit?: number;
  types?: ManifestEntry['type'][];
  writeSummary?: boolean;
};

export type VerifySummary = {
  success: boolean;
  total: number;
  checked: number;
  matches: number;
  mismatched: number;
  missing: number;
  updatedAt: string;
  results: VerificationResultEntry[];
};

export class ExportsIntegrityService {
  static getExportsBasePath(): string {
    const envBase = process.env.EXPORTS_BASE_PATH;
    if (envBase && envBase.trim().length > 0) {
      return envBase;
    }
    const parentExports = path.resolve(process.cwd(), '..', 'exports');
    try {
      const st = fs.statSync(parentExports);
      if (st.isDirectory()) {
        return parentExports;
      }
    } catch {}
    return path.join(process.cwd(), 'exports');
  }

  static getManifestPath(): string {
    return path.join(this.getExportsBasePath(), 'verification-manifest.json');
  }

  static readManifest(): Manifest {
    const manifestPath = this.getManifestPath();
    if (!fs.existsSync(manifestPath)) {
      return { version: '1.0', updatedAt: new Date().toISOString(), entries: [] };
    }
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.entries)) {
        return { version: '1.0', updatedAt: new Date().toISOString(), entries: [] };
      }
      return data as Manifest;
    } catch {
      return { version: '1.0', updatedAt: new Date().toISOString(), entries: [] };
    }
  }

  static writeManifest(next: Manifest): void {
    const manifestPath = this.getManifestPath();
    try {
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    } catch {}
    fs.writeFileSync(manifestPath, JSON.stringify(next, null, 2), 'utf8');
  }

  static getSummaryPath(): string {
    return path.join(this.getExportsBasePath(), 'verification-summary.json');
  }

  static writeSummary(summary: VerifySummary): void {
    const summaryPath = this.getSummaryPath();
    try {
      fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    } catch {}
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  }

  /**
   * Registra/actualiza una entrada de archivo en el manifest de exports.
   * Acepta ruta absoluta bajo exports y tipo de archivo.
   */
  static recordFile(absFilePath: string, type: ManifestEntry['type'], correlationId?: string | null): ManifestEntry {
    const base = this.getExportsBasePath();
    const rel = path.relative(base, absFilePath).replace(/\\/g, '/');
    const urlPath = `/exports/${rel}`;
    const stats = fs.statSync(absFilePath);
    const sha256 = sha256OfFile(absFilePath);

    const entry: ManifestEntry = {
      type,
      filename: path.basename(absFilePath),
      urlPath,
      relPath: rel,
      size: stats.size,
      sha256,
      createdAt: new Date().toISOString(),
      correlationId: correlationId || undefined,
    };

    const manifest = this.readManifest();
    // upsert por urlPath
    const idx = manifest.entries.findIndex(e => e.urlPath === urlPath);
    if (idx >= 0) {
      manifest.entries[idx] = entry;
    } else {
      manifest.entries.push(entry);
    }
    manifest.updatedAt = new Date().toISOString();
    this.writeManifest(manifest);
    return entry;
  }

  /**
   * Verifica los archivos registrados en el manifest comparando el SHA256 actual.
   */
  static verifyManifest(options: VerifyOptions = {}): VerifySummary {
    const { limit, types, writeSummary } = options;
    const manifest = this.readManifest();

    let entries = manifest.entries;
    if (types && types.length > 0) {
      entries = entries.filter(e => types.includes(e.type));
    }
    if (typeof limit === 'number' && limit > 0) {
      entries = entries.slice(0, limit);
    }

    const base = this.getExportsBasePath();
    const results: VerificationResultEntry[] = [];
    let matches = 0;
    let mismatched = 0;
    let missing = 0;

    for (const e of entries) {
      const abs = path.join(base, e.relPath);
      let exists = false;
      let actual: string | null = null;
      let expected: string | null = e.sha256 || null;
      try {
        exists = fs.existsSync(abs);
        if (exists) {
          actual = sha256OfFile(abs);
        }
      } catch {}

      const match = !!expected && !!actual && expected === actual;
      if (!exists) missing += 1;
      else if (match) matches += 1;
      else mismatched += 1;

      results.push({
        filename: e.filename,
        urlPath: e.urlPath,
        relPath: e.relPath,
        exists,
        checksumExpected: expected,
        checksumActual: actual,
        match,
        type: e.type,
        correlationId: e.correlationId ?? null,
        manifestCreatedAt: e.createdAt ?? null,
      });
    }

    const summary: VerifySummary = {
      success: true,
      total: manifest.entries.length,
      checked: entries.length,
      matches,
      mismatched,
      missing,
      updatedAt: new Date().toISOString(),
      results,
    };

    if (writeSummary) {
      this.writeSummary(summary);
    }

    return summary;
  }
}
