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
  accessibilityTree?: string,
  additionalContext?: string,
  onProgress?: (event: DynamicProgressEvent) => void
): Promise<DynamicExtractedData> {
  const ai = new GoogleGenAI({ apiKey });

  // Build dynamic schema from detected form fields
  // Each field returns: { value: string, ref_id?: string }
  const schemaProperties: Record<string, any> = {};
  const propertyOrdering: string[] = [];

  formData.inputs.forEach((field) => {
    const fieldKey = field.input_field_name || field.input_field_id;
    // Return object with value and optional ref_id
    schemaProperties[fieldKey] = {
      type: Type.OBJECT,
      properties: {
        value: { type: Type.STRING },
        ref_id: { type: Type.STRING },
      },
      required: ["value"],
    };
    propertyOrdering.push(fieldKey);
  });

  const responseSchema = {
    type: Type.OBJECT,
    properties: schemaProperties,
    propertyOrdering,
  };

  // Build field descriptions for the prompt with data type and format info
  const fieldDescriptions = formData.inputs
    .map((field, idx) => {
      const fieldKey = field.input_field_name || field.input_field_id;
      let description = `${idx + 1}. "${fieldKey}": ${field.label}`;

      // Add ref_id if available
      if (field.ref_id) {
        description += ` [ref_id: ${field.ref_id}]`;
      }

      // Add data type if available
      if (field.data_type) {
        description += ` [Type: ${field.data_type}]`;
      }

      // Add format specification if available
      if (field.data_format) {
        description += ` [Format: ${field.data_format}]`;
      }

      return description;
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
        config: {
          mimeType: file.type,
        },
      });

      onProgress?.({
        stage: "extract",
        currentDocument: i + 1,
        totalDocuments: files.length,
        documentName: file.name,
        message: `Extracting data from ${file.name}...`,
      });

      // Wait for file to be processed
      const fileIdentifier = uploadResult.name || uploadResult.uri;
      if (!fileIdentifier) {
        console.error(`Failed to get file name/URI for ${file.name}`);
        continue;
      }
      let uploadedFile = await ai.files.get({ name: fileIdentifier });
      while (uploadedFile.state === "PROCESSING") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        uploadedFile = await ai.files.get({ name: fileIdentifier });
      }

      if (uploadedFile.state === "FAILED") {
        console.error(`Failed to process ${file.name}`);
        continue;
      }

      // Build extraction prompt
      const prompt = `
You are an expert data extraction assistant for government forms.

${additionalContext ? `
## FORM FILL CONTEXT PROVIDED BY USER:
${additionalContext}

**Please use this context to better understand form field mappings and improve extraction accuracy.**
**Examples of context:**
- "Field 'nationality' might be labeled as 'Country' in the form"
- "Use 'passport_number' for 'document_id' field"
- "Field 'birth_place' maps to 'place_of_birth' in the form"

` : ''}

FORM FIELDS TO EXTRACT:
${fieldDescriptions}

${accessibilityTree ? `
## FORM STRUCTURE CONTEXT

The accessibility tree below shows the form structure and field relationships. Use this to better understand:
- Field labels and context
- Button groups and custom inputs (e.g., gender selection buttons)
- Date field formats and component structure (d1, d2, m1, m2, y1-y4)
- Field relationships and hierarchy
- Required vs optional fields

