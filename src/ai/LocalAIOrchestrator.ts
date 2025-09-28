/**
 * Local AI Orchestrator - Lightweight Implementation
 * Provides AI-enhanced attack chain capabilities without heavy dependencies
 */

import { logger } from '../utils/logger';
import { AttackChain, AttackChainStep } from '../types/attackChain';
import { 
  AIEnhancementConfig, 
  EnhancedAttackChain, 
  AttackChainMode, 
  AILevel,
  EnhancedExecutionOptions,
  AIEnhancedExecution
} from '../types/aiAttackChain';

export class LocalAIOrchestrator {
  private config: AIEnhancementConfig;

  constructor(config?: Partial<AIEnhancementConfig>) {
    this.config = {
      mode: 'enhanced',
      aiLevel: 'medium',
      enabledFeatures: {
        timingRandomization: true,
        techniqueSubstitution: true,
        evasionTactics: true,
        adaptiveDelays: true,
        logVariation: true,
        scenarioGeneration: true,
        ...config?.enabledFeatures
      },
      localModels: {
        enabled: false, // Disabled for now - no heavy AI models
        ...config?.localModels
      },
      variations: {
        count: 3,
        difficulty: 'progressive',
        ...config?.variations
      },
      ...config
    };

    logger.info('LocalAIOrchestrator initialized', { 
      mode: this.config.mode,
      aiLevel: this.config.aiLevel,
      features: Object.keys(this.config.enabledFeatures).filter(
        k => this.config.enabledFeatures[k as keyof typeof this.config.enabledFeatures]
      )
    });
  }

  /**
   * Enhance an attack chain with AI capabilities
   */
  async enhanceAttackChain(
    baseChain: AttackChain,
    options: Partial<EnhancedExecutionOptions> = {}
  ): Promise<EnhancedAttackChain> {
    logger.info(`Enhancing attack chain: ${baseChain.name}`);

    const enhancedSteps = await this.enhanceSteps(baseChain.steps, options);
    
    const enhancedChain: EnhancedAttackChain = {
      ...baseChain,
      enhanced: true,
      aiLevel: options.aiLevel || this.config.aiLevel,
      enhancementMode: options.mode || this.config.mode,
      steps: enhancedSteps,
      variations: this.generateVariations(baseChain, options),
      metadata: {
        ...baseChain.metadata,
        enhanced: true,
        enhancementTimestamp: new Date().toISOString(),
        aiFeatures: Object.keys(this.config.enabledFeatures).filter(
          k => this.config.enabledFeatures[k as keyof typeof this.config.enabledFeatures]
        )
      }
    };

    return enhancedChain;
  }

