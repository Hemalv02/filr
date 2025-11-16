/**
 * Prototype Pattern Implementation
 *
 * Creates new objects by cloning existing prototypes rather than creating new instances.
 * Useful for creating complex objects efficiently and avoiding expensive initialization.
 */

import type { ExtractedData } from "../gemini";
import type { FormData } from "../formExtraction";
import type { DocumentUploadModel } from "../models/DocumentModel";

/**
 * Prototype interface - all prototypes must implement clone()
 */
export interface Prototype {
  clone(): Prototype;
}

/**
 * Deep clone helper function
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    const clonedArr: any[] = [];
    (obj as any[]).forEach((item) => {
      clonedArr.push(deepClone(item));
    });
    return clonedArr as any;
  }

  if (obj instanceof Object) {
    const clonedObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone((obj as any)[key]);
      }
    }
    return clonedObj;
  }

  throw new Error("Unable to clone object");
}

/**
 * ExtractedData Prototype
 */
export class ExtractedDataPrototype implements Prototype {
  private data: Partial<ExtractedData>;

  constructor(data: Partial<ExtractedData>) {
    this.data = data;
  }

  clone(): ExtractedDataPrototype {
    console.log("[PROTOTYPE] Cloning ExtractedData");
    return new ExtractedDataPrototype(deepClone(this.data));
  }

  getData(): Partial<ExtractedData> {
    return this.data;
  }

  setData(data: Partial<ExtractedData>): void {
    this.data = data;
  }

  /**
   * Create a partial clone with only specific fields
   */
  cloneWithFields(fields: (keyof ExtractedData)[]): ExtractedDataPrototype {
    console.log(`[PROTOTYPE] Cloning ExtractedData with fields: ${fields.join(", ")}`);
    const partialData: Partial<ExtractedData> = {};

    fields.forEach(field => {
      if (field in this.data) {
        partialData[field] = this.data[field];
      }
    });

    return new ExtractedDataPrototype(partialData);
  }

  /**
   * Merge with another prototype
   */
  mergeWith(other: ExtractedDataPrototype): ExtractedDataPrototype {
    console.log("[PROTOTYPE] Merging two ExtractedData prototypes");
    const merged = {
      ...this.data,
      ...other.getData(),
    };
    return new ExtractedDataPrototype(merged);
  }
}

/**
 * Document Upload Prototype
 */
export class DocumentUploadPrototype implements Prototype {
  private document: DocumentUploadModel;

  constructor(document: DocumentUploadModel) {
    this.document = document;
  }

  clone(): DocumentUploadPrototype {
    console.log(`[PROTOTYPE] Cloning DocumentUpload: ${this.document.label}`);

    // Deep clone the document, but handle File object specially
    const cloned: DocumentUploadModel = {
      ...this.document,
      // File objects cannot be cloned, so keep reference
      file: this.document.file,
    };

    return new DocumentUploadPrototype(cloned);
  }

  getDocument(): DocumentUploadModel {
    return this.document;
  }

  /**
   * Clone with a new file
   */
  cloneWithFile(file: File | null): DocumentUploadPrototype {
    console.log(`[PROTOTYPE] Cloning DocumentUpload with new file`);
    const cloned = this.clone();
    cloned.document.file = file;
    return cloned;
  }

  /**
   * Clone and mark as required/optional
   */
  cloneAsRequired(required: boolean): DocumentUploadPrototype {
    const cloned = this.clone();
    cloned.document.required = required;
    return cloned;
  }
}

/**
 * Form Data Prototype
 */
export class FormDataPrototype implements Prototype {
  private formData: FormData;

  constructor(formData: FormData) {
    this.formData = formData;
  }

  clone(): FormDataPrototype {
    console.log("[PROTOTYPE] Cloning FormData");
    return new FormDataPrototype(deepClone(this.formData));
  }

  getFormData(): FormData {
    return this.formData;
  }

  /**
   * Clone with filtered inputs
   */
  cloneWithFilteredInputs(filter: (input: any) => boolean): FormDataPrototype {
    console.log("[PROTOTYPE] Cloning FormData with filtered inputs");
    const cloned = deepClone(this.formData);
    cloned.inputs = cloned.inputs.filter(filter);
    return new FormDataPrototype(cloned);
  }

