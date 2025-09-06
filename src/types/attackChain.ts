/**
 * Attack Chain Simulation Types
 * Defines structures for multi-stage MITRE ATT&CK technique sequences
 */

import { MitreAttackInfo } from './index';

/**
 * Represents a single step in an attack chain
 */
export interface AttackChainStep {
  id: string;
  name: string;
  description: string;
  mitre: MitreAttackInfo;
  
  // Timing configuration
  timing: {
    delayAfterPrevious: number; // milliseconds to wait after previous step
    duration: number; // how long this step should run (milliseconds)
    variance: number; // random variance percentage (0-1)
  };
  
  // Dependencies and conditions
  dependencies?: string[]; // IDs of steps that must complete first
  conditions?: AttackCondition[]; // Additional conditions to check
  
  // Log generation configuration
  logGeneration: {
    templates: string[]; // specific log templates to use
    frequency: number; // logs per minute during this step
    sources: string[]; // which log sources should generate these logs
    customData?: Record<string, any>; // additional metadata
  };
  
  // Success criteria
  successCriteria?: {
    minLogsGenerated: number;
    requiredPatterns: string[];
  };
}

/**
 * Condition that must be met for a step to execute
 */
export interface AttackCondition {
  type: 'time_window' | 'log_count' | 'custom';
  parameters: Record<string, any>;
}

/**
 * Complete attack chain definition
 */
export interface AttackChain {
  id: string;
  name: string;
  description: string;
  category: 'apt' | 'ransomware' | 'insider_threat' | 'supply_chain' | 'custom';
  
  // Metadata
  metadata: {
    author: string;
    version: string;
    created: string;
    tags: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    estimated_duration: number; // total estimated duration in minutes
  };
  
  // MITRE ATT&CK mapping
  mitre_mapping: {
    tactics: string[]; // All tactics covered in this chain
    techniques: string[]; // All techniques used
    kill_chain_phases: string[]; // Lockheed Martin Kill Chain phases
  };
  
  // Attack steps in execution order
  steps: AttackChainStep[];
  
  // Global configuration
  config: {
    max_duration: number; // maximum total execution time (milliseconds)
    abort_on_step_failure: boolean;
    log_chain_progress: boolean;
    cleanup_after_completion: boolean;
  };
}

/**
 * Attack chain execution state
 */
export interface AttackChainExecution {
  chainId: string;
  executionId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
  
  // Timing information
  startTime?: Date;
  endTime?: Date;
  estimatedEndTime?: Date;
  
  // Progress tracking
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  totalSteps: number;
  
  // Statistics
  stats: {
    logsGenerated: number;
    stepsCompleted: number;
    stepsFailed: number;
    averageStepDuration: number;
  };
  
  // Error information
  lastError?: {
    stepId: string;
    message: string;
    timestamp: Date;
  };
}

/**
 * Attack chain template for predefined scenarios
 */
export interface AttackChainTemplate {
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  use_cases: string[];
  chain: AttackChain;
}

/**
 * Configuration for attack chain execution
 */
export interface AttackChainExecutionConfig {
  // Timing modifiers
  speed_multiplier: number; // 1.0 = normal speed, 0.5 = half speed, 2.0 = double speed
  
  // Logging configuration
  enable_progress_logging: boolean;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  
  // Output configuration
  output_directory?: string;
  generate_execution_report: boolean;
  
  // Behavior modifiers
  allow_step_skipping: boolean;
  continue_on_failure: boolean;
  randomize_timing: boolean;
}

/**
 * Attack chain execution report
 */
export interface AttackChainReport {
  execution: AttackChainExecution;
  chain: AttackChain;
  
  // Detailed step results
  step_results: Array<{
    step: AttackChainStep;
    status: 'completed' | 'failed' | 'skipped';
    start_time: Date;
    end_time: Date;
    duration: number;
    logs_generated: number;
    errors?: string[];
  }>;
  
  // Summary statistics
  summary: {
    total_duration: number;
    success_rate: number;
    total_logs_generated: number;
    mitre_techniques_executed: string[];
    mitre_tactics_covered: string[];
  };
  
  // Generated file paths
  output_files: {
    logs: string[];
    reports: string[];
    artifacts: string[];
  };
}
