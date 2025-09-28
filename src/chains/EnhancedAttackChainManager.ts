/**
 * Enhanced Attack Chain Manager
 * Extends the original AttackChainManager with AI capabilities
 * Provides flexible execution modes while maintaining backward compatibility
 */

import { AttackChainManager } from './AttackChainManager';
import { EnhancedAttackChainEngine } from './EnhancedAttackChainEngine';
import { LocalAIOrchestrator } from '../ai/LocalAIOrchestrator';
import { 
  AttackChainExecutionConfig,
  AttackChainTemplate 
} from '../types/attackChain';
import {
  AIEnhancementConfig,
  AIAttackExecution,
  AttackChainMode,
  AILevel,
  EnhancedAttackChain
} from '../types/aiAttackChain';
import { logger } from '../utils/logger';

export interface EnhancedExecutionOptions {
  mode?: AttackChainMode;
  aiLevel?: AILevel;
  variations?: number;
  enableEvasion?: boolean;
  adaptiveDelays?: boolean;
  progressiveTraining?: boolean;
  delayBetweenVariations?: number;
  logGeneratorConfig?: string;
}

export class EnhancedAttackChainManager extends AttackChainManager {
  private enhancedEngine: EnhancedAttackChainEngine;
  private aiOrchestrator: LocalAIOrchestrator;
  private executionHistory: AIAttackExecution[] = [];

  constructor(templatesDirectory?: string, aiModelsDirectory?: string) {
    super(templatesDirectory);
    
    this.aiOrchestrator = new LocalAIOrchestrator();
    this.enhancedEngine = new EnhancedAttackChainEngine(undefined, this.aiOrchestrator);

    // Set up event forwarding
    this.setupEventHandlers();

    logger.info('Enhanced Attack Chain Manager initialized with AI capabilities');
  }

  /**
   * Execute attack chain with AI enhancements (new primary method)
   */
  async executeEnhancedChain(
    chainIdOrName: string,
    options: EnhancedExecutionOptions = {}
  ): Promise<AIAttackExecution> {
    const template = this.getTemplate(chainIdOrName);
    if (!template) {
      throw new Error(`Attack chain not found: ${chainIdOrName}`);
    }

    const {
      mode = 'static',
      aiLevel = 'basic',
      variations = 1,
      enableEvasion = false,
      adaptiveDelays = true,
      logGeneratorConfig
    } = options;

    logger.info(`Executing enhanced attack chain: ${template.name}`, {
      mode,
      aiLevel,
      variations,
      enableEvasion
    });

    try {
      const execution = await this.enhancedEngine.executeChainWithAI(
        template.chain,
        mode,
        aiLevel,
        {
          variations,
          enableEvasion,
          adaptiveDelays,
          logGeneratorConfig
        }
      );

      // Store execution in history
      this.executionHistory.push(execution);

      // Keep only last 100 executions
      if (this.executionHistory.length > 100) {
        this.executionHistory = this.executionHistory.slice(-100);
      }

      return execution;

    } catch (error) {
      logger.error(`Failed to execute enhanced chain: ${template.name}`, error);
      throw error;
    }
  }

  /**
   * Execute multiple variations for training purposes
   */
  async executeTrainingSession(
    chainIdOrName: string,
    sessionConfig: {
      variationCount?: number;
      progressiveMode?: boolean;
      delayBetweenVariations?: number;
      logGeneratorConfig?: string;
    } = {}
  ): Promise<AIAttackExecution[]> {
    const template = this.getTemplate(chainIdOrName);
    if (!template) {
      throw new Error(`Attack chain not found: ${chainIdOrName}`);
    }

    const {
      variationCount = 5,
      progressiveMode = true,
      delayBetweenVariations = 30000, // 30 seconds
      logGeneratorConfig
    } = sessionConfig;

    logger.info(`Starting training session: ${template.name}`, {
      variationCount,
      progressiveMode
    });

    try {
      const executions = await this.enhancedEngine.executeChainVariations(
        template.chain,
        variationCount,
        progressiveMode,
        {
          logGeneratorConfig,
          delayBetweenVariations
        }
      );

      // Add to execution history
      this.executionHistory.push(...executions);

      logger.info(`Training session completed: ${template.name}`, {
        executedVariations: executions.length,
        totalLogs: executions.reduce((sum, exec) => sum + exec.stats.logsGenerated, 0)
      });

      return executions;

    } catch (error) {
      logger.error(`Training session failed: ${template.name}`, error);
      throw error;
    }
  }

