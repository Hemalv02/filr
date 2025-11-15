import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Define the schema for input fields
const inputFieldSchema = z.object({
  label: z.string().describe("Label name of the input field."),
  input_field_id: z.string().describe("Input field ID"),
  input_field_name: z.string().describe("Input field name"),
});

// Define the schema for the complete form structure
const inputFieldListSchema = z.object({
  form_name: z.string().describe("Form name of the given form"),
  inputs: z.array(inputFieldSchema),
});

// Define the schema for source documents
const sourceDocumentSchema = z.object({
  file_id: z.string().describe("Unique identifier for the document type, e.g., 'birth_certificate', 'nid_card'"),
  document_name_english: z.string().describe("Document name in English"),
  document_name_bangla: z.string().describe("Document name in Bengali/Bangla"),
  fields_provided: z.array(z.string()).describe("List of form field IDs that can be extracted from this document"),
  necessity: z.string().describe("Whether this document is 'required', 'optional', or 'conditional'"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0.0 to 1.0"),
  notes: z.string().default("").describe("Additional notes about this source document"),
});

const sourceDocumentListSchema = z.object({
  form_type_english: z.string().describe("Form type in English"),
  form_type_bangla: z.string().describe("Form type in Bengali/Bangla"),
  source_documents: z.array(sourceDocumentSchema),
  additional_notes: z.string().default("").describe("General guidance about document collection"),
});

export type InputField = z.infer<typeof inputFieldSchema>;
export type FormData = z.infer<typeof inputFieldListSchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type SourceDocumentList = z.infer<typeof sourceDocumentListSchema>;

/**
 * Get the HTML source code of the currently active tab
 */
export async function getPageHTMLSource(): Promise<string> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    throw new Error("No active tab found");
  }

  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return document.documentElement.outerHTML;
    },
  });

  if (!results || !results[0] || !results[0].result) {
    throw new Error("Failed to retrieve HTML source");
  }

  return results[0].result as string;
}

/**
 * Extract form fields from HTML source using Gemini API
 */
export async function extractFormFields(htmlSource: string, apiKey: string): Promise<FormData> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are analyzing a web page to determine if it contains a VALID FORM that collects user information.

IMPORTANT VALIDATION RULES:
1. A valid form MUST have at least 3-4 input fields that collect user information
2. The inputs must be part of an actual form structure (wrapped in <form> tags or clearly grouped together)
3. Single input fields (like search boxes, login fields alone, or isolated inputs) are NOT valid forms
4. The form should be collecting related information together (e.g., personal details, application data, registration info)
5. DO NOT include navigation elements, search boxes, or scattered standalone inputs

If the page contains a valid form meeting these criteria, extract:
- The form name/title
- All input fields, select dropdowns, textareas with their associated labels, IDs, and names

If NO valid form exists (fewer than 3 fields, or just scattered inputs), return an empty inputs array.

HTML to analyze:
${htmlSource}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(inputFieldListSchema),
    },
  });

  const formData = inputFieldListSchema.parse(JSON.parse(response.text));

  // Additional validation: Ensure minimum field count
  if (formData.inputs.length < 3) {
    return {
      form_name: "",
      inputs: []
    };
  }

  return formData;
}

/**
 * Detect required source documents based on extracted form fields
 */
export async function detectRequiredDocuments(
  formData: FormData,
  apiKey: string
): Promise<SourceDocumentList> {
  const ai = new GoogleGenAI({ apiKey });

  // Extract field information
  const fieldInfo = formData.inputs
    .map((field) => `${field.label} (ID: ${field.input_field_name})`)
    .join("\n- ");

  const prompt = `
You are analyzing a government form to identify which SOURCE DOCUMENTS a user needs to collect to fill it out.
Form Name: ${formData.form_name}

Given the following form fields (with both Bengali and English labels):

- ${fieldInfo}

Your task:
1. Identify what type of FORM this is in both English and Bengali
2. Determine which SOURCE DOCUMENTS the user should collect to extract data for these fields
3. For each source document, provide:
   - A unique file_id in snake_case (e.g., 'birth_certificate', 'father_nid', 'utility_bill')
   - Document name in English
   - Document name in Bengali/Bangla (বাংলা)
   - Which specific form field IDs can be filled using data from that document (use the field IDs like 'name_bengali', 'father_nid', etc.)
   - Necessity: 'required', 'optional', or 'conditional' (lowercase)
   - Confidence level (0.0 to 1.0)
   - Brief notes explaining when/why this document is needed

Common source documents to consider:
- Birth Certificate / জন্ম নিবন্ধন সনদপত্র
- National Identity Card (NID) / জাতীয় পরিচয়পত্র
- Passport / পাসপোর্ট
- Driving License / ড্রাইভিং লাইসেন্স
- TIN Certificate / টিআইএন সনদপত্র
- Educational Certificates / শিক্ষাগত সনদপত্র
- Marriage Certificate / বিবাহ সনদপত্র
- Parents' NID / পিতা-মাতার জাতীয় পরিচয়পত্র
- Utility Bills / ইউটিলিটি বিল
- Death Certificate / মৃত্যু সনদপত্র

IMPORTANT:
- Use the actual field IDs (like 'name_bengali', 'father_nid', 'pr_house') in the fields_provided list
- Provide accurate Bengali translations
- Use snake_case for file_id (e.g., 'birth_certificate', 'father_nid', 'mother_nid', 'utility_bill_address_proof')
- Set necessity as lowercase: 'required', 'optional', or 'conditional'
- If the application is for applying certain document, then don't include the document for that (you can include father or mother or other's same document, but not for the user himself)
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(sourceDocumentListSchema),
    },
  });

  const documentList = sourceDocumentListSchema.parse(JSON.parse(response.text));
  return documentList;
}

/**
 * Main function to detect and extract form from the current page
 */
export async function detectAndExtractForm(apiKey: string): Promise<FormData> {
  const htmlSource = await getPageHTMLSource();
  const formData = await extractFormFields(htmlSource, apiKey);
  return formData;
}
