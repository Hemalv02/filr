import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
  Type,
} from "@google/genai";

export interface ExtractedData {
  // Birth Certificate Info
  name_english: string;
  name_bengali: string;
  father_name_english: string;
  father_name_bengali: string;
  mother_name_english: string;
  mother_name_bengali: string;
  date_of_birth: string;
  birth_day: string;
  birth_month: string;
  birth_year: string;
  place_of_birth: string;
  birth_registration_number: string;
  sex: string;
  permanent_address: string;

  // Utility Bill / Address Info
  current_address: string;
  utility_account_number: string;

  // SSC Certificate Info
  education_board: string;
  ssc_roll_number: string;
  ssc_registration_number: string;
  ssc_passing_year: string;
  institution_name: string;

  // NID Card Info
  parent_nid_number: string;
  parent_name: string;
  relation: string;

  // Passport/TIN/Driving License
  passport_number: string;
  tin_number: string;
  driving_license_number: string;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    // Birth Certificate
    name_english: { type: Type.STRING },
    name_bengali: { type: Type.STRING },
    father_name_english: { type: Type.STRING },
    father_name_bengali: { type: Type.STRING },
    mother_name_english: { type: Type.STRING },
    mother_name_bengali: { type: Type.STRING },
    date_of_birth: { type: Type.STRING },
    birth_day: { type: Type.STRING },
    birth_month: { type: Type.STRING },
    birth_year: { type: Type.STRING },
    place_of_birth: { type: Type.STRING },
    birth_registration_number: { type: Type.STRING },
    sex: { type: Type.STRING },
    permanent_address: { type: Type.STRING },

    // Address/Utility
    current_address: { type: Type.STRING },
    utility_account_number: { type: Type.STRING },

    // Education
    education_board: { type: Type.STRING },
    ssc_roll_number: { type: Type.STRING },
    ssc_registration_number: { type: Type.STRING },
    ssc_passing_year: { type: Type.STRING },
    institution_name: { type: Type.STRING },

    // NID
    parent_nid_number: { type: Type.STRING },
    parent_name: { type: Type.STRING },
    relation: { type: Type.STRING },

    // Other IDs
    passport_number: { type: Type.STRING },
    tin_number: { type: Type.STRING },
    driving_license_number: { type: Type.STRING },
  },
  propertyOrdering: [
    "name_english",
    "name_bengali",
    "father_name_english",
    "father_name_bengali",
    "mother_name_english",
    "mother_name_bengali",
    "date_of_birth",
    "birth_day",
    "birth_month",
    "birth_year",
    "place_of_birth",
    "birth_registration_number",
    "sex",
    "permanent_address",
    "current_address",
    "utility_account_number",
    "education_board",
    "ssc_roll_number",
    "ssc_registration_number",
    "ssc_passing_year",
    "institution_name",
    "parent_nid_number",
    "parent_name",
    "relation",
    "passport_number",
    "tin_number",
    "driving_license_number",
  ],
};

/**
 * Process documents using Chain of Responsibility + Factory patterns
 *
 * PATTERN USAGE:
 * - Chain of Responsibility: Files pass through processor chain
 * - Factory Pattern: Processors created by factory
 * - Observer Pattern: Progress notifications
 * - Decorator Pattern: Optional logging/metrics
 */
export async function processDocuments(
  files: File[],
  apiKey: string,
  model: string,
  onProgress?: (event: any) => void
): Promise<ExtractedData> {
  console.log("🟢 processDocuments called", { fileCount: files.length, model });
  
  // FACTORY PATTERN + CHAIN OF RESPONSIBILITY: Use ProcessorChain
  const { ProcessorChain } = await import("./processors/ProcessorChain");

  console.log("🟢 ProcessorChain imported, creating optimized chain...");

  // Create optimized chain for files (uses Factory pattern internally)
  const chain = ProcessorChain.createOptimizedForFiles(files, {
    enableLogging: true,
    enableMetrics: false,
    enableSanitization: true,
  });

  console.log("🟢 Chain created, setting up observer...");

  // OBSERVER PATTERN: Subscribe to progress updates if callback provided
  if (onProgress) {
    chain.subscribe({
      onProgress: (event) => {
        console.log("🟢 Progress event from chain:", event);
        onProgress(event);
      },
    });
  }

  console.log("🟢 Starting chain.processDocuments...");

  // CHAIN OF RESPONSIBILITY: Process documents through the chain
  const result = await chain.processDocuments(files, apiKey, model);

  console.log("🟢 Chain processing complete. Result:", result);

  // Log any errors but don't throw - return partial data
  if (result.errors.length > 0) {
    console.warn("[PATTERN] Processing errors:", result.errors);
  }

  if (result.warnings.length > 0) {
    console.warn("[PATTERN] Processing warnings:", result.warnings);
  }

  return result.data;
}