  /**
   * Execute original attack chain (backward compatibility)
   */
  async executeChain(
    chainId: string,
    config?: Partial<AttackChainExecutionConfig>,
    logGeneratorConfig?: string
  ): Promise<AIAttackExecution> {
    // Use the parent method but wrap result in AI execution format
    const baseExecution = await super.executeChain(chainId, config, logGeneratorConfig);
    const template = this.getTemplate(chainId);
    
    if (!template) {
      throw new Error(`Template not found for chain: ${chainId}`);
    }

    // Convert to AI execution format for consistency
    const aiExecution: AIAttackExecution = {
      ...baseExecution,
      enhancementConfig: {
        mode: 'static',
        aiLevel: 'basic',
        enabledFeatures: {
          timingRandomization: false,
          techniqueSubstitution: false,
          evasionTactics: false,
          adaptiveDelays: false,
          logVariation: false,
          scenarioGeneration: false
        },
        localModels: { enabled: false },
        variations: { count: 1, difficulty: 'random' }
      },
      originalChain: template.chain,
      enhancedChain: {
        ...template.chain,
        originalChain: template.chain,
        enhancementLevel: 'basic',
        enhancementType: 'timing',
        aiGenerated: false,
        variations: [],
        metadata: {
          baseTemplate: template.name,
          enhancementDate: new Date(),
          confidenceScore: 1.0,
          realismScore: 0.8
        }
      },
      adaptations: [],
      aiMetrics: {
        enhancementTime: 0,
        confidenceScore: 1.0,
        realismScore: 0.8,
        variationCount: 0
      }
    };

    this.executionHistory.push(aiExecution);
    return aiExecution;
  }

  /**
   * Get available enhancement options for a chain
   */
  getEnhancementOptions(chainIdOrName: string): {
    template: AttackChainTemplate;
    availableModes: ReturnType<EnhancedAttackChainEngine['getAvailableModes']>;
    availableLevels: ReturnType<EnhancedAttackChainEngine['getAvailableAILevels']>;
    recommendations: {
      beginnerMode: AttackChainMode;
      beginnerLevel: AILevel;
      expertMode: AttackChainMode;
      expertLevel: AILevel;
    };
  } {
    const template = this.getTemplate(chainIdOrName);
    if (!template) {
      throw new Error(`Attack chain not found: ${chainIdOrName}`);
    }

    const availableModes = this.enhancedEngine.getAvailableModes();
    const availableLevels = this.enhancedEngine.getAvailableAILevels();

    // Make recommendations based on chain difficulty
    const recommendations = {
      beginnerMode: 'enhanced' as AttackChainMode,
      beginnerLevel: 'basic' as AILevel,
      expertMode: 'dynamic' as AttackChainMode,
      expertLevel: template.difficulty === 'advanced' ? 'advanced' as AILevel : 'high' as AILevel
    };

    return {
      template,
      availableModes,
      availableLevels,
      recommendations
    };
  }

  /**
   * Get execution history and statistics
   */
  getExecutionHistory(limit: number = 50): {
    executions: AIAttackExecution[];
    statistics: {
      totalExecutions: number;
      modeDistribution: Record<AttackChainMode, number>;
      levelDistribution: Record<AILevel, number>;
      averageLogsGenerated: number;
      averageDuration: number;
      mostUsedChains: { chainName: string; count: number }[];
    };
  } {
    const recentExecutions = this.executionHistory.slice(-limit);
    
    // Calculate statistics
    const modeDistribution: Record<AttackChainMode, number> = {
      static: 0,
      enhanced: 0,
      dynamic: 0
    };

    const levelDistribution: Record<AILevel, number> = {
      basic: 0,
      medium: 0,
      high: 0,
      advanced: 0
    };

    const chainCounts: Record<string, number> = {};
    let totalLogs = 0;
    let totalDuration = 0;

    recentExecutions.forEach(execution => {
      modeDistribution[execution.enhancementConfig.mode]++;
      levelDistribution[execution.enhancementConfig.aiLevel]++;
      
      const chainName = execution.originalChain.name;
      chainCounts[chainName] = (chainCounts[chainName] || 0) + 1;
      
      totalLogs += execution.stats.logsGenerated;
      totalDuration += execution.stats.averageStepDuration * execution.stats.stepsCompleted;
    });

    const mostUsedChains = Object.entries(chainCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([chainName, count]) => ({ chainName, count }));

    return {
      executions: recentExecutions,
      statistics: {
        totalExecutions: this.executionHistory.length,
        modeDistribution,
        levelDistribution,
        averageLogsGenerated: recentExecutions.length > 0 ? Math.round(totalLogs / recentExecutions.length) : 0,
        averageDuration: recentExecutions.length > 0 ? Math.round(totalDuration / recentExecutions.length) : 0,
        mostUsedChains
      }
    };
  }

