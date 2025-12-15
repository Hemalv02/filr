/**
 * Strategy Pattern Export
 * Centralized export for all extraction strategies
 */

export type { IExtractionStrategy } from './ExtractionStrategy';
export { ExtractionContext, selectStrategy } from './ExtractionStrategy';
export { StaticExtractionStrategy } from './StaticExtractionStrategy';
export { DynamicExtractionStrategy } from './DynamicExtractionStrategy';
export { HybridExtractionStrategy } from './HybridExtractionStrategy';

/**
 * Strategy Registry
 * Available extraction strategies
 */
export const EXTRACTION_STRATEGIES = {
  STATIC: 'static',
  DYNAMIC: 'dynamic',
  HYBRID: 'hybrid',
} as const;

export type ExtractionStrategyType = typeof EXTRACTION_STRATEGIES[keyof typeof EXTRACTION_STRATEGIES];
