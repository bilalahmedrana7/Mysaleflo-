import path from 'node:path';
import { Persistence } from './persist';

// Lazily opened so importing server modules (e.g. in tests) never touches the disk.
let instance: Persistence | null = null;

export function dataFile(): string {
  return process.env.DATA_FILE || path.join(process.env.DATA_DIR || './data', 'saleflo.db');
}

export function storage(): Persistence {
  if (!instance) instance = new Persistence(dataFile());
  return instance;
}

export function closeStorage() {
  instance?.close();
  instance = null;
}