  /**
   * Clone with only required fields
   */
  cloneRequiredFieldsOnly(): FormDataPrototype {
    return this.cloneWithFilteredInputs(input => input.required === true);
  }
}

/**
 * Prototype Registry - Manages and provides access to prototypes
 */
export class PrototypeRegistry {
  private prototypes: Map<string, Prototype> = new Map();

  /**
   * Register a prototype
   */
  register(key: string, prototype: Prototype): void {
    this.prototypes.set(key, prototype);
    console.log(`[REGISTRY] Registered prototype: ${key}`);
  }

  /**
   * Get a clone of a registered prototype
   */
  get(key: string): Prototype | null {
    const prototype = this.prototypes.get(key);
    if (!prototype) {
      console.warn(`[REGISTRY] Prototype not found: ${key}`);
      return null;
    }

    console.log(`[REGISTRY] Retrieving clone of: ${key}`);
    return prototype.clone();
  }

  /**
   * Check if a prototype exists
   */
  has(key: string): boolean {
    return this.prototypes.has(key);
  }

  /**
   * Remove a prototype
   */
  unregister(key: string): boolean {
    const result = this.prototypes.delete(key);
    if (result) {
      console.log(`[REGISTRY] Unregistered prototype: ${key}`);
    }
    return result;
  }

  /**
   * Get all registered keys
   */
  getKeys(): string[] {
    return Array.from(this.prototypes.keys());
  }

  /**
   * Clear all prototypes
   */
  clear(): void {
    this.prototypes.clear();
    console.log("[REGISTRY] Cleared all prototypes");
  }
}

/**
 * Prototype Manager - Singleton for managing application prototypes
 */
export class PrototypeManager {
  private static instance: PrototypeManager;
  private registry: PrototypeRegistry;

  private constructor() {
    this.registry = new PrototypeRegistry();
    this.initializeDefaultPrototypes();
  }

  static getInstance(): PrototypeManager {
    if (!PrototypeManager.instance) {
      PrototypeManager.instance = new PrototypeManager();
      console.log("[PROTOTYPE MGR] Instance created");
    }
    return PrototypeManager.instance;
  }

  /**
   * Initialize default prototypes
   */
  private initializeDefaultPrototypes(): void {
    // Register empty extracted data prototype
    const emptyExtractedData: Partial<ExtractedData> = {
      name_english: "",
      name_bengali: "",
      father_name_english: "",
      father_name_bengali: "",
      mother_name_english: "",
      mother_name_bengali: "",
      date_of_birth: "",
      birth_day: "",
      birth_month: "",
      birth_year: "",
      place_of_birth: "",
      birth_registration_number: "",
      sex: "",
      permanent_address: "",
      current_address: "",
      utility_account_number: "",
      education_board: "",
      ssc_roll_number: "",
      ssc_registration_number: "",
      ssc_passing_year: "",
      institution_name: "",
      parent_nid_number: "",
      parent_name: "",
      relation: "",
      passport_number: "",
      tin_number: "",
      driving_license_number: "",
    };

    this.registry.register(
      "emptyExtractedData",
      new ExtractedDataPrototype(emptyExtractedData)
    );

    console.log("[PROTOTYPE MGR] Default prototypes initialized");
  }

  getRegistry(): PrototypeRegistry {
    return this.registry;
  }

  /**
   * Quick access to get empty extracted data
   */
  getEmptyExtractedData(): ExtractedDataPrototype {
    const prototype = this.registry.get("emptyExtractedData");
    return prototype as ExtractedDataPrototype;
  }
}

/**
 * Example usage:
 *
 * // Create prototype
 * const dataPrototype = new ExtractedDataPrototype({ name_english: "John" });
 *
 * // Clone it
 * const clone1 = dataPrototype.clone();
 * const clone2 = dataPrototype.clone();
 *
 * // Use registry
 * const registry = new PrototypeRegistry();
 * registry.register("userData", dataPrototype);
 * const userClone = registry.get("userData");
 *
 * // Use manager
 * const manager = PrototypeManager.getInstance();
 * const emptyData = manager.getEmptyExtractedData();
 */
