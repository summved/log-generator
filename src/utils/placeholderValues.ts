/**
 * Values for template placeholders like {srcIP}. Each function returns a fresh value; numbers are
 * returned as numbers so a metadata field that is just "{bytes}" can be stored as a number.
 * Placeholders not listed here get a value from guessValue() based on the name.
 */

import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { timestampSequencer } from './timestampSequencer';

export type PlaceholderValue = string | number | boolean;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const HTTP_PATHS = [
  '/api/users', '/api/orders', '/api/products', '/api/auth/login', '/api/auth/logout', '/api/dashboard',
  '/api/reports', '/api/settings', '/health', '/metrics', '/api/v1/data', '/api/v2/analytics'
];
const HTTP_STATUS = [200, 201, 400, 401, 403, 404, 500, 502, 503];
const ATTACK_TYPES = ['SQL_INJECTION', 'XSS', 'BRUTE_FORCE', 'DDoS', 'PORT_SCAN', 'MALWARE'];
const AWS_SERVICES = ['EC2', 'S3', 'RDS', 'Lambda', 'CloudFormation', 'IAM', 'VPC', 'ELB'];
const AWS_OPERATIONS = ['CreateInstance', 'TerminateInstance', 'GetObject', 'PutObject', 'InvokeFunction', 'CreateRole', 'AttachPolicy'];
const SERVICES = ['user-service', 'order-service', 'payment-service', 'notification-service', 'inventory-service', 'auth-service', 'catalog-service', 'shipping-service'];

const pick = <T>(items: T[]): T => faker.helpers.arrayElement(items);
const int = (min: number, max: number): number => faker.number.int({ min, max });
const float = (min: number, max: number, fractionDigits = 1): number => faker.number.float({ min, max, fractionDigits });
const hex = (length: number): string => faker.string.hexadecimal({ length, casing: 'lower', prefix: '' });
const recent = (days = 7): string => faker.date.recent({ days }).toISOString();
const soon = (days = 7): string => faker.date.soon({ days }).toISOString();
const semver = (): string => `${int(1, 3)}.${int(0, 9)}.${int(0, 20)}`;

