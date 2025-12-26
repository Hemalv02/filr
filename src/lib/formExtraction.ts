import { GoogleGenAI, createUserContent } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { OfflineNotifications } from "./offline/OfflineNotifications";

// Define the schema for input fields
const inputFieldSchema = z.object({
  label: z.string().describe("Label name of the input field."),
  input_field_id: z.string().describe("Input field ID"),
  input_field_name: z.string().describe("Input field name"),
  input_type: z.enum(["text", "textarea", "select", "radio", "checkbox", "button", "date"]).describe("Type of input element: 'text' for text inputs, 'textarea' for multi-line text, 'select' for dropdowns/combobox, 'radio' for radio buttons, 'checkbox' for checkboxes, 'button' for clickable buttons, 'date' for date inputs"),
  data_type: z.enum(["name", "address", "phone", "email", "date", "nid", "birth_registration_number", "father_name", "mother_name", "gender", "religion", "number", "text"]).optional().describe("Semantic data type: what kind of data this field expects (e.g., 'name', 'date', 'phone', 'nid'). REQUIRED for date fields."),
  data_format: z.string().optional().describe("Data format specification. REQUIRED for date fields. MUST be determined from accessibility tree hints, placeholder text, or visual context in screenshots. Examples: 'DD/MM/YYYY' (common in BD/UK), 'MM/DD/YYYY' (US format), 'YYYY-MM-DD' (ISO), 'DD-MM-YYYY', etc. For date component fields (d1, d2, m1, m2, y1-y4), specify: 'day_digit_1', 'day_digit_2', 'month_digit_1', 'month_digit_2', 'year_digit_1', etc. For other fields: phone format like '+880-XXX-XXXXXXX' or '01XXXXXXXXX', NID format '10-digit' or '17-digit'."),
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
 * Capture screenshots of the current page for visual context
 * Returns array of base64-encoded image data (without data URL prefix)
 * Captures full page by scrolling down
 */
async function capturePageScreenshots(): Promise<string[]> {
  const notifications = OfflineNotifications.getInstance();
  
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      console.warn('[FormDetection] No active tab found for screenshot capture');
      notifications.showToast({
        type: 'warning',
        title: 'Screenshot Failed',
        message: 'No active tab found',
        duration: 3000,
      });
      return [];
    }

    try {
      // First, scroll to top to ensure we start from the beginning
      // @ts-ignore - chrome API available in extension context
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo(0, 0),
      });

      // Wait a bit for scroll to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get page dimensions
      // @ts-ignore - chrome API available in extension context
      const dimensionsResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          scrollHeight: Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
          ),
          clientHeight: document.documentElement.clientHeight,
        }),
      });

      if (!dimensionsResult || !dimensionsResult[0]?.result) {
        console.warn('[FormDetection] Failed to get page dimensions');
        notifications.showToast({
          type: 'warning',
          title: 'Screenshot Failed',
          message: 'Could not determine page size',
          duration: 3000,
        });
        return [];
      }

      const { scrollHeight, clientHeight } = dimensionsResult[0].result;
      const screenshots: string[] = [];
      let scrollTop = 0;
      let index = 0;

      // Scroll and capture each viewport
      while (scrollTop < scrollHeight) {
        // Scroll to position
        // @ts-ignore - chrome API available in extension context
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (top: number) => window.scrollTo(0, top),
          args: [scrollTop],
        });

        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 300));

        // Capture visible area with rate limiting
        // Chrome has MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota
        // Add delay between captures to avoid quota errors
        if (index > 0) {
          // Wait 500ms between captures (max 2 per second) - conservative to avoid quota
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        try {
          // @ts-ignore - chrome API available in extension context
          const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
            format: 'png',
          });

          // Extract base64 data from data URL (remove data:image/png;base64, prefix)
          const base64Data = dataUrl.split(',')[1];

          if (base64Data) {
            screenshots.push(base64Data);
            console.log(`[FormDetection] Screenshot ${index + 1} captured at scroll position ${scrollTop}px`);
          } else {
            console.warn(`[FormDetection] Failed to extract base64 data from screenshot ${index + 1}`);
          }
        } catch (captureError) {
          // Handle quota errors gracefully - continue with screenshots we have
          if (captureError instanceof Error && captureError.message.includes('quota')) {
            console.warn(`[FormDetection] Quota limit reached at screenshot ${index + 1}, continuing with ${screenshots.length} screenshots`);
            break; // Exit loop, use screenshots captured so far
          }
          throw captureError; // Re-throw other errors
        }

        scrollTop += clientHeight;
        index++;
      }

      // Scroll back to top
      // @ts-ignore - chrome API available in extension context
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo(0, 0),
      });

      if (screenshots.length > 0) {
        notifications.showToast({
          type: 'success',
          title: 'Screenshots Captured',
          message: `Captured ${screenshots.length} screenshot(s) for form detection`,
          duration: 3000,
        });
        console.log(`[FormDetection] Successfully captured ${screenshots.length} screenshot(s)`);
      } else {
        notifications.showToast({
          type: 'warning',
          title: 'Screenshot Failed',
          message: 'No screenshots were captured',
          duration: 3000,
        });
      }

      return screenshots;
    } catch (captureError) {
      console.error('[FormDetection] Screenshot capture failed:', captureError);
      notifications.showToast({
        type: 'error',
        title: 'Screenshot Failed',
        message: captureError instanceof Error ? captureError.message : 'Unknown error occurred',
        duration: 5000,
      });
      return [];
    }
  } catch (error) {
    console.error('[FormDetection] Error during screenshot capture:', error);
    notifications.showToast({
      type: 'error',
      title: 'Screenshot Error',
      message: error instanceof Error ? error.message : 'Failed to capture screenshots',
      duration: 5000,
    });
    return [];
  }
}

