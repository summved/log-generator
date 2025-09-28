/**
 * Enhanced Attack Chain Engine
 * Extends the original AttackChainEngine with AI-driven enhancements
 * Maintains backward compatibility while adding flexible AI capabilities
 */

import { AttackChainEngine, AttackChainEngineEvents } from './AttackChainEngine';
import { LocalAIOrchestrator } from '../ai/LocalAIOrchestrator';
import { 
  AttackChain, 
  AttackChainExecution, 
  AttackChainExecutionConfig 
} from '../types/attackChain';
import {
  AIEnhancementConfig,
  EnhancedAttackChain,
  AIAttackExecution,
  AttackChainMode,
  AILevel
} from '../types/aiAttackChain';
import { logger } from '../utils/logger';

export interface EnhancedAttackChainEngineEvents extends AttackChainEngineEvents {
  'ai.enhancement.started': (chainId: string, config: AIEnhancementConfig) => void;
  'ai.enhancement.completed': (chainId: string, enhanced: EnhancedAttackChain) => void;
  'ai.adaptation.triggered': (execution: AIAttackExecution, trigger: string) => void;
}

export declare interface EnhancedAttackChainEngine {
  on<U extends keyof EnhancedAttackChainEngineEvents>(event: U, listener: EnhancedAttackChainEngineEvents[U]): this;
  emit<U extends keyof EnhancedAttackChainEngineEvents>(event: U, ...args: Parameters<EnhancedAttackChainEngineEvents[U]>): boolean;
}

export class EnhancedAttackChainEngine extends AttackChainEngine {
  private aiOrchestrator: LocalAIOrchestrator;
  private enhancementCache: Map<string, EnhancedAttackChain> = new Map();

  constructor(
    config?: Partial<AttackChainExecutionConfig>,
    aiOrchestrator?: LocalAIOrchestrator
  ) {
    super(config);
    
    this.aiOrchestrator = aiOrchestrator || new LocalAIOrchestrator();
    
    // Forward AI events
    this.aiOrchestrator.on('enhancement.started', (chainId, config) => {
      this.emit('ai.enhancement.started', chainId, config);
    });
    
    this.aiOrchestrator.on('enhancement.completed', (chainId, enhanced) => {
      this.emit('ai.enhancement.completed', chainId, enhanced);
    });

    logger.info('Enhanced Attack Chain Engine initialized with AI capabilities');
  }

