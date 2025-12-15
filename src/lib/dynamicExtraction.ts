import { GoogleGenAI, createUserContent, createPartFromUri, Type } from "@google/genai";
import type { FormData } from "./formExtraction";

// Progress event type for dynamic extraction
export interface DynamicProgressEvent {
  stage: "upload" | "extract" | "error" | "complete";
  currentDocument: number;
  totalDocuments: number;
  documentName: string;
  message: string;
}

/**
 * Dynamic data structure based on detected form fields
 */
export type DynamicExtractedData = Record<string, string>;

/**
 * Process documents with dynamic extraction based on detected form fields
 */
export async function processDynamicDocuments(
  files: File[],
  formData: FormData,
  apiKey: string,
  model: string,
  onProgress?: (event: DynamicProgressEvent) => void
): Promise<DynamicExtractedData> {
  const ai = new GoogleGenAI({ apiKey });

  // Build dynamic schema from detected form fields
  const schemaProperties: Record<string, any> = {};
  const propertyOrdering: string[] = [];

  formData.inputs.forEach((field, idx) => {
    // Use field name, id, or fallback to label-based key
    let fieldKey = field.input_field_name || field.input_field_id;

    // If both are empty, create a key from the label
    if (!fieldKey || fieldKey.trim() === '') {
      // Convert label to snake_case as a fallback
      fieldKey = field.label
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_')     // Replace spaces with underscores
        .trim();

      // If still empty, use index-based key
      if (!fieldKey) {
        fieldKey = `field_${idx}`;
      }
    }

    schemaProperties[fieldKey] = { type: Type.STRING };
    propertyOrdering.push(fieldKey);
  });

  const responseSchema = {
    type: Type.OBJECT,
    properties: schemaProperties,
    propertyOrdering,
  };

  // Build field descriptions for the prompt
  const fieldDescriptions = formData.inputs
    .map((field, idx) => {
      let fieldKey = field.input_field_name || field.input_field_id;
      if (!fieldKey || fieldKey.trim() === '') {
        fieldKey = field.label
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '_')
          .trim() || `field_${idx}`;
      }
      return `${idx + 1}. "${fieldKey}": ${field.label}`;
    })
    .join('\n');

  // Initialize result
  const extractedData: DynamicExtractedData = {};

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    onProgress?.({
      stage: "upload",
      currentDocument: i + 1,
      totalDocuments: files.length,
      documentName: file.name,
      message: `Processing ${file.name}...`,
    });

    try {
      // Upload file to Gemini
      const uploadResult = await ai.files.upload({
        file,
        name: file.name,
        mimeType: file.type,
      });

      onProgress?.({
        stage: "extract",
        currentDocument: i + 1,
        totalDocuments: files.length,
        documentName: file.name,
        message: `Extracting data from ${file.name}...`,
      });

      // Wait for file to be processed
      let uploadedFile = await ai.files.get({ name: uploadResult.name });
      while (uploadedFile.state === "PROCESSING") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        uploadedFile = await ai.files.get({ name: uploadResult.name });
      }

      if (uploadedFile.state === "FAILED") {
        console.error(`Failed to process ${file.name}`);
        continue;
      }

      // Build extraction prompt
      const prompt = `
You are an expert data extraction assistant for government forms. You must extract ALL relevant information from the document and intelligently map it to the form fields.

FORM FIELDS TO FILL:
${fieldDescriptions}

DOCUMENT ANALYSIS & MAPPING RULES:

1. **COMPREHENSIVE EXTRACTION**: Extract ALL information from the document, not just exact field name matches
   - Birth certificates contain: name, date of birth, place of birth, parents' names, nationality, gender/sex, registration number
   - NID cards contain: name, date of birth, NID number, address, blood group, nationality
   - Passports contain: name, passport number, date of birth, nationality, date of issue/expiry
   - Educational certificates contain: name, institution, roll number, registration number, passing year, results

2. **INTELLIGENT FIELD MAPPING**: Map document data to form fields even if names don't match exactly
   - "Sex" or "Gender" in document → "select_gender" field (values: Male, Female, Other)
   - "Nationality" in document → "select_type_of_citizenship" or "select_country_of_birth" field
   - "Religion" in document → "select_religion" field (values: Islam, Hinduism, Buddhism, Christianity, etc.)
   - "Place of birth" or "District" → "select_district_of_birth" field
   - "Date of birth" → "select_date_of_birth" field (format: DD MONTH YYYY, e.g., "28 JULY 2003")
   - "Father's name" → fields containing "father"
   - "Mother's name" → fields containing "mother"

3. **NAME HANDLING**:
   - For "Full name" fields: Provide complete name exactly as in document
   - For "Given name" fields: Extract first/given name only
   - For "Surname" fields: Extract last name/surname only
   - If document has Bengali and English: match language appropriately

4. **DATE HANDLING**:
   - Convert dates to readable format: "28 JULY 2003" (not "28/07/2003")
   - For date component fields (d1, d2, m1, m2, y1, y2, y3, y4): split into individual digits

5. **ADDRESS & LOCATION**:
   - Extract district names for birth district
   - Match country names (Bangladesh, India, etc.)

6. **PROFESSION & OCCUPATION**:
   - If document mentions occupation, student status, or profession → "select_profession"
   - Common values: Student, Service, Business, Agriculture, Housewife, etc.

7. **RETURN EMPTY STRING** for fields where data is truly not available in the document

8. **USE EXACT FIELD KEYS** as provided in the field list above

CRITICAL: Look at the ENTIRE document and extract EVERY piece of relevant information. Don't leave fields empty if the information exists in the document under a different name.

Extract all available data from this document now:
`;

      // Convert model name to API format (e.g., "Gemini 2.5 Flash" -> "gemini-2.5-flash")
      const modelName = model
        ? model.toLowerCase().replace(/\s+/g, '-')
        : "gemini-2.5-flash";

      const response = await ai.models.generateContent({
        model: modelName,
        contents: createUserContent([
          prompt,
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        ]),
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      // Parse and merge the response
      const parsedData = JSON.parse(response.text);
      console.log(`Extracted data from ${file.name}:`, parsedData);

      // Merge data - only add non-empty values, don't overwrite existing data
      for (const [key, value] of Object.entries(parsedData)) {
        // Only set if current value is empty and new value is not empty
        if ((!extractedData[key] || extractedData[key] === '') && value && value !== '') {
          extractedData[key] = value;
        }
      }

      // Clean up uploaded file
      await ai.files.delete({ name: uploadResult.name });
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      onProgress?.({
        stage: "error",
        currentDocument: i + 1,
        totalDocuments: files.length,
        documentName: file.name,
        message: `Error processing ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  onProgress?.({
    stage: "complete",
    currentDocument: files.length,
    totalDocuments: files.length,
    documentName: "",
    message: "Extraction complete!",
  });

  console.log('=== FINAL EXTRACTED DATA ===');
  console.log('Total fields extracted:', Object.keys(extractedData).length);
  console.log('Extracted data:', extractedData);

  return extractedData;
}
