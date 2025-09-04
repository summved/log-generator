import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';

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
      '{timestamp}': () => new Date().toISOString(),
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
      '{result}': () => faker.helpers.arrayElement(['SUCCESS', 'FAILED'])
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
