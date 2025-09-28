/**
 * Stub implementations for disabled features
 * These provide informative error messages instead of compilation failures
 */

// Import the working AI Enhanced Attack Chain Manager - AI features are now enabled!
export { EnhancedAttackChainManager } from './WorkingAIFeatures';

// Import the real PatternLearningEngine - ML features are now enabled!
export { PatternLearningEngine } from '../ml/PatternLearningEngine';

// Type stubs
export type MLLogGenerationConfig = {
    [key: string]: any;
};

export type AttackChainMode = 'static' | 'enhanced' | 'dynamic';

export type AILevel = 'basic' | 'medium' | 'high' | 'advanced';

export type EnhancedExecutionOptions = {
    mode?: AttackChainMode;
    aiLevel?: AILevel;
    variations?: number;
    enableEvasion?: boolean;
    adaptiveDelays?: boolean;
    logGeneratorConfig?: string;
    [key: string]: any;
};