**Accessibility Tree Format:**
Each line: \`{indentation}{role} "{name}" [ref_id] {attributes}\`
- **Indentation** = hierarchy depth (more spaces = deeper nesting)
- **Role** = element type (\`form\`, \`textbox\`, \`combobox\`, \`button\`, \`label\`, \`generic\`)
- **Name** = visible label/text in quotes
- **ref_id** = unique identifier [ref_123] to reference elements
- **Attributes** = additional info like \`type="button"\`, \`placeholder="..."\`

**Key Patterns:**
- Button groups: Multiple \`button\` siblings at same level = custom select (e.g., MALE/FEMALE/OTHERS)
- Date components: Separate inputs for each digit (d1, d2 for day, m1, m2 for month, y1-y4 for year)
- Dropdowns: \`combobox\` with \`generic\` children as options

**Accessibility Tree:**
\`\`\`
${accessibilityTree}
\`\`\`

**Use the tree to:**
- Match extracted data to correct field names (especially for button groups)
- Understand date format requirements from field structure
- Identify field relationships and context
- Ensure extracted values match form expectations (e.g., "Male"/"Female" vs "M"/"F")
- **Check available options for select/dropdown fields** - Only use values that exist in the options list
- **Map cities/regions to countries** - If form only has country options but document shows city (e.g., "Rajshahi" → "Bangladesh")

` : ''}

CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:

