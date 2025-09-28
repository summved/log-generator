/**
 * AI-Enhanced Attack Chain Types
 * Supports flexible enhancement modes with local AI models
 */

import { AttackChain, AttackChainStep, AttackChainExecution } from './attackChain';

export type AttackChainMode = 'static' | 'enhanced' | 'dynamic';

export type AILevel = 'basic' | 'medium' | 'high' | 'advanced';

export interface AIEnhancementConfig {
  mode: AttackChainMode;
  aiLevel: AILevel;
  enabledFeatures: {
    timingRandomization: boolean;
    techniqueSubstitution: boolean;
    evasionTactics: boolean;
    adaptiveDelays: boolean;
    logVariation: boolean;
    scenarioGeneration: boolean;
  };
  localModels: {
    enabled: boolean;
    modelPath?: string;
    maxMemoryMB?: number;
  };
  variations: {
    count: number;
    difficulty: 'progressive' | 'random' | 'adaptive';
  };
}

export interface EnhancedAttackChain extends AttackChain {
  originalChain: AttackChain;
  enhancementLevel: AILevel;
  enhancementType: 'timing' | 'technique' | 'evasion' | 'scenario';
  aiGenerated: boolean;
  variations: AttackChainVariation[];
  metadata: {
    author: string;
    version: string;
    created: string;
    tags: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    estimated_duration: number;
    // AI-specific metadata
    baseTemplate: string;
    enhancementDate: Date;
    aiModel?: string;
    confidenceScore: number;
    realismScore: number;
  };
}

export interface AttackChainVariation {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  changes: AttackChainChange[];
  estimatedDuration: number;
  detectionDifficulty: number; // 0-1 scale
}

export interface AttackChainChange {
  stepId: string;
  changeType: 'timing' | 'technique' | 'evasion' | 'logs' | 'metadata';
  originalValue: any;
  newValue: any;
  reason: string;
  mitreMapping?: {
    originalTechnique: string;
    newTechnique: string;
    equivalentGoal: string;
  };
}

export interface TechniqueSubstitution {
  originalTechnique: string;
  substitutions: {
    technique: string;
    tactic: string;
    subtechnique: string;
    description: string;
    difficulty: number;
    detectability: number;
    equivalentGoal: string;
  }[];
}

export interface EvasionTactic {
  id: string;
  name: string;
  description: string;
  applicableTechniques: string[];
  evasionMethods: {
    timing: string[];
    obfuscation: string[];
    livingOffTheLand: string[];
    antiForensics: string[];
  };
  detectionBypass: string[];
}

export interface AIModelInfo {
  name: string;
  type: 'local_llm' | 'knowledge_base' | 'rule_engine' | 'ml_classifier';
  version: string;
  size: number; // bytes
  capabilities: string[];
  requirements: {
    memory: number; // MB
    cpu: number; // cores
    gpu?: boolean;
  };
  downloadUrl?: string;
  localPath?: string;
  loaded: boolean;
}

export interface LocalAIOrchestrator {
  models: Map<string, AIModelInfo>;
  knowledgeBase: MitreKnowledgeBase;
  enhancementEngine: EnhancementEngine;
}

export interface MitreKnowledgeBase {
  techniques: Map<string, MitreTechnique>;
  tactics: Map<string, MitreTactic>;
  relationships: TechniqueRelationship[];
  substitutions: Map<string, TechniqueSubstitution>;
  evasionTactics: Map<string, EvasionTactic>;
}

export interface MitreTechnique {
  id: string;
  name: string;
  description: string;
  tactics: string[];
  platforms: string[];
  dataComponents: string[];
  defenses: string[];
  equivalents: string[]; // Techniques with similar goals
  alternatives: string[]; // Different ways to achieve same goal
  difficulty: number; // 1-10 scale
  detectability: number; // 1-10 scale (higher = easier to detect)
}

export interface MitreTactic {
  id: string;
  name: string;
  description: string;
  techniques: string[];
}

export interface TechniqueRelationship {
  source: string;
  target: string;
  relationship: 'equivalent' | 'alternative' | 'prerequisite' | 'enables' | 'follows';
  confidence: number;
}

export interface EnhancementEngine {
  enhanceChain(chain: AttackChain, config: AIEnhancementConfig): Promise<EnhancedAttackChain>;
  generateVariations(chain: AttackChain, count: number): Promise<AttackChainVariation[]>;
  substituteStep(step: AttackChainStep, difficulty: AILevel): Promise<AttackChainStep>;
  addEvasionTactics(step: AttackChainStep): Promise<AttackChainStep>;
  randomizeTiming(step: AttackChainStep, variance: number): AttackChainStep;
}

export interface AIAttackExecution extends AttackChainExecution {
  enhancementConfig: AIEnhancementConfig;
  originalChain: AttackChain;
  enhancedChain: EnhancedAttackChain;
  adaptations: AttackAdaptation[];
  aiMetrics: {
    enhancementTime: number;
    confidenceScore: number;
    realismScore: number;
    variationCount: number;
  };
}

export interface AttackAdaptation {
  timestamp: Date;
  stepId: string;
  trigger: string;
  originalAction: string;
  adaptedAction: string;
  reason: string;
  confidence: number;
}

export interface ScenarioGenerationPrompt {
  adversaryProfile: 'apt' | 'ransomware' | 'insider' | 'script_kiddie' | 'nation_state';
  targetEnvironment: 'healthcare' | 'finance' | 'manufacturing' | 'government' | 'retail';
  objectives: string[];
  constraints: {
    duration: number; // minutes
    stealthLevel: number; // 1-10
    sophistication: number; // 1-10
  };
  basedOn?: string; // Existing chain to enhance
}

export interface GeneratedScenario {
  id: string;
  name: string;
  description: string;
  chain: AttackChain;
  prompt: ScenarioGenerationPrompt;
  metadata: {
    generatedBy: string;
    generationTime: Date;
    confidenceScore: number;
    novelty: number; // How different from existing chains
    realism: number; // How realistic the scenario is
  };
}

