/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { logger } from './logger';
import type { TypeGuard } from './schemaValidation';

/**
 * Mapea de forma segura un array, filtrando elementos nulos/indefinidos y opcionalmente
 * validando cada elemento con un type guard.
 * @param array El array a mapear (puede ser nulo o indefinido).
 * @param mapper La función de mapeo a aplicar a los elementos válidos.
 * @param options Opciones que incluyen un type guard y un valor de fallback.
 * @returns Un nuevo array con los resultados del mapeo.
 */
export const safeMap = <T, U>(
  array: T[] | null | undefined,
  mapper: (item: T, index: number) => U,
  options?: { guard?: TypeGuard<T>; fallback?: U[] }
): U[] => {
  const { guard, fallback = [] } = options || {};
  if (!Array.isArray(array)) {
    return fallback;
  }
  return array.reduce((acc: U[], item, index) => {
    if (item === null || item === undefined) return acc;
    if (guard && !guard(item)) {
        logger.log('DEBUG', 'safeMap', 'Item filtrado por type guard', { item });
        return acc;
    }
    acc.push(mapper(item, index));
    return acc;
  }, []);
};

/**
 * Une de forma segura los elementos de un array en una cadena, manejando valores nulos
 * y no-strings.
 * @param array El array a unir.
 * @param separator El separador a usar.
 * @param emptyValue El valor a devolver si el array está vacío o es inválido.
 * @returns Una cadena de texto.
 */
export const safeJoin = (
  array: any[] | null | undefined,
  separator = ', ',
  emptyValue = 'No especificado'
): string => {
  if (!Array.isArray(array) || array.length === 0) {
    return emptyValue;
  }
  const validItems = array.filter(item => typeof item === 'string' && item.trim() !== '');
  if (validItems.length === 0) {
      return emptyValue;
  }
  return validItems.join(separator);
};

/**
 * Asegura que una clave para un elemento de React sea siempre una cadena válida.
 * @param key El valor de la clave potencial (puede ser string, número, nulo).
 * @param prefix Un prefijo para usar con el índice si la clave no es válida.
 * @param index El índice del elemento en el array.
 * @returns Una clave de React válida y única.
 */
export const safeKey = (
    key: string | number | null | undefined,
    prefix: string,
    index: number
): string => {
    if (typeof key === 'string' && key) return key;
    if (typeof key === 'number') return String(key);
    return `${prefix}-${index}`;
};