  /**
   * Execute an enhanced attack chain
   */
  async executeEnhanced(
    chain: EnhancedAttackChain,
    options: EnhancedExecutionOptions = {}
  ): Promise<AIEnhancedExecution> {
    const startTime = Date.now();
    
    logger.info(`Starting AI-enhanced execution of ${chain.name}`, {
      mode: options.mode || chain.enhancementMode,
      aiLevel: options.aiLevel || chain.aiLevel
    });

    const execution: AIEnhancedExecution = {
      id: `ai-exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      chainId: chain.id,
      chainName: chain.name,
      mode: options.mode || chain.enhancementMode || 'enhanced',
      aiLevel: options.aiLevel || chain.aiLevel || 'medium',
      startTime: new Date(),
      status: 'running',
      steps: [],
      aiEnhancements: {
        timingAdjustments: [],
        techniqueSubstitutions: [],
        evasionTactics: [],
        logVariations: []
      },
      metrics: {
        totalSteps: chain.steps.length,
        completedSteps: 0,
        enhancementsApplied: 0,
        averageStepTime: 0,
        detectionEvasion: 0
      }
    };

    try {
      // Execute enhanced steps
      for (let i = 0; i < chain.steps.length; i++) {
        const step = chain.steps[i];
        const stepStart = Date.now();

        // Apply AI enhancements
        const enhancedStep = await this.executeEnhancedStep(step, execution, options);
        
        execution.steps.push(enhancedStep);
        execution.metrics.completedSteps++;

        const stepTime = Date.now() - stepStart;
        execution.metrics.averageStepTime = 
          (execution.metrics.averageStepTime * i + stepTime) / (i + 1);

        // Apply adaptive delays
        if (this.config.enabledFeatures.adaptiveDelays) {
          const delay = this.calculateAdaptiveDelay(step, execution);
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            execution.aiEnhancements.timingAdjustments.push({
              stepId: step.id,
              originalDelay: step.delay || 0,
              adjustedDelay: delay,
              reason: 'evasion_timing'
            });
            execution.metrics.enhancementsApplied++;
          }
        }

        logger.info(`Enhanced step completed: ${step.technique}`, {
          stepNumber: i + 1,
          totalSteps: chain.steps.length,
          enhancements: execution.metrics.enhancementsApplied
        });
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.metrics.totalExecutionTime = Date.now() - startTime;
      execution.metrics.detectionEvasion = this.calculateEvasionScore(execution);

      logger.info(`AI-enhanced execution completed: ${chain.name}`, {
        duration: execution.metrics.totalExecutionTime,
        enhancements: execution.metrics.enhancementsApplied,
        evasionScore: execution.metrics.detectionEvasion
      });

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`AI-enhanced execution failed: ${chain.name}`, error);
    }

    return execution;
  }

  /**
   * Get AI enhancement options
   */
  getEnhancementOptions(): any {
    return {
      modes: ['static', 'enhanced', 'dynamic'],
      aiLevels: ['basic', 'medium', 'high', 'advanced'],
      features: Object.keys(this.config.enabledFeatures),
      currentConfig: this.config
    };
  }

  /**
   * Get execution history (stub for now)
   */
  getExecutionHistory(): AIEnhancedExecution[] {
    // In a real implementation, this would fetch from storage
    return [];
  }

  private async enhanceSteps(
    steps: AttackChainStep[],
    options: Partial<EnhancedExecutionOptions>
  ): Promise<AttackChainStep[]> {
    return steps.map(step => ({
      ...step,
      // Add AI enhancements to each step
      enhanced: true,
      aiEnhancements: {
        timingRandomization: this.config.enabledFeatures.timingRandomization,
        techniqueSubstitution: this.config.enabledFeatures.techniqueSubstitution,
        evasionTactics: this.config.enabledFeatures.evasionTactics
      }
    }));
  }

  private generateVariations(
    baseChain: AttackChain,
    options: Partial<EnhancedExecutionOptions>
  ): EnhancedAttackChain[] {
    const variations: EnhancedAttackChain[] = [];
    const count = options.variations?.count || this.config.variations.count;

    for (let i = 0; i < count; i++) {
      variations.push({
        ...baseChain,
        id: `${baseChain.id}-var-${i + 1}`,
        name: `${baseChain.name} (Variation ${i + 1})`,
        enhanced: true,
        aiLevel: this.config.aiLevel,
        enhancementMode: this.config.mode,
        steps: this.randomizeSteps(baseChain.steps, i),
        variations: [], // Prevent infinite recursion
        metadata: {
          ...baseChain.metadata,
          isVariation: true,
          variationIndex: i,
          baseChainId: baseChain.id
        }
      });
    }

    return variations;
  }

  private randomizeSteps(steps: AttackChainStep[], variationIndex: number): AttackChainStep[] {
    return steps.map((step, index) => ({
      ...step,
      // Add some randomization based on variation index
      delay: (step.delay || 1000) + (variationIndex * 500) + (Math.random() * 1000),
      // Vary the commands slightly
      command: this.varyCommand(step.command, variationIndex)
    }));
  }

  private varyCommand(command: string, variationIndex: number): string {
    // Simple command variation - in a real AI system this would be more sophisticated
    const variations = [
      command,
      command.replace(/\s+/g, '  '), // Double spaces
      command.toLowerCase(),
      command.toUpperCase()
    ];
    
    return variations[variationIndex % variations.length] || command;
  }

  private async executeEnhancedStep(
    step: AttackChainStep,
    execution: AIEnhancedExecution,
    options: EnhancedExecutionOptions
  ): Promise<any> {
    // Apply technique substitution if enabled
    if (this.config.enabledFeatures.techniqueSubstitution) {
      const substitution = this.findTechniqueSubstitution(step);
      if (substitution) {
        execution.aiEnhancements.techniqueSubstitutions.push({
          originalTechnique: step.technique,
          substituteTechnique: substitution,
          reason: 'detection_avoidance'
        });
        execution.metrics.enhancementsApplied++;
      }
    }

    // Apply log variation if enabled
    if (this.config.enabledFeatures.logVariation) {
      const variation = this.generateLogVariation(step);
      if (variation) {
        execution.aiEnhancements.logVariations.push({
          stepId: step.id,
          originalPattern: step.expectedLogs?.[0] || 'default',
          variationPattern: variation,
          reason: 'signature_evasion'
        });
        execution.metrics.enhancementsApplied++;
      }
    }

    return {
      stepId: step.id,
      technique: step.technique,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      aiEnhanced: true
    };
  }

  private calculateAdaptiveDelay(step: AttackChainStep, execution: AIEnhancedExecution): number {
    const baseDelay = step.delay || 1000;
    const randomFactor = Math.random() * 0.5 + 0.75; // 0.75-1.25x multiplier
    const evasionFactor = execution.metrics.detectionEvasion > 0.5 ? 1.5 : 1.0;
    
    return Math.floor(baseDelay * randomFactor * evasionFactor);
  }

  private findTechniqueSubstitution(step: AttackChainStep): string | null {
    // Simple technique substitution mapping
    const substitutions: Record<string, string> = {
      'T1078': 'T1078.001', // Valid Accounts -> Local Accounts
      'T1083': 'T1082',     // File Discovery -> System Information Discovery
      'T1033': 'T1087',     // System Owner Discovery -> Account Discovery
    };

    return substitutions[step.technique] || null;
  }

  private generateLogVariation(step: AttackChainStep): string | null {
    if (!step.expectedLogs || step.expectedLogs.length === 0) {
      return null;
    }

    const original = step.expectedLogs[0];
    // Simple log variation - add random characters or change case
    const variations = [
      original.replace(/\s/g, '_'),
      original.toLowerCase(),
      original.replace(/(\w+)/g, '$1_variant')
    ];

    return variations[Math.floor(Math.random() * variations.length)];
  }

  private calculateEvasionScore(execution: AIEnhancedExecution): number {
    const enhancementRatio = execution.metrics.enhancementsApplied / execution.metrics.totalSteps;
    const baseScore = 0.5 + (enhancementRatio * 0.4); // 0.5-0.9 range
    
    return Math.min(0.95, baseScore + (Math.random() * 0.1)); // Add some randomness, cap at 95%
  }
}
