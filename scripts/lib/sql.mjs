/**
 * Acceso SQL de las puertas automáticas.
 *
 * Vive acá porque lo usan la suite y la puerta del hito, y las dos tienen que
 * hablar con la MISMA base que la aplicación: se consulta donde la aplicación
 * vive, no desde afuera con otra configuración.
 *
 * Es sólo lectura de contraste. Ninguna puerta debería fabricar su escenario
 * con esto.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function parseEnvFile(path) {
  const values = {};

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    values[key] = value;
  }

  return values;
}

const localEnv = parseEnvFile('.env');
const DB_USER = localEnv.DB_USER || 'topgreen';
const DB_NAME = localEnv.DB_NAME || 'topgreen';

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function querySql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      'topgreen-db',
      'psql',
      '-U',
      DB_USER,
      '-d',
      DB_NAME,
      '-tA',
      '-F',
      '\t',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim();
}

export function queryRows(sql) {
  const output = querySql(sql);
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => line.split('\t'));
}

export function queryCount(sql) {
  const value = Number.parseInt(querySql(sql), 10);
  if (!Number.isInteger(value)) {
    throw new Error(`La consulta SQL no devolvió un entero: ${sql}`);
  }
  return value;
}
