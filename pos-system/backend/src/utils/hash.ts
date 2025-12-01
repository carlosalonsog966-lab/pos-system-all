import crypto from 'crypto';
import fs from 'fs';

export function sha256OfBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha256OfString(text: string): string {
  return sha256OfBuffer(Buffer.from(text, 'utf8'));
}

export function sha256OfFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return sha256OfBuffer(buf);
}

