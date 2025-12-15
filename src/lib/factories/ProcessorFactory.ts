/**
 * Factory Pattern Implementation
 *
 * Problem: Creating document processors requires:
 * - Knowledge of all processor types
 * - Proper initialization and configuration
 * - Dependency injection
 * - Complex instantiation logic
 *
 * Solution: Factory pattern centralizes object creation,
 * making the system more maintainable and testable
 */

import { DocumentProcessor } from "../processors/DocumentProcessor";
import { BirthCertificateProcessor } from "../processors/BirthCertificateProcessor";
import { NIDProcessor } from "../processors/NIDProcessor";
import { UtilityBillProcessor } from "../processors/UtilityBillProcessor";
import { EducationCertificateProcessor } from "../processors/EducationCertificateProcessor";
import { PassportProcessor } from "../processors/PassportProcessor";

/**
 * Processor types enum for type safety
 */
export enum ProcessorType {
  BIRTH_CERTIFICATE = 'birth_certificate',
  NID = 'nid',
  UTILITY_BILL = 'utility_bill',
  EDUCATION_CERTIFICATE = 'education_certificate',
  PASSPORT = 'passport',
}

/**
 * Processor metadata for registration
 */
export interface ProcessorMetadata {
  type: ProcessorType;
  name: string;
  description: string;
  priority: number; // Lower number = higher priority in chain
}

/**
 * Factory for creating document processors
 * Implements Factory Method pattern
 */
export class ProcessorFactory {
  private static instance: ProcessorFactory;
  private processorRegistry: Map<ProcessorType, ProcessorMetadata>;

  private constructor() {
    this.processorRegistry = new Map();
    this.registerDefaultProcessors();
  }

  /**
   * Singleton access to factory
   */
  public static getInstance(): ProcessorFactory {
    if (!ProcessorFactory.instance) {
      ProcessorFactory.instance = new ProcessorFactory();
    }
    return ProcessorFactory.instance;
  }

  /**
   * Register default processors with metadata
   */
  private registerDefaultProcessors(): void {
    this.registerProcessor(ProcessorType.BIRTH_CERTIFICATE, {
      type: ProcessorType.BIRTH_CERTIFICATE,
      name: 'Birth Certificate Processor',
      description: 'Extracts data from Bangladesh birth certificates',
      priority: 1,
    });

    this.registerProcessor(ProcessorType.NID, {
      type: ProcessorType.NID,
      name: 'NID Processor',
      description: 'Extracts data from National ID cards',
      priority: 2,
    });

    this.registerProcessor(ProcessorType.UTILITY_BILL, {
      type: ProcessorType.UTILITY_BILL,
      name: 'Utility Bill Processor',
      description: 'Extracts address and utility information',
      priority: 3,
    });

    this.registerProcessor(ProcessorType.EDUCATION_CERTIFICATE, {
      type: ProcessorType.EDUCATION_CERTIFICATE,
      name: 'Education Certificate Processor',
      description: 'Extracts SSC and education data',
      priority: 4,
    });

    this.registerProcessor(ProcessorType.PASSPORT, {
      type: ProcessorType.PASSPORT,
      name: 'Passport Processor',
      description: 'Extracts passport, TIN, and driving license data',
      priority: 5,
    });
  }

  /**
   * Register a processor type with metadata
   */
  public registerProcessor(type: ProcessorType, metadata: ProcessorMetadata): void {
    this.processorRegistry.set(type, metadata);
    console.log(`[ProcessorFactory] Registered: ${metadata.name}`);
  }

  /**
   * Create a single processor by type
   */
  public createProcessor(type: ProcessorType): DocumentProcessor {
    console.log(`[ProcessorFactory] Creating processor: ${type}`);

    switch (type) {
      case ProcessorType.BIRTH_CERTIFICATE:
        return new BirthCertificateProcessor();

      case ProcessorType.NID:
        return new NIDProcessor();

      case ProcessorType.UTILITY_BILL:
        return new UtilityBillProcessor();

      case ProcessorType.EDUCATION_CERTIFICATE:
        return new EducationCertificateProcessor();

      case ProcessorType.PASSPORT:
        return new PassportProcessor();

      default:
        throw new Error(`Unknown processor type: ${type}`);
    }
  }

  /**
   * Create all processors and chain them together
   * Processors are ordered by priority
   */
  public createProcessorChain(): DocumentProcessor {
    console.log('[ProcessorFactory] Building processor chain');

    // Get all processor types sorted by priority
    const sortedProcessors = Array.from(this.processorRegistry.values())
      .sort((a, b) => a.priority - b.priority);

    if (sortedProcessors.length === 0) {
      throw new Error('No processors registered');
    }

    // Create first processor as chain head
    const head = this.createProcessor(sortedProcessors[0].type);
    let current = head;

    // Chain remaining processors
    for (let i = 1; i < sortedProcessors.length; i++) {
      const next = this.createProcessor(sortedProcessors[i].type);
      current.setNext(next);
      current = next;
    }

    console.log(`[ProcessorFactory] Chain built with ${sortedProcessors.length} processors`);
    return head;
  }

  /**
   * Create specific processors based on document types
   */
  public createProcessorsForDocuments(documentTypes: ProcessorType[]): DocumentProcessor | null {
    if (documentTypes.length === 0) {
      return null;
    }

    console.log('[ProcessorFactory] Building custom processor chain:', documentTypes);

    const head = this.createProcessor(documentTypes[0]);
    let current = head;

    for (let i = 1; i < documentTypes.length; i++) {
      const next = this.createProcessor(documentTypes[i]);
      current.setNext(next);
      current = next;
    }

    return head;
  }

  /**
   * Get metadata for a processor type
   */
  public getProcessorMetadata(type: ProcessorType): ProcessorMetadata | undefined {
    return this.processorRegistry.get(type);
  }

  /**
   * Get all registered processor types
   */
  public getAllProcessorTypes(): ProcessorType[] {
    return Array.from(this.processorRegistry.keys());
  }

  /**
   * Get all processor metadata sorted by priority
   */
  public getAllProcessorMetadata(): ProcessorMetadata[] {
    return Array.from(this.processorRegistry.values())
      .sort((a, b) => a.priority - b.priority);
  }
}

/**
 * Convenience function to get factory instance
 */
export function getProcessorFactory(): ProcessorFactory {
  return ProcessorFactory.getInstance();
}
