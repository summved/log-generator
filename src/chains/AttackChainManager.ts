/**
 * Attack Chain Manager
 * Manages loading, validation, and execution of attack chain templates
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { logger } from '../utils/logger';
import { AttackChain, AttackChainTemplate, AttackChainExecution, AttackChainExecutionConfig } from '../types/attackChain';
import { AttackChainEngine } from './AttackChainEngine';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages attack chain templates and execution
 */
export class AttackChainManager {
  private templates: Map<string, AttackChainTemplate> = new Map();
  private engine: AttackChainEngine;
  private templatesDirectory: string;

  constructor(templatesDirectory?: string) {
    this.templatesDirectory = templatesDirectory || path.join(__dirname, 'templates');
    this.engine = new AttackChainEngine();
    this.loadTemplates();
  }

  /**
   * Load all attack chain templates from the templates directory
   */
  private loadTemplates(): void {
    if (!existsSync(this.templatesDirectory)) {
      logger.warn(`Attack chain templates directory not found: ${this.templatesDirectory}`);
      return;
    }

    const templateFiles = readdirSync(this.templatesDirectory)
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

    logger.info(`Loading ${templateFiles.length} attack chain templates from ${this.templatesDirectory}`);

    for (const file of templateFiles) {
      try {
        const filePath = path.join(this.templatesDirectory, file);
        const templateData = readFileSync(filePath, 'utf8');
        const template = yaml.load(templateData) as AttackChainTemplate;
        
        // Validate template structure
        this.validateTemplate(template, file);
        
        // Generate unique ID for the chain
        const chainId = this.generateChainId(template.name);
        const chain: AttackChain = {
          ...template.chain,
          id: chainId
        };
        
        const fullTemplate: AttackChainTemplate = {
          ...template,
          chain
        };
        
        this.templates.set(chainId, fullTemplate);
        
        logger.info(`Loaded attack chain template: ${template.name} (${chainId})`, {
          category: template.category,
          difficulty: template.difficulty,
          steps: template.chain.steps.length,
          estimatedDuration: template.chain.metadata.estimated_duration
        });
        
      } catch (error) {
        logger.error(`Failed to load attack chain template: ${file}`, { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    logger.info(`Successfully loaded ${this.templates.size} attack chain templates`);
  }

  /**
   * Validate attack chain template structure
   */
  private validateTemplate(template: AttackChainTemplate, filename: string): void {
    if (!template.name) {
      throw new Error(`Template missing 'name' field in ${filename}`);
    }
    
    if (!template.chain) {
      throw new Error(`Template missing 'chain' field in ${filename}`);
    }
    
    if (!template.chain.steps || template.chain.steps.length === 0) {
      throw new Error(`Template missing 'steps' in chain for ${filename}`);
    }
    
    if (!template.chain.metadata) {
      throw new Error(`Template missing 'metadata' in chain for ${filename}`);
    }
    
    // Validate each step
    for (const [index, step] of template.chain.steps.entries()) {
      if (!step.id) {
        throw new Error(`Step ${index} missing 'id' field in ${filename}`);
      }
      
      if (!step.mitre || !step.mitre.technique || !step.mitre.tactic) {
        throw new Error(`Step ${step.id} missing MITRE mapping in ${filename}`);
      }
      
      if (!step.logGeneration) {
        throw new Error(`Step ${step.id} missing logGeneration configuration in ${filename}`);
      }
      
      if (!step.timing) {
        throw new Error(`Step ${step.id} missing timing configuration in ${filename}`);
      }
    }
    
    // Validate step dependencies
    const stepIds = new Set(template.chain.steps.map(s => s.id));
    for (const step of template.chain.steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            throw new Error(`Step ${step.id} has invalid dependency: ${depId} in ${filename}`);
          }
        }
      }
    }
  }

  /**
   * Generate unique chain ID from name
   */
  private generateChainId(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Get all available attack chain templates
   */
  public getTemplates(): AttackChainTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: string): AttackChainTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }

  /**
   * Get templates by difficulty
   */
  public getTemplatesByDifficulty(difficulty: string): AttackChainTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.difficulty === difficulty);
  }

  /**
   * Get template by ID
   */
  public getTemplate(id: string): AttackChainTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get template by name (case-insensitive)
   */
  public getTemplateByName(name: string): AttackChainTemplate | undefined {
    const normalizedName = name.toLowerCase();
    return Array.from(this.templates.values())
      .find(template => template.name.toLowerCase() === normalizedName);
  }

  /**
   * Execute an attack chain by ID
   */
  public async executeChain(
    chainId: string, 
    config?: Partial<AttackChainExecutionConfig>,
    logGeneratorConfig?: string
  ): Promise<AttackChainExecution> {
    const template = this.templates.get(chainId);
    if (!template) {
      throw new Error(`Attack chain template not found: ${chainId}`);
    }

    logger.info(`Starting execution of attack chain: ${template.name}`, {
      chainId,
      category: template.category,
      difficulty: template.difficulty,
      steps: template.chain.steps.length
    });

    // Configure the engine with provided config
    if (config) {
      this.engine = new AttackChainEngine(config);
    }

    return await this.engine.executeChain(template.chain, logGeneratorConfig);
  }

  /**
   * Execute an attack chain by name
   */
  public async executeChainByName(
    name: string, 
    config?: Partial<AttackChainExecutionConfig>,
    logGeneratorConfig?: string
  ): Promise<AttackChainExecution> {
    const template = this.getTemplateByName(name);
    if (!template) {
      throw new Error(`Attack chain template not found: ${name}`);
    }

    return await this.executeChain(template.chain.id, config, logGeneratorConfig);
  }

  /**
   * Get execution status
   */
  public getExecutionStatus(executionId: string): AttackChainExecution | undefined {
    return this.engine.getExecutionStatus(executionId);
  }

  /**
   * Get all active executions
   */
  public getActiveExecutions(): AttackChainExecution[] {
    return this.engine.getActiveExecutions();
  }

  /**
   * Abort a running attack chain
   */
  public async abortExecution(executionId: string): Promise<void> {
    return await this.engine.abortChain(executionId);
  }

  /**
   * Get attack chain statistics
   */
  public getStatistics(): {
    totalTemplates: number;
    categoryCounts: Record<string, number>;
    difficultyCounts: Record<string, number>;
    averageSteps: number;
    averageDuration: number;
  } {
    const templates = Array.from(this.templates.values());
    
    const categoryCounts: Record<string, number> = {};
    const difficultyCounts: Record<string, number> = {};
    let totalSteps = 0;
    let totalDuration = 0;

    for (const template of templates) {
      // Count categories
      categoryCounts[template.category] = (categoryCounts[template.category] || 0) + 1;
      
      // Count difficulties
      difficultyCounts[template.difficulty] = (difficultyCounts[template.difficulty] || 0) + 1;
      
      // Sum steps and duration
      totalSteps += template.chain.steps.length;
      totalDuration += template.chain.metadata.estimated_duration;
    }

    return {
      totalTemplates: templates.length,
      categoryCounts,
      difficultyCounts,
      averageSteps: templates.length > 0 ? Math.round(totalSteps / templates.length) : 0,
      averageDuration: templates.length > 0 ? Math.round(totalDuration / templates.length) : 0
    };
  }

  /**
   * Search templates by tags
   */
  public searchTemplatesByTags(tags: string[]): AttackChainTemplate[] {
    const lowerTags = tags.map(tag => tag.toLowerCase());
    
    return Array.from(this.templates.values())
      .filter(template => {
        const templateTags = template.chain.metadata.tags.map(tag => tag.toLowerCase());
        return lowerTags.some(tag => templateTags.includes(tag));
      });
  }

  /**
   * Get MITRE technique coverage
   */
  public getMitreCoverage(): {
    techniques: string[];
    tactics: string[];
    techniqueCount: number;
    tacticCount: number;
  } {
    const techniques = new Set<string>();
    const tactics = new Set<string>();

    for (const template of this.templates.values()) {
      for (const technique of template.chain.mitre_mapping.techniques) {
        techniques.add(technique);
      }
      for (const tactic of template.chain.mitre_mapping.tactics) {
        tactics.add(tactic);
      }
    }

    return {
      techniques: Array.from(techniques).sort(),
      tactics: Array.from(tactics).sort(),
      techniqueCount: techniques.size,
      tacticCount: tactics.size
    };
  }

  /**
   * Validate attack chain execution prerequisites
   */
  public validateExecutionPrerequisites(chainId: string): {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const template = this.templates.get(chainId);
    if (!template) {
      return {
        valid: false,
        issues: [`Attack chain template not found: ${chainId}`],
        warnings: []
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for dependency cycles
    const dependencyGraph = new Map<string, string[]>();
    for (const step of template.chain.steps) {
      dependencyGraph.set(step.id, step.dependencies || []);
    }

    // Simple cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) {
        return true;
      }
      if (visited.has(stepId)) {
        return false;
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const dependencies = dependencyGraph.get(stepId) || [];
      for (const dep of dependencies) {
        if (hasCycle(dep)) {
          return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const stepId of dependencyGraph.keys()) {
      if (hasCycle(stepId)) {
        issues.push(`Dependency cycle detected involving step: ${stepId}`);
        break;
      }
    }

    // Check for unrealistic timing
    const totalDuration = template.chain.steps.reduce((sum, step) => sum + step.timing.duration, 0);
    if (totalDuration > template.chain.config.max_duration) {
      warnings.push(`Total step duration (${totalDuration}ms) exceeds max duration (${template.chain.config.max_duration}ms)`);
    }

    // Check for missing log sources
    const requiredSources = new Set<string>();
    for (const step of template.chain.steps) {
      for (const source of step.logGeneration.sources) {
        requiredSources.add(source);
      }
    }

    // TODO: Check if required log sources are available in configuration

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }
}
