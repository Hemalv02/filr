/**
 * Factory Pattern Implementation for Document Processors
 *
 * This factory encapsulates the creation logic for document processors
 * and provides a clean interface for creating processor chains.
 */

import type { DocumentProcessor } from "../processors/DocumentProcessor";
import { BirthCertificateProcessor } from "../processors/BirthCertificateProcessor";
import { NIDProcessor } from "../processors/NIDProcessor";
import { UtilityBillProcessor } from "../processors/UtilityBillProcessor";
import { EducationCertificateProcessor } from "../processors/EducationCertificateProcessor";
import { PassportProcessor } from "../processors/PassportProcessor";

/**
 * Enum for processor types
 */
export enum ProcessorType {
  BIRTH_CERTIFICATE = "birth_certificate",
  NID = "nid",
  UTILITY_BILL = "utility_bill",
  EDUCATION_CERTIFICATE = "education_certificate",
  PASSPORT = "passport",
}

/**
 * Configuration for creating a processor chain
 */
export interface ProcessorChainConfig {
  types?: ProcessorType[]; // Specific processors to include
  excludeTypes?: ProcessorType[]; // Processors to exclude
  customOrder?: boolean; // Use custom order instead of default
}

/**
 * Abstract Factory for creating document processors
 */
export abstract class ProcessorFactory {
  /**
   * Create a single processor by type
   */
  static createProcessor(type: ProcessorType): DocumentProcessor {
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
   * Create a chain of processors with default order
   * Default order: Birth Certificate -> NID -> Utility -> Education -> Passport
   */
  static createDefaultChain(): DocumentProcessor {
    const birthProcessor = new BirthCertificateProcessor();
    const nidProcessor = new NIDProcessor();
    const utilityProcessor = new UtilityBillProcessor();
    const educationProcessor = new EducationCertificateProcessor();
    const passportProcessor = new PassportProcessor();

    // Chain them together
    birthProcessor
      .setNext(nidProcessor)
      .setNext(utilityProcessor)
      .setNext(educationProcessor)
      .setNext(passportProcessor);

    return birthProcessor;
  }

  /**
   * Create a custom chain based on configuration
   */
  static createChain(config?: ProcessorChainConfig): DocumentProcessor {
    if (!config) {
      return this.createDefaultChain();
    }

    // Determine which processors to include
    let processorTypes: ProcessorType[];

    if (config.types && config.types.length > 0) {
      // Use specified types
      processorTypes = config.types;
    } else {
      // Use all types except excluded ones
      processorTypes = Object.values(ProcessorType);
      if (config.excludeTypes && config.excludeTypes.length > 0) {
        processorTypes = processorTypes.filter(
          (type) => !config.excludeTypes!.includes(type)
        );
      }
    }

    if (processorTypes.length === 0) {
      throw new Error("At least one processor type must be specified");
    }

    // Create processors
    const processors = processorTypes.map((type) => this.createProcessor(type));

    // Chain them together
    for (let i = 0; i < processors.length - 1; i++) {
      processors[i].setNext(processors[i + 1]);
    }

    return processors[0];
  }

  /**
   * Create a chain optimized for specific document types
   */
  static createOptimizedChain(
    expectedDocumentTypes: ProcessorType[]
  ): DocumentProcessor {
    if (expectedDocumentTypes.length === 0) {
      return this.createDefaultChain();
    }

    // Create processors only for expected types, plus a fallback
    const processors = expectedDocumentTypes.map((type) =>
      this.createProcessor(type)
    );

    // Chain them together
    for (let i = 0; i < processors.length - 1; i++) {
      processors[i].setNext(processors[i + 1]);
    }

    return processors[0];
  }

  /**
   * Get all available processor types
   */
  static getAvailableProcessorTypes(): ProcessorType[] {
    return Object.values(ProcessorType);
  }

  /**
   * Get processor type from file name (helper method)
   */
  static inferProcessorTypeFromFileName(fileName: string): ProcessorType | null {
    const lowerFileName = fileName.toLowerCase();

    if (lowerFileName.includes("birth") || lowerFileName.includes("জন্ম")) {
      return ProcessorType.BIRTH_CERTIFICATE;
    }
    if (lowerFileName.includes("nid") || lowerFileName.includes("national")) {
      return ProcessorType.NID;
    }
    if (lowerFileName.includes("utility") || lowerFileName.includes("bill")) {
      return ProcessorType.UTILITY_BILL;
    }
    if (
      lowerFileName.includes("education") ||
      lowerFileName.includes("ssc") ||
      lowerFileName.includes("certificate")
    ) {
      return ProcessorType.EDUCATION_CERTIFICATE;
    }
    if (
      lowerFileName.includes("passport") ||
      lowerFileName.includes("driving") ||
      lowerFileName.includes("tin")
    ) {
      return ProcessorType.PASSPORT;
    }

    return null;
  }

  /**
   * Create an optimized chain based on files provided
   */
  static createChainForFiles(files: File[]): DocumentProcessor {
    const inferredTypes = new Set<ProcessorType>();

    // Infer processor types from file names
    for (const file of files) {
      const type = this.inferProcessorTypeFromFileName(file.name);
      if (type) {
        inferredTypes.add(type);
      }
    }

    // If we couldn't infer any types, use default chain
    if (inferredTypes.size === 0) {
      console.log(
        "Could not infer processor types from file names, using default chain"
      );
      return this.createDefaultChain();
    }

    // Create optimized chain for inferred types
    console.log(
      `Creating optimized chain for types: ${Array.from(inferredTypes).join(", ")}`
    );
    return this.createOptimizedChain(Array.from(inferredTypes));
  }
}

/**
 * Convenience function to create a processor chain
 */
export function createProcessorChain(
  config?: ProcessorChainConfig
): DocumentProcessor {
  return ProcessorFactory.createChain(config);
}

/**
 * Convenience function to create an optimized chain for files
 */
export function createOptimizedProcessorChain(files: File[]): DocumentProcessor {
  return ProcessorFactory.createChainForFiles(files);
}
