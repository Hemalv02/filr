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

  formData.inputs.forEach((field) => {
    const fieldKey = field.input_field_name || field.input_field_id;
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
      const fieldKey = field.input_field_name || field.input_field_id;
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
You are an expert data extraction assistant for government forms.

FORM FIELDS TO EXTRACT:
${fieldDescriptions}

INSTRUCTIONS:
1. Extract data from the provided document that matches the form fields listed above
2. Use the exact field names as keys (e.g., "name_bengali", "father_name", "d1", "m1", etc.)
3. For fields not found in the document, return an empty string ""
4. For date components (d1, d2, m1, m2, y1, y2, y3, y4):
   - d1, d2: day digits (e.g., "2" and "8" for 28)
   - m1, m2: month digits (e.g., "0" and "7" for 07)
   - y1, y2, y3, y4: year digits (e.g., "2", "0", "0", "3" for 2003)
5. For name fields:
   - If field name contains "bengali": extract Bengali text
   - If field name contains "english": extract English text
   - Otherwise, provide the most appropriate version
6. Extract addresses, NID numbers, phone numbers, and other relevant information
7. Be thorough and accurate

Please extract all available information from this document.
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
