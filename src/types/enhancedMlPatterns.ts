/**
 * Enhanced ML Patterns Types
 * Extended types for advanced ML capabilities including NLP, anomaly detection, and threat intelligence
 */

import { MLLogGenerationConfig } from './mlPatterns';

export interface EnhancedMLConfig extends MLLogGenerationConfig {
  nlp: {
    enabled: boolean;
    models: {
      textGeneration: string;
      semanticAnalysis: string;
      classification: string;
      sentiment: string;
    };
    apiKeys?: {
      huggingface?: string;
      openai?: string;
    };
    cacheEnabled: boolean;
    cacheTTL: number; // seconds
  };
  
  anomalyDetection: {
    models: {
      isolationForest: boolean;
      oneClassSVM: boolean;
      autoEncoder: boolean;
      statisticalOutlier: boolean;
    };
    thresholds: {
      anomalyScore: number;
      confidenceLevel: number;
      statisticalThreshold: number;
    };
    ensembleWeights: {
      isolationForest: number;
      oneClassSVM: number;
      autoEncoder: number;
      statistical: number;
    };
  };
  
  timeSeriesForecasting: {
    enabled: boolean;
    models: {
      prophet: boolean;
      lstm: boolean;
      arima: boolean;
      seasonalDecompose: boolean;
    };
    forecastHorizon: number; // hours
    seasonalityPeriods: {
      daily: boolean;
      weekly: boolean;
      monthly: boolean;
      yearly: boolean;
    };
  };
  
  threatIntelligence: {
    enabled: boolean;
    sources: string[];
    updateInterval: number; // hours
    models: {
      iocDetection: boolean;
      behavioralAnalysis: boolean;
      mitreMapping: boolean;
      riskScoring: boolean;
    };
    confidence: {
      minThreshold: number;
      highThreshold: number;
    };
  };
  
  performance: {
    modelCaching: boolean;
    parallelProcessing: boolean;
    batchSize: number;
    maxMemoryUsage: number; // MB
    gpuAcceleration: boolean;
  };
}

export interface NLPModel {
  name: string;
  type: 'transformer' | 'statistical' | 'rule-based';
  loaded: boolean;
  lastUsed: Date;
  memoryUsage: number;
  performance: {
    avgInferenceTime: number;
    accuracy: number;
    throughput: number;
  };
}

export interface AnomalyModel {
  name: string;
  type: 'isolation_forest' | 'one_class_svm' | 'autoencoder' | 'statistical';
  trained: boolean;
  lastTrained: Date;
  performance: {
    precision: number;
    recall: number;
    f1Score: number;
    falsePositiveRate: number;
  };
  parameters: Record<string, any>;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  anomalyScore: number;
  confidence: number;
  modelName: string;
  features: string[];
  explanation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export interface TimeSeriesForecast {
  timestamp: Date;
  predicted: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: Record<string, number>;
}

export interface ThreatIntelligenceResult {
  ioc: string;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email';
  threat: boolean;
  confidence: number;
  sources: string[];
  lastSeen: Date;
  tags: string[];
  mitreMapping?: {
    technique: string;
    tactic: string;
    subtechnique?: string;
  };
  riskScore: number;
}

export interface ModelPerformanceMetrics {
  modelId: string;
  modelType: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  inferenceTime: number;
  memoryUsage: number;
  lastEvaluated: Date;
  trainingData: {
    samples: number;
    features: number;
    lastTraining: Date;
  };
}

export interface MLPipeline {
  id: string;
  name: string;
  stages: MLPipelineStage[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  performance: ModelPerformanceMetrics;
}

export interface MLPipelineStage {
  name: string;
  type: 'preprocessing' | 'feature_extraction' | 'model_training' | 'validation' | 'deployment';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  parameters: Record<string, any>;
  outputs?: Record<string, any>;
}

export interface NLPAnalysisResult {
  text: string;
  sentiment: {
    polarity: number;
    subjectivity: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  entities: {
    text: string;
    label: string;
    confidence: number;
    start: number;
    end: number;
  }[];
  topics: {
    topic: string;
    probability: number;
  }[];
  keywords: string[];
  readability: number;
  language: string;
  confidence: number;
}

export interface BehavioralPattern {
  patternId: string;
  patternType: 'user' | 'system' | 'application' | 'network';
  description: string;
  frequency: number;
  confidence: number;
  features: Record<string, number>;
  examples: string[];
  anomalyThreshold: number;
  lastObserved: Date;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface MLModelRegistry {
  models: Map<string, MLModelInfo>;
  loadedModels: Map<string, any>;
  modelConfigs: Map<string, Record<string, any>>;
  performanceHistory: Map<string, ModelPerformanceMetrics[]>;
}

export interface MLModelInfo {
  id: string;
  name: string;
  version: string;
  type: 'nlp' | 'anomaly_detection' | 'time_series' | 'threat_intelligence';
  framework: 'transformers' | 'scikit-learn' | 'tensorflow' | 'pytorch' | 'custom';
  status: 'available' | 'loaded' | 'training' | 'deprecated';
  size: number; // bytes
  lastUpdated: Date;
  description: string;
  tags: string[];
  requirements: string[];
  configuration: Record<string, any>;
}

export interface EnhancedLogContext {
  userId?: string;
  systemId?: string;
  applicationId?: string;
  sessionId?: string;
  timestamp?: Date;
  businessContext?: {
    department: string;
    role: string;
    workingHours: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
  technicalContext?: {
    sourceIP: string;
    userAgent: string;
    protocol: string;
    port: number;
  };
  securityContext?: {
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    mitreMapping?: {
      technique: string;
      tactic: string;
    };
    iocs?: string[];
  };
}

export interface MLGenerationRequest {
  sourceType: string;
  count: number;
  context: EnhancedLogContext;
  options: {
    nlpEnabled: boolean;
    anomalyRate: number;
    realism: number;
    timeRange: {
      start: Date;
      end: Date;
    };
    outputFormat: 'json' | 'syslog' | 'cef' | 'leef';
  };
}

export interface MLGenerationResponse {
  logs: any[];
  metadata: {
    totalGenerated: number;
    anomaliesGenerated: number;
    processingTime: number;
    modelsUsed: string[];
    qualityScore: number;
  };
  performance: {
    throughput: number;
    accuracy: number;
    memoryUsage: number;
  };
}

