/**
 * Input Validation Utilities
 * Validation helpers for CLI arguments
 */

import * as path from 'path';
import * as fs from 'fs';

export class InputValidator {
    /**
     * Validate file path and ensure it exists
     */
    static validateFilePath(filePath: string, description: string = 'File'): string {
        if (!filePath) {
            throw new Error(`${description} path is required`);
        }

        const resolvedPath = path.resolve(filePath);
        
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`${description} not found: ${resolvedPath}`);
        }

        return resolvedPath;
    }

    /**
     * Validate configuration key-value pair
     */
    static validateConfigKeyValue(key: string, value: any, validOptions?: string[]): any {
        if (!key) {
            throw new Error('Configuration key is required');
        }

        if (validOptions && !validOptions.includes(value)) {
            throw new Error(`Invalid value '${value}' for key '${key}'. Valid options: ${validOptions.join(', ')}`);
        }

        return value;
    }
}