1. **Response Format**: For each field, return an object with:
   - \`value\`: The extracted data as a string (or empty string "" if not found)
   - \`ref_id\`: The ref_id from the field description if available (e.g., "ref_123")
   
   Example response:
   \`\`\`json
   {
     "name_bengali": { "value": "মোহাম্মদ", "ref_id": "ref_45" },
     "father_name": { "value": "Abdul Rahman", "ref_id": "ref_46" },
     "date_of_birth": { "value": "15/03/1990", "ref_id": "ref_47" }
   }
   \`\`\`

2. **Use exact field names** as keys (e.g., "name_bengali", "father_name", "d1", "m1", etc.)

3. **For fields not found** in the document, return \`{ "value": "", "ref_id": "ref_XXX" }\` (include ref_id if available)

3. **DATE FIELDS - FORMAT-AWARE EXTRACTION** (MOST IMPORTANT):

   a) For DATE COMPONENT fields (d1, d2, m1, m2, y1-y4):
      - Extract individual digits from the date
      - d1, d2: day digits (e.g., for "28" → d1="2", d2="8")
      - m1, m2: month digits (e.g., for "07" → m1="0", m2="7")
      - y1, y2, y3, y4: year digits (e.g., for "2003" → y1="2", y2="0", y3="0", y4="3")
      - ALWAYS extract from date in DD/MM/YYYY format (Bangladesh standard)

   b) For FULL DATE fields with [Format: ...]:
      - If format is "DD/MM/YYYY": Extract as "15/03/1990"
      - If format is "MM/DD/YYYY": Extract as "03/15/1990" (swap day and month)
      - If format is "YYYY-MM-DD": Extract as "1990-03-15"
      - If format is "DD-MM-YYYY": Extract as "15-03-1990"
      - **Match the exact format specified in [Format: ...] tag**
      - **If document shows "15-03-1990" but form needs "MM/DD/YYYY", convert to "03/15/1990"**

   c) For date fields without explicit format:
      - Default to DD/MM/YYYY format (Bangladesh standard)

4. **NAME FIELDS**:
   - If [Type: name] or [Type: father_name] or [Type: mother_name]
   - If field name contains "bengali": extract Bengali text (বাংলা)
   - If field name contains "english": extract English text
   - Otherwise, provide the most appropriate version

5. **PHONE FIELDS**:
   - If [Type: phone] and [Format: ...] specified, match that format
   - If format is "01XXXXXXXXX": Extract as "01712345678"
   - If format is "+880-XXX-XXXXXXX": Extract as "+880-171-2345678"
   - Remove or add spaces/dashes according to format

6. **NID FIELDS**:
   - If [Type: nid] and [Format: ...] specified
   - If format is "10-digit": Extract 10 digits only
   - If format is "17-digit": Extract 17 digits only

7. **SELECT/DROPDOWN FIELDS - CRITICAL MATCHING RULES**:
   - **NEVER add custom values** - Select/dropdown fields can ONLY accept values from their predefined options
   - **Check available options** from the accessibility tree (look for \`combobox\` with \`generic\` children showing options)
   - **If extracted value doesn't match any option**, use intelligent mapping:
   
   a) **Country/Region Mapping** (MOST COMMON CASE):
      - If document shows a city/region but form only has country options:
        * Bangladesh cities/regions → "Bangladesh":
          - Dhaka, Chittagong, Rajshahi, Khulna, Sylhet, Barisal, Rangpur, Mymensingh
          - Any city/district name from Bangladesh → use "Bangladesh"
        * Indian cities/regions → "India":
          - Mumbai, Delhi, Kolkata, Chennai, Bangalore, Hyderabad, etc.
        * Other countries: Map city to country (e.g., "London" → "United Kingdom", "New York" → "United States")
      - **Example**: Document says "Rajshahi" but form only has "Bangladesh" → Extract "Bangladesh"
      - **Example**: Document says "Dhaka" but form only has country names → Extract "Bangladesh"
   
   b) **Partial Match**:
      - Try case-insensitive matching first
      - Try partial matches (e.g., "Bangladesh" matches "BANGLADESH", "bangladesh")
      - Try common variations (e.g., "USA" → "United States", "UK" → "United Kingdom")
   
   c) **If no match found**:
      - Use the closest available option
      - If field is required and no match: Use the most likely option based on context
      - If field is optional: Leave empty ("") rather than using wrong value
   
   d) **Birth Place/Place of Birth Fields**:
      - Common pattern: Document shows city, form expects country
      - Always map to country if form only has country options
      - Bangladesh cities/districts → "Bangladesh"
      - Indian cities/states → "India"
      - Use document context (passport country, document language) to infer country

8. **OTHER FIELDS**:
   - Extract addresses, birth registration numbers, and other data as-is
   - Maintain original text quality and accuracy
   - For text fields (not selects), extract exact values from document

9. **Be thorough and accurate** - extract all available information that matches the requested fields

10. **INTELLIGENT INFERENCE** - Make educated guesses for fields not directly in the document:

   a) **Gender Inference** (CRITICAL - Common mistake to avoid):
      - If [Type: gender] field exists but gender not in document, infer from name
      - **IMPORTANT**: Analyze name CAREFULLY before inferring gender:

        **Muslim/Bangladesh Male Names**:
        * Muhammad, Mohammad, Mohammed, Md, Abdul, Ahmed, Mominul, Sakib, Rashid, Karim, Rahman
        * Patterns: Names with "ul", "ud", "ur" (Abdul, Mominul, Rashidul, etc.)
        * Endings: "Uddin", "Ullah", "Rahman", "Karim", "Islam" (as last name), "Miah", "Ali"

        **Muslim/Bangladesh Female Names**:
        * Fatima, Ayesha, Khadija, Sultana, Begum, Akter, Khatun, Nusrat, Farzana
        * Patterns: Names with "Nessa", "Nahar", "Banu"
        * Endings: "Begum", "Khatun", "Akter", "Sultana", "Parvin"

        **English Male Names**:
        * John, David, Michael, James, Robert, William, Thomas, Daniel

        **English Female Names**:
        * Mary, Sarah, Jennifer, Emily, Jessica, Lisa, Linda

      - **CRITICAL RULES**:
        1. "Mominul" (as in "Mominul Islam") → MALE (common Bangladesh male name)
        2. "Islam" as middle/last name → Check first name to determine gender
        3. If first name is male AND no female indicators → MALE
        4. Female indicators MUST BE PRESENT to guess Female (Begum, Khatun, Akter, etc.)
        5. When in doubt with male first name → Default to MALE, NOT Female

      - **Common Mistakes to AVOID**:
        ❌ "Mominul Islam Hemal" → Female (WRONG! Mominul is MALE)
        ✅ "Mominul Islam Hemal" → Male (CORRECT!)
        ❌ "Abdul Rahman" → Female (WRONG! Abdul is MALE prefix)
        ✅ "Abdul Rahman" → Male (CORRECT!)

      - **Format for gender field**:
        * Return exactly: "Male", "Female", or "Others"
        * Match the button options in the form
        * Case-sensitive matching preferred

   b) **Religion Inference**:
      - If [Type: religion] field exists but religion not in document, infer from name
      - Muslim names: Muhammad, Abdul, Ahmed, Fatima, Ayesha, names with Islamic references
      - Hindu names: Kumar, Singh, Devi, Krishna, Ram, Sharma
      - Christian names: John, Mary, David, Sarah (in Bangladesh context, check surname)
      - Default to "Islam" for Bangladesh documents if uncertain (90%+ population Muslim)

   c) **Nationality/Country Inference**:
      - If nationality field exists, infer from:
        * Address mentions (e.g., "Dhaka, Bangladesh" → "Bangladeshi")
        * Document type (Bangladesh birth certificate → "Bangladeshi")
        * Language (Bengali text → likely "Bangladeshi")
      - Common patterns:
        * "Bangladesh" in address → Nationality: "Bangladeshi", Country: "Bangladesh"
        * Indian address → Nationality: "Indian", Country: "India"

   d) **Marital Status Inference** (if requested):
      - Difficult to infer, leave empty unless clear indicators
      - If age < 18 → likely "Unmarried"
      - If "spouse" or "husband/wife" mentioned → "Married"

   e) **Age from Date of Birth**:
      - If age field requested but only DOB in document, calculate age
      - Current year: 2025
      - Example: DOB 15/03/1990 → Age: 35

   **IMPORTANT NOTES**:
   - These are EDUCATED GUESSES to help the user
   - User can edit if wrong
   - Only infer when field is requested but not in document
   - Don't override actual document data with inferences
   - Mark confidence: if very uncertain, leave empty

**Remember**: The [Format: ...] tag tells you EXACTLY how the form expects the data. Convert the document data to match that format.

Please extract all available information from this document.
`;

      // Convert model name to API format (e.g., "Gemini 2.5 Flash" -> "gemini-2.5-flash")
      const modelName = model
        ? model.toLowerCase().replace(/\s+/g, '-')
        : "gemini-2.5-flash";

      const fileUri = uploadedFile.uri;
      const fileMimeType = uploadedFile.mimeType;
      if (!fileUri || !fileMimeType) {
        console.error(`Failed to get file URI or MIME type for ${file.name}`);
        continue;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: createUserContent([
          prompt,
          createPartFromUri(fileUri, fileMimeType),
        ]),
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      // Parse and merge the response
      const responseText = response.text;
      if (!responseText) {
        console.error(`Empty response for ${file.name}`);
        continue;
      }
      const parsedData = JSON.parse(responseText) as Record<string, any>;
      console.log(`Extracted data from ${file.name}:`, parsedData);

      // Initialize ref_id map if not exists
      if (!(window as any).__extractedRefIds) {
        (window as any).__extractedRefIds = {};
      }

      // Merge data - handle both new format ({value, ref_id}) and old format (string) for backward compatibility
      for (const [key, value] of Object.entries(parsedData)) {
        let extractedValue: string = '';
        let refId: string | undefined = undefined;
        
        // Handle new format: { value: string, ref_id?: string }
        if (value && typeof value === 'object' && 'value' in value) {
          extractedValue = String(value.value || '');
          refId = value.ref_id;
        }
        // Handle old format: string (backward compatibility)
        else if (typeof value === 'string') {
          extractedValue = value;
        }
        else {
          extractedValue = String(value || '');
        }
        
        // Only set if current value is empty and new value is not empty
        if ((!extractedData[key] || extractedData[key] === '') && extractedValue && extractedValue !== '') {
          extractedData[key] = extractedValue;
          
          // Store ref_id if available
          if (refId) {
            (window as any).__extractedRefIds[key] = refId;
            console.log(`Stored ref_id for ${key}: ${refId}`);
          }
        }
      }

      // Clean up uploaded file
      const fileIdentifierForDelete = uploadResult.name || uploadResult.uri;
      if (fileIdentifierForDelete) {
        await ai.files.delete({ name: fileIdentifierForDelete });
      }
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
