import { api } from '@/lib/api';

export interface VerifiedDownloadResult {
  blob: Blob;
  filename: string;
  contentType?: string;
  cacheControl?: string;
  integrity: {
    expected?: string;
    actual?: string;
    match: boolean;
    verified: boolean;
  };
}

function getHeader(headers: Record<string, string | undefined>, key: string): string | undefined {
  const lower = key.toLowerCase();
  const direct = headers[lower];
  if (direct) return direct;
  return headers[key] || headers[key.toLowerCase()] || undefined;
}

function parseFilenameFromContentDisposition(dispo?: string): string | undefined {
  if (!dispo) return undefined;
  const m = dispo.match(/filename="?([^";]+)"?/i);
  return m && m[1] ? m[1] : undefined;
}

export async function downloadVerified(fileId: string): Promise<VerifiedDownloadResult> {
  const resp = await api.get(`/files/${encodeURIComponent(fileId)}/download`, { responseType: 'blob' });
  const headers = (resp as any)?.headers || {};

  const contentType = getHeader(headers, 'content-type');
  const cacheControl = getHeader(headers, 'cache-control');
  const dispo = getHeader(headers, 'content-disposition');
  const filename = parseFilenameFromContentDisposition(dispo) || `file_${fileId}`;

  const expected = getHeader(headers, 'x-checksum-expected') || getHeader(headers, 'x-checksum-sha256') || getHeader(headers, 'x-integrity-sha256');
  const actual = getHeader(headers, 'x-checksum-sha256') || getHeader(headers, 'x-integrity-sha256') || undefined;
  const matchStr = getHeader(headers, 'x-checksum-match') || '';
  const verifiedStr = getHeader(headers, 'x-integrity-verified') || '';
  const match = String(matchStr).toLowerCase() === 'true';
  const verified = String(verifiedStr).toLowerCase() === 'true' || match;

  const blobType = contentType || 'application/octet-stream';
  const blob = new Blob([resp?.data], { type: blobType });

  return {
    blob,
    filename,
    contentType,
    cacheControl,
    integrity: { expected, actual, match, verified },
  };
}

