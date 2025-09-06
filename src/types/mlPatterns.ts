/**
 * ML-Based Log Pattern Types
 * Defines structures for machine learning-based log pattern generation
 */

/**
 * User behavior pattern learned from historical data
 */
export interface UserBehaviorPattern {
  userId: string;
  department: string;
  role: string;
  
  // Temporal patterns
  workingHours: {
    start: number; // hour of day (0-23)
    end: number;
    timezone: string;
    daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  };
  
  // Activity patterns
  activityPatterns: {
    loginFrequency: number; // logins per day
    applicationUsage: Record<string, number>; // app -> usage frequency
    fileAccessPatterns: string[]; // common file paths/types
    networkActivity: {
      internalConnections: number;
      externalConnections: number;
      dataTransferVolume: number; // MB per day
    };
  };
  
  // Behavioral characteristics
  characteristics: {
    errorProneness: number; // 0-1, likelihood of generating errors
    securityAwareness: number; // 0-1, likelihood of security violations
    productivityLevel: number; // 0-1, activity intensity
    riskTolerance: number; // 0-1, likelihood of risky actions
  };
  
  // Learned anomaly patterns
  anomalyPatterns: {
    unusualLoginTimes: number[]; // hours when user occasionally logs in
    officeVpnUsage: number; // frequency of VPN usage
    bulkFileOperations: number; // frequency of bulk operations
    privilegeEscalations: number; // frequency of admin actions
  };
}

/**
 * System behavior pattern for infrastructure components
 */
export interface SystemBehaviorPattern {
  systemId: string;
  systemType: 'server' | 'database' | 'firewall' | 'application' | 'network';
  
  // Performance baselines
  performanceBaseline: {
    cpuUsage: { mean: number; stdDev: number; };
    memoryUsage: { mean: number; stdDev: number; };
    diskIO: { mean: number; stdDev: number; };
    networkIO: { mean: number; stdDev: number; };
    responseTime: { mean: number; stdDev: number; };
  };
  
  // Traffic patterns
  trafficPatterns: {
    peakHours: number[]; // hours of peak activity
    dailyVolume: { mean: number; stdDev: number; };
    requestTypes: Record<string, number>; // request type -> frequency
    errorRates: Record<string, number>; // error type -> rate
  };
  
  // Seasonal patterns
  seasonalPatterns: {
    weeklyPattern: number[]; // activity level by day of week
    monthlyPattern: number[]; // activity level by day of month
    holidayImpact: number; // activity reduction during holidays
  };
  
  // Maintenance and update patterns
  maintenancePatterns: {
    scheduledDowntime: string[]; // cron expressions
    updateFrequency: number; // days between updates
    restartPatterns: number[]; // hours when restarts typically occur
  };
}

/**
 * Security event pattern for generating realistic threats
 */
export interface SecurityEventPattern {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // MITRE ATT&CK mapping
  mitre: {
    technique: string;
    tactic: string;
    subtechnique?: string;
  };
  
  // Frequency and timing
  frequency: {
    baseRate: number; // events per day under normal conditions
    seasonality: number[]; // multiplier by hour of day
    burstProbability: number; // likelihood of event bursts
    burstSize: { min: number; max: number; };
  };
  
  // Context patterns
  contextPatterns: {
    sourceIPs: string[]; // common source IP patterns
    targetSystems: string[]; // commonly targeted systems
    userAgents: string[]; // common user agents for web attacks
    payloadPatterns: string[]; // common attack payloads
  };
  
  // Correlation patterns
  correlationPatterns: {
    precedingEvents: string[]; // events that often precede this one
    followingEvents: string[]; // events that often follow this one
    timeDelays: number[]; // typical delays between correlated events
  };
}

/**
 * Application usage pattern for realistic business logic
 */
export interface ApplicationUsagePattern {
  applicationId: string;
  applicationName: string;
  
  // User interaction patterns
  userInteractions: {
    sessionDuration: { mean: number; stdDev: number; };
    actionsPerSession: { mean: number; stdDev: number; };
    commonWorkflows: Array<{
      name: string;
      steps: string[];
      frequency: number;
      duration: number;
    }>;
  };
  
  // Business logic patterns
  businessPatterns: {
    transactionVolumes: Record<string, number>; // transaction type -> volume
    peakBusinessHours: number[]; // hours of peak business activity
    seasonalTrends: Record<string, number>; // month -> activity multiplier
    departmentUsage: Record<string, number>; // department -> usage frequency
  };
  