/**
 * Extract form fields from accessibility tree using Gemini API
 * Optionally includes screenshots for visual context
 */
export async function extractFormFields(
  accessibilityTree: string, 
  apiKey: string, 
  screenshots?: string[]
): Promise<FormData> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are analyzing an accessibility tree representation of a web page to determine if it contains a VALID FORM that collects user information.

## Accessibility Tree Format

Each line: \`{indentation}{role} "{name}" [ref_id] {attributes}\`

**Structure:**
- **Indentation** = hierarchy depth (more spaces = deeper nesting, same level = siblings)
- **Role** = element type (\`form\`, \`textbox\`, \`combobox\`, \`button\`, \`label\`, \`generic\`, \`checkbox\`, \`radio\`)
- **Name** = visible label/text in quotes (may be empty)
- **ref_id** = unique identifier \`[ref_123]\` to reference this element
- **Attributes** = additional info like \`type="button"\`, \`placeholder="..."\`

**Reading hierarchy:**
- Same indentation = siblings (related elements at same level)
- More indentation = child of nearest element above with less indentation
- Read top-to-bottom to understand parent-child relationships

**Element roles:**
- \`form\` = form container (contains all form fields)
- \`textbox\` = text input field
- \`combobox\` = dropdown/select menu (child \`generic\` nodes are selectable options)
- \`button\` = clickable button (submit, cancel, or custom select option)
- \`label\` = field label (describes what a field is for)
- \`generic\` = text content, labels, or custom select options (children of combobox)
- \`checkbox\` = checkbox input
- \`radio\` = radio button

**Common form patterns:**
- Standard form: \`form\` contains \`textbox\`, \`combobox\`, \`button\` elements
- Dropdown options: \`combobox\` has \`generic\` children representing selectable options
- Button groups: Multiple \`button\` siblings at same level act as custom radio/select inputs

${screenshots && screenshots.length > 0 ? `
## Visual Context

