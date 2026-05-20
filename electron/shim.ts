import { fileURLToPath } from 'node:url';
import path from 'node:path';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// @ts-ignore
globalThis.__filename = filename;
// @ts-ignore
globalThis.__dirname = dirname;