  // Error and exception patterns
  errorPatterns: {
    commonErrors: Record<string, number>; // error type -> frequency
    errorCorrelations: Record<string, string[]>; // error -> related errors
    recoveryPatterns: Record<string, number>; // error -> recovery time
  };
}

/**
 * ML model for pattern prediction and generation
 */
export interface MLPatternModel {
  modelId: string;
  modelType: 'user_behavior' | 'system_performance' | 'security_events' | 'application_usage';
  version: string;
  
  // Training metadata
  trainingData: {
    sourceFiles: string[];
    trainingPeriod: { start: Date; end: Date; };
    sampleSize: number;
    features: string[];
  };
  
  // Model parameters
  parameters: {
    algorithm: 'lstm' | 'random_forest' | 'gaussian_mixture' | 'markov_chain';
    hyperparameters: Record<string, any>;
    featureWeights: Record<string, number>;
  };
  
  // Model performance metrics
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    lastEvaluated: Date;
  };
  
  // Prediction capabilities
  predictions: {
    canPredictNext: boolean; // can predict next log entry
    canPredictAnomaly: boolean; // can predict anomalous behavior
    canPredictVolume: boolean; // can predict log volume
    predictionHorizon: number; // hours into future it can predict
  };
}

/**
 * ML-based log generation configuration
 */
export interface MLLogGenerationConfig {
  // Learning configuration
  learning: {
    enabled: boolean;
    learningRate: number;
    adaptationPeriod: number; // hours between model updates
    minSampleSize: number; // minimum samples needed for learning
    maxHistoryDays: number; // days of history to consider
  };
  
  // Pattern application
  patternApplication: {
    userBehaviorWeight: number; // 0-1, how much to weight user patterns
    systemBehaviorWeight: number; // 0-1, how much to weight system patterns
    securityEventWeight: number; // 0-1, how much to weight security patterns
    randomnessLevel: number; // 0-1, amount of randomness to inject
  };
  
  // Anomaly generation
  anomalyGeneration: {
    enabled: boolean;
    anomalyRate: number; // percentage of logs that should be anomalous
    severityDistribution: Record<string, number>; // severity -> percentage
    realismLevel: number; // 0-1, how realistic anomalies should be
  };
  
  // Adaptation settings
  adaptation: {
    enabled: boolean;
    feedbackLoop: boolean; // use generated logs to improve patterns
    crossValidation: boolean; // validate patterns against known data
    driftDetection: boolean; // detect when patterns change over time
  };
}

/**
 * Real-time pattern analysis result
 */
export interface PatternAnalysisResult {
  analysisId: string;
  timestamp: Date;
  
  // Detected patterns
  detectedPatterns: {
    userBehaviorChanges: Array<{
      userId: string;
      change: string;
      confidence: number;
      impact: 'low' | 'medium' | 'high';
    }>;
    systemPerformanceShifts: Array<{
      systemId: string;
      metric: string;
      change: number;
      confidence: number;
    }>;
    securityEventTrends: Array<{
      eventType: string;
      trend: 'increasing' | 'decreasing' | 'stable';
      confidence: number;
    }>;
  };
  
  // Recommendations
  recommendations: {
    modelUpdates: string[];
    configurationChanges: string[];
    alertThresholds: Record<string, number>;
  };
  
  // Quality metrics
  qualityMetrics: {
    patternCoverage: number; // percentage of logs matching learned patterns
    anomalyDetectionRate: number; // percentage of anomalies detected
    falsePositiveRate: number; // percentage of false anomaly alerts
    modelDrift: number; // amount of drift detected in models
  };
}

/**
 * ML pattern learning engine state
 */
export interface MLPatternEngineState {
  engineId: string;
  status: 'learning' | 'generating' | 'adapting' | 'idle' | 'error';
  
  // Learning progress
  learningProgress: {
    totalSamples: number;
    processedSamples: number;
    currentPhase: 'data_collection' | 'feature_extraction' | 'model_training' | 'validation';
    estimatedCompletion: Date;
  };
  
  // Active models
  activeModels: {
    userBehaviorModels: number;
    systemBehaviorModels: number;
    securityEventModels: number;
    applicationUsageModels: number;
  };
  
  // Performance statistics
  statistics: {
    logsGenerated: number;
    patternsLearned: number;
    anomaliesGenerated: number;
    accuracyScore: number;
    lastModelUpdate: Date;
  };
  
  // Resource usage
  resourceUsage: {
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
    diskUsage: number; // MB
    processingTime: number; // ms per log
  };
}
