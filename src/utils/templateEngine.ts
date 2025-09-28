import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { timestampSequencer } from './timestampSequencer';

export class TemplateEngine {
  private static readonly HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  private static readonly HTTP_PATHS = [
    '/api/users', '/api/orders', '/api/products', '/api/auth/login', 
    '/api/auth/logout', '/api/dashboard', '/api/reports', '/api/settings',
    '/health', '/metrics', '/api/v1/data', '/api/v2/analytics'
  ];
  private static readonly HTTP_STATUS = [200, 201, 400, 401, 403, 404, 500, 502, 503];
  private static readonly ATTACK_TYPES = [
    'SQL_INJECTION', 'XSS', 'BRUTE_FORCE', 'DDoS', 'PORT_SCAN', 'MALWARE'
  ];
  private static readonly AWS_SERVICES = [
    'EC2', 'S3', 'RDS', 'Lambda', 'CloudFormation', 'IAM', 'VPC', 'ELB'
  ];
  private static readonly AWS_OPERATIONS = [
    'CreateInstance', 'TerminateInstance', 'GetObject', 'PutObject', 
    'InvokeFunction', 'CreateRole', 'AttachPolicy'
  ];

  public static processTemplate(template: string, metadata?: Record<string, any>): string {
    let processed = template;
    
    // Replace common placeholders
    const replacements: Record<string, () => string> = {
      '{timestamp}': () => timestampSequencer.getUniqueTimestamp(),
      '{uuid}': () => uuidv4(),
      '{userId}': () => faker.string.uuid(),
      '{clientIP}': () => faker.internet.ip(),
      '{srcIP}': () => faker.internet.ip(),
      '{dstIP}': () => faker.internet.ip(),
      '{srcPort}': () => faker.internet.port().toString(),
      '{dstPort}': () => faker.internet.port().toString(),
      '{method}': () => faker.helpers.arrayElement(this.HTTP_METHODS),
      '{path}': () => faker.helpers.arrayElement(this.HTTP_PATHS),
      '{status}': () => faker.helpers.arrayElement(this.HTTP_STATUS).toString(),
      '{responseTime}': () => faker.number.int({ min: 10, max: 5000 }).toString(),
      '{errorMessage}': () => faker.helpers.arrayElement([
        'Connection timeout', 'Invalid credentials', 'Resource not found',
        'Internal server error', 'Bad request', 'Unauthorized access'
      ]),
      '{headers}': () => JSON.stringify({
        'User-Agent': faker.internet.userAgent(),
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }),
      '{action}': () => faker.helpers.arrayElement([
        'create', 'read', 'update', 'delete', 'login', 'logout'
      ]),
      '{resourceId}': () => faker.string.uuid(),
      '{memoryUsage}': () => faker.number.int({ min: 10, max: 95 }).toString(),
      '{cpuUsage}': () => faker.number.int({ min: 5, max: 100 }).toString(),
      '{pid}': () => faker.number.int({ min: 1000, max: 99999 }).toString(),
      '{loadAverage}': () => faker.number.float({ min: 0.1, max: 8.0, fractionDigits: 2 }).toString(),
      '{freeSpace}': () => faker.number.int({ min: 1, max: 100 }).toString(),
      '{mountPoint}': () => faker.helpers.arrayElement(['/var', '/tmp', '/home', '/opt']),
      '{duration}': () => faker.number.int({ min: 1, max: 300 }).toString(),
      '{serviceName}': () => faker.helpers.arrayElement([
        'nginx', 'apache', 'mysql', 'postgres', 'redis', 'mongodb'
      ]),
      '{protocol}': () => faker.helpers.arrayElement(['TCP', 'UDP', 'ICMP']),
      '{ruleId}': () => faker.number.int({ min: 1, max: 9999 }).toString(),
      '{reason}': () => faker.helpers.arrayElement([
        'blocked port', 'suspicious activity', 'rate limit exceeded', 'geo-blocked'
      ]),
      '{attackType}': () => faker.helpers.arrayElement(this.ATTACK_TYPES),
      '{state}': () => faker.helpers.arrayElement(['ESTABLISHED', 'TIME_WAIT', 'CLOSE_WAIT', 'SYN_SENT']),
      '{service}': () => faker.helpers.arrayElement(this.AWS_SERVICES),
      '{awsOperation}': () => faker.helpers.arrayElement(this.AWS_OPERATIONS),
      '{user}': () => faker.internet.email(),
      '{requestId}': () => faker.string.alphanumeric(16),
      '{instanceId}': () => `i-${faker.string.alphanumeric(8)}`,
      '{region}': () => faker.helpers.arrayElement(['us-east-1', 'us-west-2', 'eu-west-1']),
      '{bucketName}': () => faker.lorem.word() + '-bucket',
      '{functionName}': () => faker.lorem.word() + '-function',
      '{memoryUsed}': () => faker.number.int({ min: 64, max: 3008 }).toString(),
      '{cacheOperation}': () => faker.helpers.arrayElement(['HIT', 'MISS', 'SET', 'DELETE']),
      '{key}': () => faker.lorem.word(),
      '{result}': () => faker.helpers.arrayElement(['SUCCESS', 'FAILED']),
      
      // Authentication variables
      '{username}': () => faker.internet.userName(),
      '{sessionId}': () => faker.string.uuid(),
      '{attemptCount}': () => faker.number.int({ min: 1, max: 5 }).toString(),
      '{location}': () => `${faker.location.city()}, ${faker.location.country()}`,
      
      // Database variables  
      '{queryType}': () => faker.helpers.arrayElement(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
      '{tableName}': () => faker.helpers.arrayElement(['users', 'orders', 'products', 'sessions', 'logs']),
      '{query}': () => faker.helpers.arrayElement([
        'SELECT * FROM users WHERE active = true',
        'UPDATE orders SET status = \'shipped\' WHERE id = 12345',
        'INSERT INTO sessions (user_id, token) VALUES (?, ?)',
        'DELETE FROM temp_data WHERE created_at < NOW() - INTERVAL 1 DAY'
      ]),
      '{transactionId}': () => faker.string.alphanumeric(8),
      '{poolName}': () => faker.helpers.arrayElement(['main-pool', 'read-pool', 'write-pool']),
      '{tableCount}': () => faker.number.int({ min: 1, max: 5 }).toString(),
      '{connectionCount}': () => faker.number.int({ min: 50, max: 100 }).toString(),
      '{maxConnections}': () => '100',
      '{dbName}': () => faker.helpers.arrayElement(['production', 'staging', 'analytics']),
      
      // Web server variables
      '{responseSize}': () => faker.number.int({ min: 100, max: 50000 }).toString(),
      '{userAgent}': () => faker.internet.userAgent(),
      '{requestCount}': () => faker.number.int({ min: 100, max: 1000 }).toString(),
      '{backendHost}': () => faker.internet.domainName(),
      '{errorCode}': () => faker.helpers.arrayElement(['502', '503', '504']),
      '{certName}': () => faker.internet.domainName(),
      '{daysToExpiry}': () => faker.number.int({ min: 1, max: 90 }).toString(),
      '{timeout}': () => faker.number.int({ min: 30, max: 120 }).toString(),
      
      // Email variables
      '{sender}': () => faker.internet.email(),
      '{recipient}': () => faker.internet.email(),
      '{subject}': () => faker.helpers.arrayElement([
        'Welcome to our platform!', 'Password reset request', 'Order confirmation #12345',
        'Monthly newsletter', 'Account verification required', 'New message from support'
      ]),
      '{messageId}': () => faker.string.uuid(),
      '{retryCount}': () => faker.number.int({ min: 1, max: 5 }).toString(),
      '{spamScore}': () => faker.number.float({ min: 5.0, max: 10.0, fractionDigits: 1 }).toString(),
      '{quotaLimit}': () => faker.helpers.arrayElement(['100', '250', '500', '1000']),
      
      // Backup variables
      '{backupName}': () => {
        const types = ['database', 'application', 'logs', 'config'];
        const dates = new Date().toISOString().split('T')[0].replace(/-/g, '');
        return `${faker.helpers.arrayElement(types)}_backup_${dates}`;
      },
      '{backupSize}': () => faker.number.float({ min: 0.5, max: 100.0, fractionDigits: 1 }).toString(),
      '{currentSize}': () => faker.number.float({ min: 1.0, max: 50.0, fractionDigits: 1 }).toString(),
      '{previousSize}': () => faker.number.float({ min: 0.8, max: 45.0, fractionDigits: 1 }).toString(),
      '{deletedCount}': () => faker.number.int({ min: 1, max: 20 }).toString(),
      '{availableSpace}': () => faker.number.float({ min: 0.1, max: 10.0, fractionDigits: 1 }).toString(),
      '{storagePath}': () => faker.helpers.arrayElement(['/backup/primary', '/backup/secondary', '/mnt/backup-nfs']),
      
      // Microservices variables
      '{targetService}': () => faker.helpers.arrayElement([
        'user-service', 'order-service', 'payment-service', 'notification-service',
        'inventory-service', 'auth-service', 'catalog-service', 'shipping-service'
      ]),
      '{failureRate}': () => faker.number.int({ min: 50, max: 95 }).toString(),
      '{healthEndpoint}': () => '/health',
      '{oldInstances}': () => faker.number.int({ min: 1, max: 5 }).toString(),
      '{newInstances}': () => faker.number.int({ min: 2, max: 10 }).toString(),
      '{latency}': () => faker.number.int({ min: 1000, max: 5000 }).toString(),
      '{serviceUrl}': () => `http://${faker.internet.domainName()}:${faker.internet.port()}`,
      
      // IoT variables
      '{deviceId}': () => {
        const prefixes = ['SENS', 'CAM', 'THERM', 'LOCK', 'GW'];
        const prefix = faker.helpers.arrayElement(prefixes);
        const number = faker.number.int({ min: 1000, max: 9999 });
        return `${prefix}-${number}`;
      },
      '{deviceIP}': () => faker.internet.ip(),
      '{deviceType}': () => faker.helpers.arrayElement(['sensor', 'camera', 'thermostat', 'smart-lock', 'gateway']),
      '{batteryLevel}': () => faker.number.int({ min: 5, max: 25 }).toString(),
      '{lastSeen}': () => faker.date.recent({ days: 1 }).toISOString(),
      '{temperature}': () => faker.number.float({ min: 15.0, max: 35.0, fractionDigits: 1 }).toString(),
      '{humidity}': () => faker.number.int({ min: 30, max: 80 }).toString(),
      '{currentVersion}': () => {
        const major = faker.number.int({ min: 1, max: 3 });
        const minor = faker.number.int({ min: 0, max: 9 });
        const patch = faker.number.int({ min: 0, max: 20 });
        return `${major}.${minor}.${patch}`;
      },
      '{latestVersion}': () => {
        const major = faker.number.int({ min: 1, max: 3 });
        const minor = faker.number.int({ min: 0, max: 9 });
        const patch = faker.number.int({ min: 1, max: 21 });
        return `${major}.${minor}.${patch}`;
      }
    };

    // Apply replacements
    for (const [placeholder, generator] of Object.entries(replacements)) {
      while (processed.includes(placeholder)) {
        processed = processed.replace(placeholder, generator());
      }
    }

    return processed;
  }

  public static generateMetadata(baseMetadata?: Record<string, any>): Record<string, any> {
    const defaultMetadata = {
      host: faker.internet.domainName(),
      environment: faker.helpers.arrayElement(['production', 'staging', 'development']),
      version: faker.system.semver(),
      correlationId: uuidv4()
    };

    return { ...defaultMetadata, ...baseMetadata };
  }
}