  /**
   * Preview chain enhancement without execution
   */
  async previewEnhancement(
    chainIdOrName: string,
    mode: AttackChainMode,
    aiLevel: AILevel
  ): Promise<{
    originalChain: AttackChainTemplate;
    enhancedChain: EnhancedAttackChain;
    changes: string[];
    estimatedDuration: number;
    estimatedLogs: number;
  }> {
    const template = this.getTemplate(chainIdOrName);
    if (!template) {
      throw new Error(`Attack chain not found: ${chainIdOrName}`);
    }

    const config: AIEnhancementConfig = {
      mode,
      aiLevel,
      enabledFeatures: {
        timingRandomization: mode !== 'static',
        techniqueSubstitution: aiLevel !== 'basic' && mode !== 'static',
        evasionTactics: aiLevel === 'high' || aiLevel === 'advanced',
        adaptiveDelays: true,
        logVariation: mode !== 'static',
        scenarioGeneration: mode === 'dynamic'
      },
      localModels: { enabled: mode === 'dynamic' },
      variations: { count: 1, difficulty: 'random' }
    };

    try {
      const enhancedChain = await this.aiOrchestrator.enhanceAttackChain(template.chain, config);
      
      const changes: string[] = [];
      if (config.enabledFeatures.timingRandomization) {
        changes.push('Randomized step timing');
      }
      if (config.enabledFeatures.techniqueSubstitution) {
        changes.push('Alternative attack techniques');
      }
      if (config.enabledFeatures.evasionTactics) {
        changes.push('Evasion tactics added');
      }
      if (config.enabledFeatures.logVariation) {
        changes.push('Enhanced log patterns');
      }

      const estimatedDuration = enhancedChain.steps.reduce(
        (total, step) => total + step.timing.duration + step.timing.delayAfterPrevious,
        0
      );

      const estimatedLogs = enhancedChain.steps.reduce(
        (total, step) => total + (step.logGeneration?.frequency || 0) * (step.timing.duration / 60000),
        0
      );

      return {
        originalChain: template,
        enhancedChain,
        changes,
        estimatedDuration,
        estimatedLogs: Math.round(estimatedLogs)
      };

    } catch (error) {
      logger.error(`Failed to preview enhancement for: ${template.name}`, error);
      throw error;
    }
  }

  // Private helper methods

  private getTemplateInternal(chainIdOrName: string): AttackChainTemplate | undefined {
    return super.getTemplate(chainIdOrName) || this.getTemplateByName(chainIdOrName);
  }

  private setupEventHandlers(): void {
    this.enhancedEngine.on('ai.enhancement.started', (chainId, config) => {
      logger.debug(`AI enhancement started for chain: ${chainId}`, {
        mode: config.mode,
        aiLevel: config.aiLevel
      });
    });

    this.enhancedEngine.on('ai.enhancement.completed', (chainId, enhanced) => {
      logger.debug(`AI enhancement completed for chain: ${chainId}`, {
        enhancementLevel: enhanced.enhancementLevel,
        variations: enhanced.variations.length,
        confidenceScore: enhanced.metadata.confidenceScore
      });
    });

    this.enhancedEngine.on('ai.adaptation.triggered', (execution, trigger) => {
      logger.info(`AI adaptation triggered during execution`, {
        executionId: execution.executionId,
        trigger,
        chainName: execution.originalChain.name
      });
    });
  }
}