  /**
   * Execute attack chain with optional AI enhancement
   */
  async executeChainWithAI(
    chain: AttackChain,
    mode: AttackChainMode = 'static',
    aiLevel: AILevel = 'basic',
    options?: {
      variations?: number;
      enableEvasion?: boolean;
      adaptiveDelays?: boolean;
      logGeneratorConfig?: string;
    }
  ): Promise<AIAttackExecution> {
    const startTime = Date.now();

    try {
      // Create AI enhancement configuration
      const enhancementConfig: AIEnhancementConfig = {
        mode,
        aiLevel,
        enabledFeatures: {
          timingRandomization: mode !== 'static',
          techniqueSubstitution: aiLevel !== 'basic' && mode !== 'static',
          evasionTactics: options?.enableEvasion ?? (aiLevel === 'high' || aiLevel === 'advanced'),
          adaptiveDelays: options?.adaptiveDelays ?? true,
          logVariation: mode !== 'static',
          scenarioGeneration: mode === 'dynamic'
        },
        localModels: {
          enabled: mode === 'dynamic'
        },
        variations: {
          count: options?.variations ?? 1,
          difficulty: 'progressive'
        }
      };

      // Get enhanced chain (or use original for static mode)
      let enhancedChain: EnhancedAttackChain;
      
      if (mode === 'static') {
        // Static mode: use original chain without AI enhancement
        enhancedChain = this.createStaticWrapper(chain);
      } else {
        // Enhanced/Dynamic mode: apply AI enhancements
        enhancedChain = await this.aiOrchestrator.enhanceAttackChain(chain, enhancementConfig);
      }

      // Execute the chain using the parent engine
      const baseExecution = await super.executeChain(enhancedChain, options?.logGeneratorConfig);

      // Create enhanced execution result
      const aiExecution: AIAttackExecution = {
        ...baseExecution,
        enhancementConfig,
        originalChain: chain,
        enhancedChain,
        adaptations: [],
        aiMetrics: {
          enhancementTime: Date.now() - startTime,
          confidenceScore: enhancedChain.metadata.confidenceScore,
          realismScore: enhancedChain.metadata.realismScore,
          variationCount: enhancedChain.variations.length
        }
      };

      logger.info('AI-enhanced attack chain execution completed', {
        chainName: chain.name,
        mode,
        aiLevel,
        enhancementTime: aiExecution.aiMetrics.enhancementTime,
        variations: enhancedChain.variations.length,
        logsGenerated: baseExecution.stats.logsGenerated
      });

      return aiExecution;

    } catch (error) {
      logger.error('Failed to execute AI-enhanced attack chain', {
        chainName: chain.name,
        mode,
        aiLevel,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute multiple chain variations for training purposes
   */
  async executeChainVariations(
    chain: AttackChain,
    variationCount: number = 3,
    progressiveMode: boolean = true,
    options?: {
      logGeneratorConfig?: string;
      delayBetweenVariations?: number;
    }
  ): Promise<AIAttackExecution[]> {
    const executions: AIAttackExecution[] = [];
    
    logger.info(`Executing ${variationCount} variations of ${chain.name}`, {
      progressive: progressiveMode
    });

    for (let i = 0; i < variationCount; i++) {
      // Progressive difficulty: start basic, increase complexity
      const aiLevel: AILevel = progressiveMode ? 
        this.getProgressiveAILevel(i, variationCount) : 
        this.getRandomAILevel();

      const mode: AttackChainMode = i === 0 ? 'static' : 
        i < variationCount / 2 ? 'enhanced' : 'dynamic';

      try {
        const execution = await this.executeChainWithAI(
          chain,
          mode,
          aiLevel,
          {
            variations: 1,
            enableEvasion: aiLevel === 'high' || aiLevel === 'advanced',
            adaptiveDelays: true,
            logGeneratorConfig: options?.logGeneratorConfig
          }
        );

        executions.push(execution);

        logger.info(`Completed variation ${i + 1}/${variationCount}`, {
          mode,
          aiLevel,
          logsGenerated: execution.stats.logsGenerated,
          duration: execution.stats.actualDuration
        });

        // Optional delay between variations
        if (options?.delayBetweenVariations && i < variationCount - 1) {
          await this.sleep(options.delayBetweenVariations);
        }

      } catch (error) {
        logger.warn(`Failed to execute variation ${i + 1}, continuing with next`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logger.info(`Completed ${executions.length}/${variationCount} chain variations`, {
      chainName: chain.name,
      totalLogs: executions.reduce((sum, exec) => sum + exec.stats.logsGenerated, 0)
    });

    return executions;
  }

  /**
   * Get available enhancement modes
   */
  getAvailableModes(): { mode: AttackChainMode; description: string; requirements: string[] }[] {
    return [
      {
        mode: 'static',
        description: 'Original attack chain without modifications',
        requirements: ['None - uses existing templates']
      },
      {
        mode: 'enhanced',
        description: 'Rule-based enhancements with technique substitution and timing variation',
        requirements: ['Local MITRE knowledge base']
      },
      {
        mode: 'dynamic',
        description: 'AI-generated scenarios with adaptive behavior',
        requirements: ['Local AI models (optional)', 'Enhanced knowledge base']
      }
    ];
  }

  /**
   * Get available AI levels
   */
  getAvailableAILevels(): { level: AILevel; description: string; features: string[] }[] {
    return [
      {
        level: 'basic',
        description: 'Minimal enhancements with timing randomization',
        features: ['Timing variation', 'Basic log noise']
      },
      {
        level: 'medium',
        description: 'Moderate enhancements with technique substitution',
        features: ['Technique alternatives', 'Enhanced timing', 'Log variation']
      },
      {
        level: 'high',
        description: 'Advanced enhancements with evasion tactics',
        features: ['Evasion techniques', 'Living off the land', 'Anti-forensics']
      },
      {
        level: 'advanced',
        description: 'Maximum enhancements with adaptive behavior',
        features: ['All features', 'Adaptive responses', 'Novel scenarios']
      }
    ];
  }

  /**
   * Validate enhancement configuration
   */
  validateEnhancementConfig(config: AIEnhancementConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate mode
    if (!['static', 'enhanced', 'dynamic'].includes(config.mode)) {
      errors.push(`Invalid mode: ${config.mode}`);
    }

    // Validate AI level
    if (!['basic', 'medium', 'high', 'advanced'].includes(config.aiLevel)) {
      errors.push(`Invalid AI level: ${config.aiLevel}`);
    }

    // Validate variation count
    if (config.variations.count < 1 || config.variations.count > 20) {
      errors.push('Variation count must be between 1 and 20');
    }

    // Check feature consistency
    if (config.mode === 'static' && Object.values(config.enabledFeatures).some(f => f)) {
      errors.push('Static mode cannot have enabled features');
    }

    if (config.enabledFeatures.scenarioGeneration && config.mode !== 'dynamic') {
      errors.push('Scenario generation requires dynamic mode');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get enhancement statistics
   */
  getEnhancementStatistics(): {
    cachedChains: number;
    totalEnhancements: number;
    averageEnhancementTime: number;
    modeDistribution: Record<AttackChainMode, number>;
    levelDistribution: Record<AILevel, number>;
  } {
    // This would track actual usage statistics
    return {
      cachedChains: this.enhancementCache.size,
      totalEnhancements: 0, // Would be tracked
      averageEnhancementTime: 0, // Would be calculated
      modeDistribution: {
        static: 0,
        enhanced: 0,
        dynamic: 0
      },
      levelDistribution: {
        basic: 0,
        medium: 0,
        high: 0,
        advanced: 0
      }
    };
  }

  // Private helper methods

  private createStaticWrapper(chain: AttackChain): EnhancedAttackChain {
    return {
      ...chain,
      originalChain: chain,
      enhancementLevel: 'basic',
      enhancementType: 'timing',
      aiGenerated: false,
      variations: [],
      metadata: {
        baseTemplate: chain.name,
        enhancementDate: new Date(),
        confidenceScore: 1.0,
        realismScore: 0.8
      }
    };
  }

  private getProgressiveAILevel(index: number, total: number): AILevel {
    const progress = index / (total - 1);
    
    if (progress <= 0.33) return 'basic';
    if (progress <= 0.66) return 'medium';
    if (progress <= 0.85) return 'high';
    return 'advanced';
  }

  private getRandomAILevel(): AILevel {
    const levels: AILevel[] = ['basic', 'medium', 'high', 'advanced'];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


