# Complete Flow Documentation: Form Detection → AI Response → Form Filling

This document describes the complete flow of the Filr extension, from form detection through AI response generation to form filling.

## Table of Contents

1. [Form Detection Flow](#1-form-detection-flow)
2. [Document Upload & Processing Flow](#2-document-upload--processing-flow)
3. [AI Response Generation](#3-ai-response-generation)
4. [Form Filling Flow](#4-form-filling-flow)

---

## 1. Form Detection Flow

### 1.1 Entry Point

**File**: `src/FormDetectionPage.tsx`

**User Action**: User clicks "Detect Form" button on the home page

**Flow**:
1. User navigates to a government form page in their browser
2. Opens the Filr extension side panel
3. Clicks "Detect Form" button
4. Extension checks for API key (stored in `localStorage`)
5. If API key exists, navigates to form detection page

### 1.2 Form Field Extraction

**File**: `src/lib/formExtraction.ts` → `extractFormFields()`

**Process**:
1. Gets HTML source code from the current active tab using `getPageHTMLSource()`
2. Sends HTML to Gemini AI with a form detection prompt
3. AI analyzes the HTML and extracts form structure
4. Returns JSON with form name and input fields

**Prompt Sent to AI**:
```
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
[HTML_SOURCE_CODE]
```

**AI Response Example** (Demo Answer):
```json
{
  "form_name": "জাতীয় পরিচয়পত্র আবেদন ফর্ম / National ID Card Application Form",
  "inputs": [
    {
      "label": "নাম (বাংলায়) / Name (Bengali)",
      "input_field_id": "name_bengali",
      "input_field_name": "name_bengali"
    },
    {
      "label": "Name (English)",
      "input_field_id": "name_english",
      "input_field_name": "name_english"
    },
    {
      "label": "পিতার নাম / Father's Name",
      "input_field_id": "father_name",
      "input_field_name": "father_name"
    },
    {
      "label": "মাতার নাম / Mother's Name",
      "input_field_id": "mother_name",
      "input_field_name": "mother_name"
    },
    {
      "label": "জন্ম তারিখ / Date of Birth",
      "input_field_id": "birth_date",
      "input_field_name": "birth_date"
    },
    {
      "label": "জন্ম তারিখ - দিন / Day",
      "input_field_id": "d1",
      "input_field_name": "d1"
    },
    {
      "label": "জন্ম তারিখ - দিন / Day",
      "input_field_id": "d2",
      "input_field_name": "d2"
    },
    {
      "label": "জন্ম তারিখ - মাস / Month",
      "input_field_id": "m1",
      "input_field_name": "m1"
    },
    {
      "label": "জন্ম তারিখ - মাস / Month",
      "input_field_id": "m2",
      "input_field_name": "m2"
    },
    {
      "label": "জন্ম তারিখ - বছর / Year",
      "input_field_id": "y1",
      "input_field_name": "y1"
    },
    {
      "label": "জন্ম তারিখ - বছর / Year",
      "input_field_id": "y2",
      "input_field_name": "y2"
    },
    {
      "label": "জন্ম তারিখ - বছর / Year",
      "input_field_id": "y3",
      "input_field_name": "y3"
    },
    {
      "label": "জন্ম তারিখ - বছর / Year",
      "input_field_id": "y4",
      "input_field_name": "y4"
    },
    {
      "label": "স্থায়ী ঠিকানা / Permanent Address",
      "input_field_id": "permanent_address",
      "input_field_name": "permanent_address"
    },
    {
      "label": "বর্তমান ঠিকানা / Current Address",
      "input_field_id": "current_address",
      "input_field_name": "current_address"
    },
    {
      "label": "লিঙ্গ / Sex",
      "input_field_id": "sex",
      "input_field_name": "sex"
    }
  ]
}
```

### 1.3 Required Documents Detection

**File**: `src/lib/formExtraction.ts` → `detectRequiredDocuments()`

**Process**:
1. Takes the extracted form data from step 1.2
2. Analyzes form fields to determine which source documents are needed
3. Sends analysis request to Gemini AI
4. Returns list of required documents with metadata

**Prompt Sent to AI**:
```
You are analyzing a government form to identify which SOURCE DOCUMENTS a user needs to collect to fill it out.
Form Name: [FORM_NAME]

Given the following form fields (with both Bengali and English labels):
- [FIELD_LIST]

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
```

**AI Response Example** (Demo Answer):
```json
{
  "form_type_english": "National ID Card Application",
  "form_type_bangla": "জাতীয় পরিচয়পত্র আবেদন",
  "source_documents": [
    {
      "file_id": "birth_certificate",
      "document_name_english": "Birth Certificate",
      "document_name_bangla": "জন্ম নিবন্ধন সনদপত্র",
      "fields_provided": [
        "name_bengali",
        "name_english",
        "father_name",
        "mother_name",
        "birth_date",
        "d1",
        "d2",
        "m1",
        "m2",
        "y1",
        "y2",
        "y3",
        "y4",
        "sex",
        "permanent_address"
      ],
      "necessity": "required",
      "confidence": 0.95,
      "notes": "Primary document for identity verification. Contains name, date of birth, parent names, and address."
    },
    {
      "file_id": "utility_bill",
      "document_name_english": "Utility Bill / Rent Receipt",
      "document_name_bangla": "ইউটিলিটি বিল / ভাড়া রসিদ",
      "fields_provided": [
        "current_address"
      ],
      "necessity": "required",
      "confidence": 0.90,
      "notes": "Proof of current residence address. Must be recent (within 3 months)."
    },
    {
      "file_id": "father_nid",
      "document_name_english": "Father's National ID Card",
      "document_name_bangla": "পিতার জাতীয় পরিচয়পত্র",
      "fields_provided": [
        "father_name"
      ],
      "necessity": "optional",
      "confidence": 0.75,
      "notes": "Can help verify father's name if birth certificate is unclear."
    }
  ],
  "additional_notes": "Ensure all documents are clear and legible. Documents must be original or certified copies."
}
```

### 1.4 Caching

**File**: `src/lib/FormCache.ts`

After successful detection:
- Form data and source documents are cached in `localStorage`
- Cache includes timestamp and URL for validation
- User can resume previous session if form hasn't changed

---

## 2. Document Upload & Processing Flow

### 2.1 Entry Point

**File**: `src/UploadPage.tsx`

**User Action**: User uploads documents based on the detected requirements

**Flow**:
1. User sees list of required documents from form detection
2. User uploads files (PDF, JPG, PNG) for each document type
3. User clicks "Process Documents" button
4. Extension validates files and checks network status

### 2.2 Processing Modes

The system supports two processing modes:

#### Mode 1: Static Extraction (Legacy)

**File**: `src/lib/gemini.ts` → `processDocuments()`

**Use Case**: When no form detection data is available (backwards compatibility)

**Process**:
- Uses predefined schema for known document types
- Processes documents through Chain of Responsibility pattern
- Each document type has a dedicated processor

**Processors**:
- `BirthCertificateProcessor` - Processes birth certificates
- `NIDProcessor` - Processes National ID cards
- `PassportProcessor` - Processes passports
- `EducationCertificateProcessor` - Processes education certificates
- `UtilityBillProcessor` - Processes utility bills

#### Mode 2: Dynamic Extraction (Preferred)

**File**: `src/lib/dynamicExtraction.ts` → `processDynamicDocuments()`

**Use Case**: When form detection data is available

**Process**:
- Builds dynamic schema based on detected form fields
- Extracts only fields that match the form
- More flexible and form-specific

### 2.3 Processing Chain (Chain of Responsibility Pattern)

**File**: `src/lib/processors/ProcessorChain.ts`

**Flow**:
1. Files are validated for type and size
2. Processor chain is created based on file types
3. Each file passes through the chain:
   - File → Processor 1 → Processor 2 → ... → Final Result
4. Each processor checks if it can handle the file
5. If yes, processes it; if no, passes to next processor
6. Results are accumulated across all processors

**Example Chain**:
```
BirthCertificateProcessor → NIDProcessor → PassportProcessor → EducationCertificateProcessor → UtilityBillProcessor
```

---

## 3. AI Response Generation

### 3.1 Static Extraction - Birth Certificate Example

**File**: `src/lib/processors/BirthCertificateProcessor.ts`

**Prompt Sent to AI**:
```
Extract information from this Bangladesh Birth Certificate.

Focus on extracting:
- Full name in English and Bengali (নাম)
- Father's name in English and Bengali (পিতার নাম)
- Mother's name in English and Bengali (মাতার নাম)
- Date of birth in DD/MM/YYYY format
- Break down date into: birth_day (DD), birth_month (MM), birth_year (YYYY)
- Place of birth (জন্মস্থান)
- Birth registration number (জন্ম নিবন্ধন নম্বর)
- Sex/Gender (লিঙ্গ)
- Permanent address (স্থায়ী ঠিকানা)

For date of birth, if you find "15/06/1995":
- date_of_birth: "15/06/1995"
- birth_day: "15"
- birth_month: "06"
- birth_year: "1995"

Return empty strings for fields not found.
```

**Schema Provided**:
```json
{
  "type": "OBJECT",
  "properties": {
    "name_english": { "type": "STRING" },
    "name_bengali": { "type": "STRING" },
    "father_name_english": { "type": "STRING" },
    "father_name_bengali": { "type": "STRING" },
    "mother_name_english": { "type": "STRING" },
    "mother_name_bengali": { "type": "STRING" },
    "date_of_birth": { "type": "STRING" },
    "birth_day": { "type": "STRING" },
    "birth_month": { "type": "STRING" },
    "birth_year": { "type": "STRING" },
    "place_of_birth": { "type": "STRING" },
    "birth_registration_number": { "type": "STRING" },
    "sex": { "type": "STRING" },
    "permanent_address": { "type": "STRING" }
  }
}
```

**AI Response Example** (Demo Answer):
```json
{
  "name_english": "Mohammad Rahman",
  "name_bengali": "মোহাম্মদ রহমান",
  "father_name_english": "Abdul Karim",
  "father_name_bengali": "আব্দুল করিম",
  "mother_name_english": "Fatema Begum",
  "mother_name_bengali": "ফাতেমা বেগম",
  "date_of_birth": "15/06/1995",
  "birth_day": "15",
  "birth_month": "06",
  "birth_year": "1995",
  "place_of_birth": "Dhaka",
  "birth_registration_number": "1995-123456789",
  "sex": "Male",
  "permanent_address": "House No. 45, Road No. 12, Dhanmondi, Dhaka-1209"
}
```

### 3.2 Dynamic Extraction Example

**File**: `src/lib/dynamicExtraction.ts` → `processDynamicDocuments()`

**Scenario**: Form detection found fields: `name_bengali`, `father_name`, `birth_date`, `d1`, `d2`, `m1`, `m2`, `y1`, `y2`, `y3`, `y4`

**Dynamic Schema Generated**:
```json
{
  "type": "OBJECT",
  "properties": {
    "name_bengali": { "type": "STRING" },
    "father_name": { "type": "STRING" },
    "birth_date": { "type": "STRING" },
    "d1": { "type": "STRING" },
    "d2": { "type": "STRING" },
    "m1": { "type": "STRING" },
    "m2": { "type": "STRING" },
    "y1": { "type": "STRING" },
    "y2": { "type": "STRING" },
    "y3": { "type": "STRING" },
    "y4": { "type": "STRING" }
  }
}
```

**Prompt Sent to AI**:
```
You are an expert data extraction assistant for government forms.

FORM FIELDS TO EXTRACT:
1. "name_bengali": নাম (বাংলায়) / Name (Bengali)
2. "father_name": পিতার নাম / Father's Name
3. "birth_date": জন্ম তারিখ / Date of Birth
4. "d1": জন্ম তারিখ - দিন / Day
5. "d2": জন্ম তারিখ - দিন / Day
6. "m1": জন্ম তারিখ - মাস / Month
7. "m2": জন্ম তারিখ - মাস / Month
8. "y1": জন্ম তারিখ - বছর / Year
9. "y2": জন্ম তারিখ - বছর / Year
10. "y3": জন্ম তারিখ - বছর / Year
11. "y4": জন্ম তারিখ - বছর / Year

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
```

**AI Response Example** (Demo Answer):
```json
{
  "name_bengali": "মোহাম্মদ রহমান",
  "father_name": "আব্দুল করিম",
  "birth_date": "15/06/1995",
  "d1": "1",
  "d2": "5",
  "m1": "0",
  "m2": "6",
  "y1": "1",
  "y2": "9",
  "y3": "9",
  "y4": "5"
}
```

### 3.3 Response Merging

**Process**:
1. Each document is processed individually
2. Responses are merged into a single data object
3. Non-empty values take precedence
4. Empty values don't overwrite existing data

**Example Merging**:
```javascript
// Document 1 (Birth Certificate) Response:
{
  "name_bengali": "মোহাম্মদ রহমান",
  "father_name": "আব্দুল করিম",
  "birth_date": "15/06/1995"
}

// Document 2 (Utility Bill) Response:
{
  "current_address": "House No. 45, Road No. 12, Dhanmondi, Dhaka-1209"
}

// Final Merged Result:
{
  "name_bengali": "মোহাম্মদ রহমান",
  "father_name": "আব্দুল করিম",
  "birth_date": "15/06/1995",
  "current_address": "House No. 45, Road No. 12, Dhanmondi, Dhaka-1209"
}
```

---

## 4. Form Filling Flow

### 4.1 Entry Point

**File**: `src/ResultsPage.tsx`

**User Action**: User reviews extracted data and clicks "Auto-Fill Form" button

**Flow**:
1. User sees extracted data displayed in a review page
2. User can edit any field if needed
3. User clicks "Auto-Fill Form" button
4. Extension injects script into the page context
5. Script finds form fields and fills them with extracted data

### 4.2 Field Matching Strategy

**File**: `src/lib/formFiller.ts` → `autoFillForm()`

**Matching Priority**:
1. **Exact Name Match**: `extractedData[fieldName]` - Direct match by field name
2. **Exact ID Match**: `extractedData[fieldId]` - Direct match by field ID
3. **Fuzzy Match**: Normalized comparison (case-insensitive, special chars removed)

**Example Matching**:
```javascript
// Form Field:
{
  input_field_id: "name_bengali",
  input_field_name: "name_bengali",
  label: "নাম (বাংলায়)"
}

// Extracted Data:
{
  name_bengali: "মোহাম্মদ রহমান",
  name_english: "Mohammad Rahman"
}

// Match Result: ✓ Exact match by name → "মোহাম্মদ রহমান"
```

### 4.3 Field Finding Strategy

**File**: `src/lib/formFiller.ts` → `findInputElement()`

**Search Order**:
1. Try by ID: `document.getElementById(fieldId)`
2. Try by name attribute: `document.querySelector('input[name="..."]')`
3. Try by ID selector: `document.querySelector('input[id="..."]')`
4. Case-insensitive search through all inputs

### 4.4 Value Setting Strategy

**File**: `src/lib/formFiller.ts` → `setInputValue()`

**Process**:
1. Set element value directly: `element.value = value`
2. Trigger events for framework detection:
   - `input` event (bubbles, cancelable)
   - `change` event (bubbles, cancelable)
   - `blur` event (bubbles, cancelable)
3. For React/Vue compatibility: Use native value setter
4. Special handling for `<select>` dropdowns:
   - Try exact value match
   - Try case-insensitive value match
   - Try text content match
   - Try partial match
   - Handle common variations (gender, religion, marital status)

**Select Dropdown Example**:
```javascript
// Extracted Data:
{
  sex: "Male"
}

// Form Field (Select):
<select name="sex" id="sex">
  <option value="1">পুরুষ / Male</option>
  <option value="2">মহিলা / Female</option>
</select>

// Matching Process:
1. Try exact value match: "Male" === "1" ❌
2. Try case-insensitive: "male" === "1" ❌
3. Try text content match: "Male" in "পুরুষ / Male" ✓
4. Set value: element.value = "1"
```

### 4.5 Fill Result

**Return Value**:
```javascript
{
  filled: 12,  // Number of fields successfully filled
  failed: 3,  // Number of fields that couldn't be filled
  details: [  // Array of detailed messages
    "✓ নাম (বাংলায়) [name_bengali]: \"মোহাম্মদ রহমান\" (exact-name)",
    "✓ পিতার নাম [father_name]: \"আব্দুল করিম\" (exact-name)",
    "✓ জন্ম তারিখ [birth_date]: \"15/06/1995\" (exact-name)",
    "⚠️ No data available for: বর্তমান ঠিকানা [current_address]",
    "✗ Failed to set লিঙ্গ [sex]"
  ]
}
```

### 4.6 Complete Flow Example

**Scenario**: User has extracted data and wants to fill a form

**Step 1**: User clicks "Auto-Fill Form" button

**Step 2**: Script injected into page context
```javascript
// Script finds form fields
const formFields = [
  { id: "name_bengali", name: "name_bengali", label: "নাম (বাংলায়)" },
  { id: "father_name", name: "father_name", label: "পিতার নাম" },
  // ... more fields
];

// Extracted data
const extractedData = {
  name_bengali: "মোহাম্মদ রহমান",
  father_name: "আব্দুল করিম",
  birth_date: "15/06/1995",
  d1: "1", d2: "5",
  m1: "0", m2: "6",
  y1: "1", y2: "9", y3: "9", y4: "5"
};
```

**Step 3**: For each form field:
- Find element: `findInputElement("name_bengali", "name_bengali")`
- Match value: `extractedData["name_bengali"]` → "মোহাম্মদ রহমান"
- Set value: `element.value = "মোহাম্মদ রহমান"`
- Trigger events: `input`, `change`, `blur`

**Step 4**: Return results to user
- Show success message: "Successfully filled 12 field(s)!"
- Display detailed results in expandable section

---

## Summary

The complete flow can be summarized as:

1. **Form Detection**: Analyze HTML → Extract form fields → Determine required documents
2. **Document Upload**: User uploads documents → Validate files → Check network status
3. **AI Processing**: Upload to Gemini → Send extraction prompt → Receive JSON response → Merge results
4. **Form Filling**: Inject script → Find fields → Match data → Fill fields → Return statistics

Each stage includes detailed logging and error handling to ensure robust operation.

