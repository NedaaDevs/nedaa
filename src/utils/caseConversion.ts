/**
 * Convert snake_case string to camelCase
 */
export const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * Convert camelCase string to snake_case
 */
export const toSnakeCase = (str: string): string => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

/**
 * Convert object keys from snake_case to camelCase
 */
export const keysToCamelCase = <T extends Record<string, any>>(obj: T): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = toCamelCase(key);
      result[camelKey] = obj[key];
    }
  }

  return result;
};

/**
 * Convert object keys from camelCase to snake_case
 */
export const keysToSnakeCase = <T extends Record<string, any>>(obj: T): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = obj[key];
    }
  }

  return result;
};

/**
 * Map specific fields from snake_case to camelCase with optional transformations
 */
export const mapSnakeToCamel = <T extends Record<string, any>>(
  source: Partial<T>,
  fieldMap: Record<string, string | ((value: any) => any)>
): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const snakeKey in fieldMap) {
    if (source[snakeKey as keyof T] !== undefined) {
      const mapping = fieldMap[snakeKey];
      const value = source[snakeKey as keyof T];

      if (typeof mapping === "function") {
        // Transform value using function
        const camelKey = toCamelCase(snakeKey);
        result[camelKey] = mapping(value);
      } else {
        // Direct mapping
        result[mapping] = value;
      }
    }
  }

  return result;
};
