import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Define the schema for input fields
const inputFieldSchema = z.object({
  label: z.string().describe("Label name of the input field."),
  input_field_id: z.string().describe("Input field ID"),
  input_field_name: z.string().describe("Input field name"),
  ref_id: z.string().optional().describe("Reference ID from accessibility tree (e.g., 'ref_1')"),
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
 * Get the accessibility tree of the currently active tab
 */
export async function getPageAccessibilityTree(): Promise<string> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    throw new Error("No active tab found");
  }

  // Send message to content script to generate accessibility tree
  const response = await browser.tabs.sendMessage(tab.id, {
    action: 'generateAccessibilityTree',
    filter: 'all', // Include all elements for better context
    depth: 15,
    expandCustomSelects: true, // Expand custom selects to capture options
  });

  if (!response || !response.success) {
    throw new Error(response?.error || "Failed to generate accessibility tree");
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  const accessibilityTree = response.data.pageContent;
  
  // Log the full accessibility tree for debugging
  console.log('=== ACCESSIBILITY TREE GENERATED ===');
  console.log('Tree length:', accessibilityTree.length, 'characters');
  console.log('Full accessibility tree:');
  console.log(accessibilityTree);
  console.log('=== END OF ACCESSIBILITY TREE ===');

  return accessibilityTree;
}

/**
 * Extract form fields from accessibility tree using Gemini API
 */
export async function extractFormFields(accessibilityTree: string, apiKey: string): Promise<FormData> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are analyzing an accessibility tree representation of a web page to determine if it contains a VALID FORM that collects user information.

The accessibility tree format is:
- Each line represents an element: \`role "accessible_name" [ref_id]\`
- Indentation shows parent-child relationships
- ref_id (like [ref_1]) uniquely identifies each element
- For combobox elements, child nodes (indented) represent available options

IMPORTANT VALIDATION RULES:
1. A valid form MUST have at least 3-4 input fields that collect user information
2. The inputs must be part of an actual form structure (wrapped in <form> tags or clearly grouped together)
3. Single input fields (like search boxes, login fields alone, or isolated inputs) are NOT valid forms
4. The form should be collecting related information together (e.g., personal details, application data, registration info)
5. DO NOT include navigation elements, search boxes, or scattered standalone inputs

If the page contains a valid form meeting these criteria, extract:
- The form name/title
- All input fields, select dropdowns, textareas with:
  - Label (from accessible_name in the tree)
  - input_field_id (try to extract from element attributes or infer from label/name)
  - input_field_name (try to extract from element attributes or infer from label/name)
  - ref_id (the [ref_X] identifier from the tree - PREFERRED but optional if not available)

IMPORTANT: 
- Extract ref_id from the tree format [ref_X] when available - this enables more reliable form filling
- If ref_id cannot be extracted, still provide input_field_id and input_field_name
- Both approaches (with or without ref_id) are supported for backward compatibility

If NO valid form exists (fewer than 3 fields, or just scattered inputs), return an empty inputs array.

Accessibility tree to analyze:
${accessibilityTree}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(inputFieldListSchema),
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Empty response from AI");
  }
  const formData = inputFieldListSchema.parse(JSON.parse(responseText));

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
  apiKey: string,
  onProgress?: (step: string) => void
): Promise<SourceDocumentList> {
  onProgress?.("detecting_documents");
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

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Empty response from AI");
  }
  const documentList = sourceDocumentListSchema.parse(JSON.parse(responseText));
  return documentList;
}

/**
 * Main function to detect and extract form from the current page
 */
export async function detectAndExtractForm(
  apiKey: string,
  onProgress?: (step: string) => void
): Promise<FormData> {
  console.log('🔍 Starting form detection...');
  
  onProgress?.("generating_tree");
  const accessibilityTree = await getPageAccessibilityTree();
  console.log('✅ Accessibility tree retrieved, extracting form fields...');
  
  onProgress?.("detecting_form");
  const formData = await extractFormFields(accessibilityTree, apiKey);
  console.log('✅ Form extraction complete:', {
    formName: formData.form_name,
    fieldCount: formData.inputs.length,
    fields: formData.inputs.map(f => ({ label: f.label, ref_id: f.ref_id }))
  });
  
  onProgress?.("validating_form");
  // Validation happens automatically in extractFormFields
  // but we report it here for UI feedback
  
  return formData;
}