Screenshots supplement the accessibility tree. Use them to:
- Detect date formats from visual examples (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
- Identify required fields marked with asterisks (*), colors, or visual indicators
- Understand field grouping and layout from visual structure
- Extract information visible in images but missing from tree
- Pay attention to placeholder text, help text, and visual cues
- Detect custom form components not fully represented in tree

Combine information from both the accessibility tree AND screenshots when extracting fields.
` : ''}

## Validation Rules

A valid form MUST:
1. Have at least 3-4 input fields that collect user information
2. Be part of an actual form structure (\`form\` role or clearly grouped fields)
3. Collect related information together (personal details, application data, registration info)

DO NOT include:
- Single input fields (search boxes, isolated login fields)
- Navigation elements or scattered standalone inputs

## Extraction Strategy

1. **Locate the form**: Find \`form\` role or group of related input fields
2. **Identify fields**: Look for \`textbox\`, \`combobox\`, \`button\` elements (siblings or children of form)
3. **Read labels**: Extract from \`label\` elements or names in quotes
4. **Find options**: For \`combobox\`, note available options from \`generic\` children
5. **Handle button groups**: Multiple \`button\` siblings at same level = ONE select field with multiple options
   - Pattern: Label followed by multiple buttons (e.g., "Gender" label → MALE/FEMALE/OTHERS buttons)
   - Extract as ONE field, not separate button fields
   - Use label text for field name, first button's ref_id for ref_id
   - Common patterns: Gender/Sex (Male/Female/Others), Yes/No questions, radio-style selections
6. **Extract ref_id**: Always include [ref_X] when available - enables reliable form filling
7. **Use visual context**: Enhance field identification from screenshots when tree is incomplete

If the page contains a valid form meeting these criteria, extract:
- The form name/title
- All input fields, select dropdowns, textareas with:
  - Label (from accessible_name in the tree or visual context from images)
  - input_field_id (try to extract from element attributes or infer from label/name)
  - input_field_name (try to extract from element attributes or infer from label/name)
  - input_type (determine from the role in accessibility tree):
    * "text" - for textbox, input fields (role: textbox, input)
    * "textarea" - for multi-line text areas (role: textarea)
    * "select" - for dropdowns and combobox (role: combobox, listbox, select)
    * "radio" - for radio buttons (role: radio)
    * "checkbox" - for checkboxes (role: checkbox)
    * "button" - for clickable buttons that act as inputs (role: button, often used for gender/custom selects)
    * "date" - for date inputs (role: textbox with date-related labels or multiple single-digit inputs)
  - data_type (REQUIRED for date fields, optional for others - semantic meaning of the data):
    * "name" - person's name
    * "father_name" / "mother_name" - parent names
    * "address" - address fields
    * "phone" - phone number
    * "email" - email address
    * "date" - date fields (MUST include data_format)
    * "nid" - National ID card number
    * "birth_registration_number" - birth certificate number
    * "gender" - gender/sex field
    * "religion" - religion field
    * "number" - generic number field
    * "text" - generic text field
  - data_format (REQUIRED for all date fields to prevent wrong filling):
    * **CRITICAL**: Determine date format from:
      1. Placeholder text in accessibility tree (e.g., "DD/MM/YYYY", "MM/DD/YYYY")
      2. Visual hints in screenshots (example dates shown, format indicators)
      3. Label text hints (e.g., "তারিখ (DD/MM/YYYY)", "Date (MM/DD/YYYY)")
      4. Default to "DD/MM/YYYY" for Bangladesh government forms if no hints found
    * For FULL date input fields:
      - "DD/MM/YYYY" - Day/Month/Year (Bangladesh, UK, most of world)
      - "MM/DD/YYYY" - Month/Day/Year (USA)
      - "YYYY-MM-DD" - ISO format
      - "DD-MM-YYYY" - Alternative separator
    * For DATE COMPONENT fields (common in BD government forms where each digit has separate input):
      - Fields like "d1", "d2" (day digits): "day_digit_1", "day_digit_2"
      - Fields like "m1", "m2" (month digits): "month_digit_1", "month_digit_2"
      - Fields like "y1", "y2", "y3", "y4" (year digits): "year_digit_1", "year_digit_2", "year_digit_3", "year_digit_4"
      - The format for component fields is ALWAYS "DD/MM/YYYY" in Bangladesh forms
    * For other data types (phone, NID), include format hints:
      - Phone: "+880-XXX-XXXXXXX", "01XXXXXXXXX", etc.
      - NID: "10-digit", "17-digit", "13-digit"
    * **This ensures correct data extraction and prevents critical errors like filling day into month field**
  - **ref_id**: The [ref_X] identifier from tree (PREFERRED - enables reliable form filling)

**Important:**
- Always extract ref_id when available - it's the most reliable way to identify elements
- If ref_id unavailable, still provide input_field_id and input_field_name
- For button groups, extract ONE field representing the group (not individual buttons)

If NO valid form exists (fewer than 3 fields, or just scattered inputs), return an empty inputs array.

Accessibility tree to analyze:
${accessibilityTree}
`;

  // Build contents array with prompt and optional screenshots
  // Format according to Gemini API docs: text must be wrapped in { text: "..." }
  const contents: any[] = [{ text: prompt }];

  if (screenshots && screenshots.length > 0) {
    // Add screenshots as inlineData
    screenshots.forEach((base64Data) => {
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: base64Data,
        },
      });
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: createUserContent(contents),
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
  console.log('✅ Accessibility tree retrieved');
  
  // Capture screenshots for visual context
  onProgress?.("capturing_screenshots");
  const screenshots = await capturePageScreenshots();
  console.log(`✅ Screenshots captured: ${screenshots.length} image(s)`);
  
  onProgress?.("detecting_form");
  const formData = await extractFormFields(accessibilityTree, apiKey, screenshots.length > 0 ? screenshots : undefined);
  console.log('✅ Form extraction complete:', {
    formName: formData.form_name,
    fieldCount: formData.inputs.length,
    fields: formData.inputs.map(f => ({ label: f.label, ref_id: f.ref_id })),
    usedScreenshots: screenshots.length > 0
  });
  
  onProgress?.("validating_form");
  // Validation happens automatically in extractFormFields
  // but we report it here for UI feedback
  
  return formData;
}