export const PLACEHOLDER_VALUES: Record<string, () => PlaceholderValue> = {
  // General
  timestamp: () => timestampSequencer.getUniqueTimestamp(),
  uuid: () => uuidv4(),
  correlationId: () => uuidv4(),
  requestId: () => faker.string.alphanumeric(16),
  queryId: () => `q-${faker.string.alphanumeric(10)}`,
  connectionId: () => `conn-${faker.string.alphanumeric(8)}`,
  traceId: () => hex(32),
  spanId: () => hex(16),
  parentSpanId: () => hex(16),
  duration: () => int(1, 300),
  threshold: () => int(70, 95),
  severity: () => pick(['low', 'medium', 'high', 'critical']),
  priority: () => pick(['low', 'normal', 'high', 'urgent']),
  riskScore: () => int(1, 100),
  riskLevel: () => pick(['low', 'medium', 'high', 'critical']),
  score: () => float(0, 10),
  confidence: () => float(0.5, 0.99, 2),
  trend: () => pick(['increasing', 'decreasing', 'stable']),
  tags: () => faker.helpers.arrayElements(['prod', 'critical', 'pci', 'internal', 'edge', 'canary'], 2).join(','),
  version: () => semver(),
  health: () => pick(['healthy', 'degraded', 'unhealthy']),
  uptime: () => int(60, 2592000),
  usage: () => int(50, 99),

  // Network and HTTP
  userId: () => faker.string.uuid(),
  clientIP: () => faker.internet.ipv4(),
  srcIP: () => faker.internet.ipv4(),
  dstIP: () => faker.internet.ipv4(),
  sourceIp: () => faker.internet.ipv4(),
  ipAddress: () => faker.internet.ipv4(),
  srcPort: () => faker.internet.port(),
  dstPort: () => faker.internet.port(),
  portRange: () => { const start = int(1, 60000); return `${start}-${start + int(10, 1000)}`; },
  method: () => pick(HTTP_METHODS),
  path: () => pick(HTTP_PATHS),
  apiEndpoint: () => pick(HTTP_PATHS),
  resource: () => pick(HTTP_PATHS),
  status: () => pick(HTTP_STATUS),
  responseTime: () => int(10, 5000),
  processingTime: () => int(1, 500),
  networkLatency: () => int(5, 500),
  latency: () => int(1000, 5000),
  percentile: () => pick(['p50', 'p90', 'p95', 'p99']),
  sampleSize: () => int(100, 10000),
  bytes: () => int(64, 10485760),
  rxBytes: () => int(1024, 1073741824),
  txBytes: () => int(1024, 1073741824),
  dataTransmitted: () => int(128, 1048576),
  protocol: () => pick(['TCP', 'UDP', 'ICMP']),
  ruleId: () => int(1, 9999),
  reason: () => pick(['blocked port', 'suspicious activity', 'rate limit exceeded', 'geo-blocked']),
  attackType: () => pick(ATTACK_TYPES),
  scanType: () => pick(['SYN scan', 'TCP connect', 'UDP scan', 'FIN scan', 'XMAS scan']),
  threatLevel: () => pick(['low', 'medium', 'high', 'critical']),
  state: () => pick(['ESTABLISHED', 'TIME_WAIT', 'CLOSE_WAIT', 'SYN_SENT']),
  interface: () => pick(['eth0', 'eth1', 'ens192', 'bond0', 'wlan0']),
  speed: () => pick([100, 1000, 10000]),
  macAddress: () => faker.internet.mac(),
  hostname: () => `${pick(['web', 'app', 'db', 'cache', 'worker'])}-${int(1, 20).toString().padStart(2, '0')}`,
  domain: () => faker.internet.domainName(),
  headers: () => JSON.stringify({ 'User-Agent': faker.internet.userAgent(), Accept: 'application/json', 'Content-Type': 'application/json' }),
  errorMessage: () => pick(['Connection timeout', 'Invalid credentials', 'Resource not found', 'Internal server error', 'Bad request', 'Unauthorized access']),
  patternType: () => pick(['sql_injection', 'path_traversal', 'credential_stuffing', 'enumeration', 'beaconing']),
  anomalyType: () => pick(['traffic_spike', 'unusual_port', 'data_exfiltration', 'firmware_tamper', 'reading_out_of_range']),

  // Application
  action: () => pick(['create', 'read', 'update', 'delete', 'login', 'logout']),
  resourceId: () => faker.string.uuid(),
  component: () => pick(['api', 'worker', 'scheduler', 'web', 'cache']),
  processName: () => pick(['java', 'node', 'python3', 'nginx', 'postgres', 'redis-server']),
  topProcess: () => pick(['java', 'node', 'python3', 'nginx', 'postgres', 'redis-server']),
  ruleName: () => pick(['max-order-value', 'daily-transfer-limit', 'duplicate-invoice', 'discount-cap']),
  userRole: () => pick(['admin', 'user', 'analyst', 'auditor', 'service']),
  memoryUsage: () => int(10, 95),
  cpuUsage: () => int(5, 100),
  pid: () => int(1000, 99999),
  cacheOperation: () => pick(['HIT', 'MISS', 'SET', 'DELETE']),
  cacheType: () => pick(['redis', 'memcached', 'in-memory']),
  cacheKey: () => `cache:${faker.lorem.word()}:${int(1, 9999)}`,
  hitRate: () => int(40, 99),
  ttl: () => int(30, 86400),
  key: () => faker.lorem.word(),
  result: () => pick(['SUCCESS', 'FAILED']),

  // Server
  loadAverage: () => float(0.1, 8, 2),
  freeSpace: () => int(1, 100),
  mountPoint: () => pick(['/var', '/tmp', '/home', '/opt']),
  serviceName: () => pick(['nginx', 'apache', 'mysql', 'postgres', 'redis', 'mongodb']),
  serviceType: () => pick(['systemd', 'docker', 'init.d']),
  serviceUptime: () => int(60, 2592000),
  availableMemory: () => int(256, 16384),
  totalMemory: () => pick([4096, 8192, 16384, 32768, 65536]),
  swapUsage: () => int(0, 90),
  diskUsage: () => int(40, 99),
  totalSpace: () => pick([100, 250, 500, 1000, 2000]),
  cpuCores: () => pick([2, 4, 8, 16, 32]),

  // Cloud
  service: () => pick(AWS_SERVICES),
  awsOperation: () => pick(AWS_OPERATIONS),
  operation: () => pick(['GetUser', 'CreateOrder', 'ProcessPayment', 'UpdateInventory', 'SendNotification']),
  user: () => faker.internet.email(),
  instanceId: () => `i-${faker.string.alphanumeric(8)}`,
  region: () => pick(['us-east-1', 'us-west-2', 'eu-west-1']),
  bucketName: () => `${faker.lorem.word()}-bucket`,
  functionName: () => `${faker.lorem.word()}-function`,
  memoryUsed: () => int(64, 3008),
  coldStart: () => faker.datatype.boolean(),
  currentCapacity: () => int(1, 20),
  metricName: () => pick(['CPUUtilization', 'NetworkIn', 'NetworkOut', 'DiskReadOps', 'StatusCheckFailed']),
  namespace: () => pick(['AWS/EC2', 'AWS/RDS', 'AWS/Lambda', 'AWS/ELB']),
  value: () => float(0, 100, 2),

  // Authentication
  username: () => faker.internet.username(),
  sessionId: () => faker.string.uuid(),
  attemptCount: () => int(1, 5),
  totalAttempts: () => int(5, 50),
  location: () => `${faker.location.city()}, ${faker.location.country()}`,
  previousLocation: () => `${faker.location.city()}, ${faker.location.country()}`,
  authMethod: () => pick(['password', 'mfa', 'sso', 'certificate', 'api-key']),
  failureReason: () => pick(['invalid_password', 'unknown_user', 'account_disabled', 'mfa_failed', 'expired_password']),
  lockDuration: () => pick([5, 15, 30, 60]),
  logoutReason: () => pick(['user_initiated', 'session_timeout', 'admin_forced', 'token_revoked']),
  policyName: () => pick(['password-complexity', 'password-expiry', 'mfa-required', 'geo-restriction']),
  passwordAge: () => int(0, 365),
  tokenType: () => pick(['access', 'refresh', 'id']),
  expiryTime: () => soon(1),

  // Database
  queryType: () => pick(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
  tableName: () => pick(['users', 'orders', 'products', 'sessions', 'logs']),
  query: () => pick([
    'SELECT * FROM users WHERE active = true',
    'UPDATE orders SET status = \'shipped\' WHERE id = 12345',
    'INSERT INTO sessions (user_id, token) VALUES (?, ?)',
    'DELETE FROM temp_data WHERE created_at < NOW() - INTERVAL 1 DAY'
  ]),
  transactionId: () => faker.string.alphanumeric(8),
  poolName: () => pick(['main-pool', 'read-pool', 'write-pool']),
  tableCount: () => int(1, 5),
  affectedTables: () => faker.helpers.arrayElements(['users', 'orders', 'products', 'sessions', 'payments'], 2).join(','),
  connectionCount: () => int(50, 100),
  maxConnections: () => 100,
  dbName: () => pick(['production', 'staging', 'analytics']),
  database: () => pick(['production', 'staging', 'analytics']),
  dbUser: () => pick(['app_user', 'readonly', 'etl_service', 'admin', 'reporting']),
  rowCount: () => int(1, 100000),
  estimatedSize: () => float(0.1, 500),

  // Web server
  responseSize: () => int(100, 50000),
  userAgent: () => faker.internet.userAgent(),
  requestCount: () => int(100, 1000),
  backendHost: () => faker.internet.domainName(),
  backendPool: () => pick(['app-pool', 'api-pool', 'static-pool']),
  errorCode: () => pick([502, 503, 504]),
  certName: () => faker.internet.domainName(),
  certType: () => pick(['DV', 'OV', 'EV', 'wildcard']),
  issuer: () => pick(['Let\'s Encrypt', 'DigiCert', 'Sectigo', 'GlobalSign']),
  daysToExpiry: () => int(1, 90),
  timeout: () => int(30, 120),
  blockDuration: () => pick([60, 300, 900, 3600]),

  // Email
  sender: () => faker.internet.email(),
  recipient: () => faker.internet.email(),
  subject: () => pick(['Welcome to our platform!', 'Password reset request', 'Order confirmation #12345', 'Monthly newsletter', 'Account verification required', 'New message from support']),
  messageId: () => faker.string.uuid(),
  retryCount: () => int(1, 5),
  maxRetries: () => pick([3, 5, 10]),
  delayTime: () => int(60, 3600),
  spamScore: () => float(5, 10),
  bounceReason: () => pick(['mailbox_full', 'user_unknown', 'domain_not_found', 'rejected_by_policy']),
  filterRule: () => pick(['spam-score', 'blocked-sender', 'attachment-type', 'phishing-link']),
  threatType: () => pick(['phishing', 'malware', 'spam', 'spoofing']),
  quotaLimit: () => pick([100, 250, 500, 1000]),
  quotaType: () => pick(['daily_send', 'hourly_send', 'storage']),
  currentUsage: () => int(80, 1000),
  resetTime: () => soon(1),
  size: () => int(1024, 26214400),

  // Backup
  backupName: () => `${pick(['database', 'application', 'logs', 'config'])}_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`,
  backupType: () => pick(['full', 'incremental', 'differential']),
  backupSize: () => float(0.5, 100),
  currentSize: () => float(1, 50),
  previousSize: () => float(0.8, 45),
  growthRate: () => float(-5, 40),
  deletedCount: () => int(1, 20),
  availableSpace: () => float(0.1, 10),
  storagePath: () => pick(['/backup/primary', '/backup/secondary', '/mnt/backup-nfs']),
  algorithm: () => pick(['gzip', 'zstd', 'lz4', 'AES-256']),
  checksum: () => hex(64),
  compressionRatio: () => float(1.2, 8, 2),
  corruptionCount: () => int(1, 10),
  integrity: () => pick(['verified', 'failed', 'partial']),
  fileCount: () => int(10, 500000),
  freedSpace: () => float(0.1, 50),
  cleanupDuration: () => int(5, 600),
  verifyDuration: () => int(10, 1800),
  retentionPolicy: () => pick(['7d', '30d', '90d', '1y']),
  lastSuccess: () => recent(7),
  nextCleanup: () => soon(1),
  oldestBackup: () => recent(90),

  // Microservices
  targetService: () => pick(SERVICES),
  failureRate: () => int(50, 95),
  consecutiveFailures: () => int(3, 20),
  lastFailure: () => recent(1),
  openDuration: () => int(10, 300),
  healthEndpoint: () => '/health',
  oldInstances: () => int(1, 5),
  newInstances: () => int(2, 10),
  scalingDuration: () => int(5, 300),
  serviceUrl: () => `http://${faker.internet.domainName()}:${faker.internet.port()}`,

  // IoT
  deviceId: () => `${pick(['SENS', 'CAM', 'THERM', 'LOCK', 'GW'])}-${int(1000, 9999)}`,
  deviceIP: () => faker.internet.ipv4(),
  deviceType: () => pick(['sensor', 'camera', 'thermostat', 'smart-lock', 'gateway']),
  batteryLevel: () => int(5, 25),
  batteryType: () => pick(['Li-ion', 'LiPo', 'NiMH', 'alkaline']),
  lastCharge: () => recent(30),
  estimatedRuntime: () => int(1, 72),
  lastSeen: () => faker.date.recent({ days: 1 }).toISOString(),
  temperature: () => float(15, 35),
  humidity: () => int(30, 80),
  pressure: () => float(980, 1040),
  signalStrength: () => int(-95, -40),
  connectionType: () => pick(['wifi', 'zigbee', 'lora', 'cellular', 'bluetooth']),
  storageUsage: () => int(50, 99),
  dataQuality: () => pick(['good', 'degraded', 'poor']),
  calibrationDate: () => recent(365),
  firmwareVersion: () => semver(),
  currentVersion: () => semver(),
  latestVersion: () => semver(),
  updateAvailable: () => faker.datatype.boolean(),
  patchCount: () => int(1, 12),
  vulnerabilityCount: () => int(1, 8)
};

/** A plausible value for a placeholder that has no entry above, based on its name */
export function guessValue(name: string): PlaceholderValue {
  const lower = name.toLowerCase();
  if (/(ip|address)$/.test(lower)) return faker.internet.ipv4();
  if (/port$/.test(lower)) return faker.internet.port();
  if (/(id|uuid)$/.test(lower)) return faker.string.alphanumeric(12);
  if (/(time|date|at)$/.test(lower)) return recent(7);
  if (/(duration|latency|ms|seconds|timeout|delay)$/.test(lower)) return int(1, 5000);
  if (/(count|total|size|bytes|number|num)$/.test(lower)) return int(1, 10000);
  if (/(rate|ratio|percent|usage|level|score)$/.test(lower)) return int(0, 100);
  if (/(host|domain)$/.test(lower)) return faker.internet.domainName();
  if (/(user|username)$/.test(lower)) return faker.internet.username();
  if (/email$/.test(lower)) return faker.internet.email();
  return faker.lorem.word();
}
