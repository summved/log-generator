/**
 * Simple Enhanced Attack Chain Manager
 * Provides AI-enhanced attack chain capabilities with minimal complexity
 */

import { AttackChainManager } from './AttackChainManager';
import { LocalAIOrchestrator } from '../ai/LocalAIOrchestrator';
import { logger } from '../utils/logger';
import { AttackChain, AttackChainExecution } from '../types/attackChain';
import { 
  AIEnhancementConfig,
  AIAttackExecution,
  AttackChainMode,
  AILevel
} from '../types/aiAttackChain';

export class EnhancedAttackChainManager extends AttackChainManager {
  private aiOrchestrator: LocalAIOrchestrator;
  private executionHistory: AIAttackExecution[] = [];

  constructor(templatesDirectory?: string) {
    super(templatesDirectory);
    this.aiOrchestrator = new LocalAIOrchestrator();
    logger.info('Enhanced Attack Chain Manager initialized with AI capabilities');
  }

  /**
   * Execute attack chain with AI enhancements
   */
  async executeEnhancedChain(
    name: string,
    options: EnhancedExecutionOptions = {}
  ): Promise<AIEnhancedExecution> {
    logger.info(`Starting AI-enhanced execution of: ${name}`, { options });

    // Get the base template
    const template = this.getTemplateByName(name);
    if (!template) {
      throw new Error(`Attack chain template not found: ${name}`);
    }

    // Convert template to AttackChain
    const baseChain: AttackChain = {
      id: template.id,
      name: template.name,
      description: template.description,
      steps: template.steps,
      metadata: template.metadata
    };

    // Enhance the chain with AI
    const enhancedChain = await this.aiOrchestrator.enhanceAttackChain(baseChain, options);

    // Execute the enhanced chain
    const execution = await this.aiOrchestrator.executeEnhanced(enhancedChain, options);

    // Store in history
    this.executionHistory.push(execution);

    logger.info(`AI-enhanced execution completed: ${name}`, {
      duration: execution.metrics.totalExecutionTime,
      enhancements: execution.metrics.enhancementsApplied
    });

    return execution;
  }

  /**
   * Execute training session with multiple variations
   */
  async executeTrainingSession(
    name: string,
    options: any = {}
  ): Promise<AIEnhancedExecution[]> {
    const sessionOptions = {
      mode: options.mode || 'enhanced',
      aiLevel: options.aiLevel || 'medium',
      variations: {
        count: options.variations || 3,
        difficulty: 'progressive'
      }
    };

    logger.info(`Starting AI training session for: ${name}`, sessionOptions);

    const executions: AIEnhancedExecution[] = [];

    // Execute multiple variations
    for (let i = 0; i < sessionOptions.variations.count; i++) {
      const variationOptions = {
        ...sessionOptions,
        variationIndex: i,
        mode: this.getVariationMode(sessionOptions.mode, i),
        aiLevel: this.getVariationAILevel(sessionOptions.aiLevel, i)
      };

      try {
        const execution = await this.executeEnhancedChain(name, variationOptions);
        executions.push(execution);

        // Delay between variations
        if (i < sessionOptions.variations.count - 1) {
          await this.sleep(options.delayBetweenVariations || 2000);
        }
      } catch (error) {
        logger.error(`Training variation ${i + 1} failed:`, error);
      }
    }

    logger.info(`Training session completed: ${executions.length}/${sessionOptions.variations.count} successful`);
    return executions;
  }

  /**
   * Preview enhancement without execution
   */
  async previewEnhancement(
    name: string,
    mode: string,
    aiLevel: string
  ): Promise<any> {
    const template = this.getTemplateByName(name);
    if (!template) {
      throw new Error(`Attack chain template not found: ${name}`);
    }

    const baseChain: AttackChain = {
      id: template.id,
      name: template.name,
      description: template.description,
      steps: template.steps,
      metadata: template.metadata
    };

    const enhancedChain = await this.aiOrchestrator.enhanceAttackChain(baseChain, {
      mode: mode as AttackChainMode,
      aiLevel: aiLevel as AILevel
    });

    return {
      originalChain: baseChain,
      enhancedChain,
      enhancements: {
        stepsModified: enhancedChain.steps.length,
        variationsGenerated: enhancedChain.variations?.length || 0,
        aiFeatures: enhancedChain.metadata?.aiFeatures || []
      }
    };
  }

  /**
   * Get enhancement options
   */
  getEnhancementOptions(name?: string): any {
    const baseOptions = this.aiOrchestrator.getEnhancementOptions();
    
    if (name) {
      const template = this.getTemplateByName(name);
      if (template) {
        return {
          ...baseOptions,
          template: {
            id: template.id,
            name: template.name,
            category: template.category,
            difficulty: template.difficulty,
            description: template.description
          }
        };
      }
    }
    
    return baseOptions;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 10): any {
    const recent = this.executionHistory.slice(-limit);
    
    return {
      statistics: {
        total: this.executionHistory.length,
        successful: this.executionHistory.filter(e => e.status === 'completed').length,
        failed: this.executionHistory.filter(e => e.status === 'failed').length
      },
      executions: recent
    };
  }

  private getVariationMode(baseMode: string, index: number): AttackChainMode {
    const modes: AttackChainMode[] = ['static', 'enhanced', 'dynamic'];
    return modes[index % modes.length];
  }

  private getVariationAILevel(baseLevel: string, index: number): AILevel {
    const levels: AILevel[] = ['basic', 'medium', 'high', 'advanced'];
    const baseIndex = levels.indexOf(baseLevel as AILevel);
    return levels[Math.min(levels.length - 1, baseIndex + index)];
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
