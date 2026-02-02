/**
 * Helper to load non-module source files for testing.
 *
 * The application uses plain <script> tags (no ES modules), so classes are
 * declared at the top level of each file. This helper evaluates the file
 * inside a Function wrapper and returns the requested class, then also
 * attaches it to globalThis so downstream files can reference it.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');

/**
 * Load a source file and extract a named class/variable from it.
 * The class is also set on globalThis so other loaded files can reference it.
 *
 * @param {string} relativePath - Path relative to project root
 * @param {string} exportName   - Name of the class/variable to extract
 * @returns {*} The extracted value
 */
export function loadSource(relativePath, exportName) {
  const filePath = resolve(rootDir, relativePath);
  const code = readFileSync(filePath, 'utf-8');
  // Wrap the code in a function that returns the requested identifier.
  // This works because class declarations are scoped to the function body,
  // and we explicitly return the one we want.
  const fn = new Function(`${code}\nreturn ${exportName};`);
  const value = fn();
  globalThis[exportName] = value;
  return value;
}
