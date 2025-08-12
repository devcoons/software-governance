import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

export function uuidToBin(uuid: string): Buffer {
  if (!uuidValidate(uuid)) throw new Error('Invalid UUID');
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}
export function binToUuid(bin: Buffer | Uint8Array): string {
  const hex = Buffer.from(bin).toString('hex');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
export function newUuidBin(): { idStr: string; idBin: Buffer } {
  const idStr = uuidv4();
  return { idStr, idBin: uuidToBin(idStr) };
}

export function uuidToHex(uuid: string) {
  return uuid.replace(/-/g, '').toLowerCase();
}
