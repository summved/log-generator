/**
 * Input Validation Utilities
 * Provides comprehensive input validation for CLI arguments and configuration
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
     * Validate directory path and ensure it exists
     */
    static validateDirectoryPath(dirPath: string, description: string = 'Directory'): string {
        if (!dirPath) {
            throw new Error(`${description} path is required`);
        }

        const resolvedPath = path.resolve(dirPath);
        
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`${description} not found: ${resolvedPath}`);
        }

        const stats = fs.statSync(resolvedPath);
        if (!stats.isDirectory()) {
            throw new Error(`${description} is not a directory: ${resolvedPath}`);
        }

        return resolvedPath;
    }

    /**
     * Validate numeric input within range
     */
    static validateNumber(value: string | number, min?: number, max?: number, description: string = 'Value'): number {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        
        if (isNaN(num)) {
            throw new Error(`${description} must be a valid number`);
        }

        if (min !== undefined && num < min) {
            throw new Error(`${description} must be at least ${min}`);
        }

        if (max !== undefined && num > max) {
            throw new Error(`${description} must be at most ${max}`);
        }

        return num;
    }

    /**
     * Validate integer input within range
     */
    static validateInteger(value: string | number, min?: number, max?: number, description: string = 'Value'): number {
        const num = this.validateNumber(value, min, max, description);
        
        if (!Number.isInteger(num)) {
            throw new Error(`${description} must be an integer`);
        }

        return num;
    }

    /**
     * Validate string is not empty
     */
    static validateString(value: string, description: string = 'Value'): string {
        if (!value || value.trim().length === 0) {
            throw new Error(`${description} cannot be empty`);
        }

        return value.trim();
    }

    /**
     * Validate enum value
     */
    static validateEnum<T>(value: string, validValues: T[], description: string = 'Value'): T {
        if (!validValues.includes(value as T)) {
            throw new Error(`${description} must be one of: ${validValues.join(', ')}`);
        }

        return value as T;
    }

    /**
     * Validate duration string (e.g., "30s", "5m", "1h")
     */
    static validateDuration(duration: string): number {
        const match = duration.match(/^(\d+(?:\.\d+)?)(s|m|h|d)?$/i);
        
        if (!match) {
            throw new Error('Duration must be in format: 30s, 5m, 1h, or 2d');
        }

        const value = parseFloat(match[1]);
        const unit = (match[2] || 's').toLowerCase();

        const multipliers: { [key: string]: number } = {
            's': 1,
            'm': 60,
            'h': 3600,
            'd': 86400
        };

        if (!multipliers[unit]) {
            throw new Error('Duration unit must be s, m, h, or d');
        }

        return value * multipliers[unit];
    }

    /**
     * Validate output format
     */
    static validateOutputFormat(format: string): string {
        const validFormats = ['json', 'jsonl', 'csv', 'syslog'];
        return this.validateEnum(format, validFormats, 'Output format');
    }

    /**
     * Validate log level
     */
    static validateLogLevel(level: string): string {
        const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
        return this.validateEnum(level.toUpperCase(), validLevels, 'Log level');
    }

    /**
     * Validate IP address
     */
    static validateIPAddress(ip: string): string {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        
        if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
            throw new Error('Invalid IP address format');
        }

        // Additional IPv4 validation
        if (ipv4Regex.test(ip)) {
            const parts = ip.split('.').map(part => parseInt(part, 10));
            if (parts.some(part => part > 255)) {
                throw new Error('Invalid IPv4 address: octets must be 0-255');
            }
        }

        return ip;
    }

    /**
     * Validate port number
     */
    static validatePort(port: string | number): number {
        return this.validateInteger(port, 1, 65535, 'Port');
    }

    /**
     * Validate MITRE technique ID
     */
    static validateMitreTechnique(technique: string): string {
        const mitreRegex = /^T\d{4}(\.\d{3})?$/;
        
        if (!mitreRegex.test(technique)) {
            throw new Error('MITRE technique must be in format T1234 or T1234.001');
        }

        return technique;
    }

    /**
     * Validate MITRE tactic ID
     */
    static validateMitreTactic(tactic: string): string {
        const tacticRegex = /^TA\d{4}$/;
        
        if (!tacticRegex.test(tactic)) {
            throw new Error('MITRE tactic must be in format TA1234');
        }

        return tactic;
    }

    /**
     * Sanitize input to prevent injection attacks
     */
    static sanitizeInput(input: string): string {
        return input
            .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
            .trim()
            .substring(0, 1000); // Limit length
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

    /**
     * Validate configuration object structure
     */
    static validateConfigStructure(config: any): void {
        if (!config) {
            throw new Error('Configuration is required');
        }

        if (!config.generators) {
            throw new Error('Configuration must include generators section');
        }

        if (!config.output) {
            throw new Error('Configuration must include output section');
        }

        // Validate each generator has required fields
        for (const [name, generator] of Object.entries(config.generators)) {
            if (typeof generator !== 'object' || generator === null) {
                throw new Error(`Generator '${name}' must be an object`);
            }

            const gen = generator as any;
            if (typeof gen.enabled !== 'boolean') {
                throw new Error(`Generator '${name}' must have 'enabled' boolean property`);
            }

            if (gen.enabled && typeof gen.frequency !== 'number') {
                throw new Error(`Generator '${name}' must have 'frequency' number property when enabled`);
            }
        }
    }
}
