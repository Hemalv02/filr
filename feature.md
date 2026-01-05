 Implementation Plan: Display All Extracted Information in Resume Session Dialog

 Goal

 When users see the "Resume Previous Session?" prompt, display all extracted information from the previous form
 detection session, including form fields and document mappings.

 Current Behavior

 The resume dialog shows minimal information:
 - Cache timestamp
 - Form field count (number)
 - Document count (number)

 Desired Behavior

 Display comprehensive session information:
 - Form type (English and Bangla)
 - Complete list of all detected form fields
 - Complete list of required documents with:
   - Document names (English and Bangla)
   - Field mappings (which fields each document can fill)
   - Necessity badges (required/optional/conditional)
   - Notes/descriptions

 Implementation Steps

 Step 1: Enhance Data Layer

 File: /home/shyan/Desktop/Code/filr/src/lib/FormCache.ts

 Modify getCacheInfo() function (lines 158-181) to return complete form and document data instead of just
 counts:

 export async function getCacheInfo(): Promise<{
   exists: boolean;
   isCurrent: boolean;
   url?: string;
   cachedAt?: Date;
   formData?: FormData;           // ADD: Full form data
   sourceDocuments?: SourceDocumentList;  // ADD: Full document data
 } | null>

 Changes:
 - Line 178: Replace formFieldCount: cached.formData.fields?.length || 0 with formData: cached.formData
 - Line 179: Replace documentCount: cached.sourceDocuments.source_documents?.length || 0 with sourceDocuments: 
 cached.sourceDocuments

 Step 2: Create Helper Utilities

 File: /home/shyan/Desktop/Code/filr/src/lib/cacheHelpers.ts (NEW FILE)

 Create utility functions to format extracted data for display:

 import type { InputField, SourceDocument } from './formExtraction';

 /**
  * Convert field IDs to readable labels
  * Maps fields_provided array to human-readable field names
  */
 export function formatFieldMappings(
   fieldsProvided: string[],
   allFields: InputField[]
 ): string[] {
   return fieldsProvided.map(fieldId => {
     const field = allFields.find(f =>
       f.input_field_id === fieldId ||
       f.input_field_name === fieldId
     );
     return field?.label || fieldId;
   });
 }

 /**
  * Get badge variant for necessity level
  */
 export function getNecessityBadgeVariant(necessity: string): string {
   switch (necessity.toLowerCase()) {
     case 'required': return 'destructive';
     case 'optional': return 'secondary';
     case 'conditional': return 'outline';
     default: return 'default';
   }
 }

 Step 3: Create Reusable UI Components

 Component 1: CollapsibleSection

 File: /home/shyan/Desktop/Code/filr/src/components/cache/CollapsibleSection.tsx (NEW FILE)

 Reusable expandable section using HTML <details> element:

 interface CollapsibleSectionProps {
   title: string;
   count: number;
   defaultOpen?: boolean;
   children: React.ReactNode;
 }

 export function CollapsibleSection({
   title,
   count,
   defaultOpen = false,
   children
 }: CollapsibleSectionProps) {
   return (
     <details open={defaultOpen} className="group">
       <summary className="cursor-pointer list-none">
         <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
           <span className="font-medium text-sm">{title} ({count})</span>
           <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
         </div>
       </summary>
       <div className="mt-2 pl-2">
         {children}
       </div>
     </details>
   );
 }

 Component 2: DocumentCard

 File: /home/shyan/Desktop/Code/filr/src/components/cache/DocumentCard.tsx (NEW FILE)

 Display individual document with all details:

 import { Badge } from "@/components/ui/badge";
 import { FileText } from "lucide-react";
 import type { SourceDocument, InputField } from "@/lib/formExtraction";
 import { formatFieldMappings, getNecessityBadgeVariant } from "@/lib/cacheHelpers";

 interface DocumentCardProps {
   document: SourceDocument;
   formFields: InputField[];
 }

 export function DocumentCard({ document, formFields }: DocumentCardProps) {
   const fieldLabels = formatFieldMappings(document.fields_provided, formFields);

   return (
     <div className="border rounded-lg p-3 space-y-2">
       <div className="flex items-start justify-between gap-2">
         <div className="flex items-start gap-2">
           <FileText className="w-4 h-4 mt-0.5 text-muted-foreground" />
           <div>
             <div className="font-medium text-sm">{document.document_name_english}</div>
             <div className="text-xs text-muted-foreground">{document.document_name_bangla}</div>
           </div>
         </div>
         <Badge variant={getNecessityBadgeVariant(document.necessity)}>
           {document.necessity}
         </Badge>
       </div>

       {fieldLabels.length > 0 && (
         <div className="text-xs">
           <span className="text-muted-foreground">Fills: </span>
           <span>{fieldLabels.join(', ')}</span>
         </div>
       )}

       {document.notes && (
         <div className="text-xs text-muted-foreground italic">
           {document.notes}
         </div>
       )}
     </div>
   );
 }

 Component 3: FormFieldsList

 File: /home/shyan/Desktop/Code/filr/src/components/cache/FormFieldsList.tsx (NEW FILE)

 Display all form fields in a compact format:

 import type { InputField } from "@/lib/formExtraction";

 interface FormFieldsListProps {
   fields: InputField[];
 }

 export function FormFieldsList({ fields }: FormFieldsListProps) {
   return (
     <div className="max-h-48 overflow-y-auto space-y-1.5">
       {fields.map((field, idx) => (
         <div key={idx} className="text-sm border-b pb-1.5 last:border-0">
           <div className="font-medium">{field.label}</div>
           <div className="text-xs text-muted-foreground">
             ID: {field.input_field_id} | Name: {field.input_field_name}
           </div>
         </div>
       ))}
     </div>
   );
 }

 Step 4: Update Resume Dialog UI

 File: /home/shyan/Desktop/Code/filr/src/FormDetectionPage.tsx

 Import additions (add to line 4):
 import { ChevronDown } from "lucide-react";
 import { CollapsibleSection } from "@/components/cache/CollapsibleSection";
 import { DocumentCard } from "@/components/cache/DocumentCard";
 import { FormFieldsList } from "@/components/cache/FormFieldsList";

 Replace CardContent (lines 175-184) with enhanced layout:

 <CardContent className="space-y-3">
   {/* Form Overview */}
   <div className="space-y-2">
     <div className="text-sm space-y-1">
       <div className="flex justify-between">
         <span className="text-muted-foreground">Form Type:</span>
         <span className="font-medium text-right">
           {cacheInfo.sourceDocuments?.form_type_english}
         </span>
       </div>
       <div className="text-xs text-muted-foreground text-right">
         {cacheInfo.sourceDocuments?.form_type_bangla}
       </div>
     </div>
   </div>

   <Separator />

   {/* Form Fields - Collapsible (Default: Closed) */}
   {cacheInfo.formData?.fields && (
     <CollapsibleSection
       title="Form Fields"
       count={cacheInfo.formData.fields.length}
       defaultOpen={false}
     >
       <FormFieldsList fields={cacheInfo.formData.fields} />
     </CollapsibleSection>
   )}

   <Separator />

   {/* Required Documents - Collapsible (Default: Open) */}
   {cacheInfo.sourceDocuments?.source_documents && (
     <CollapsibleSection
       title="Required Documents"
       count={cacheInfo.sourceDocuments.source_documents.length}
       defaultOpen={true}
     >
       <div className="space-y-2 max-h-64 overflow-y-auto">
         {cacheInfo.sourceDocuments.source_documents.map((doc) => (
           <DocumentCard
             key={doc.file_id}
             document={doc}
             formFields={cacheInfo.formData?.fields || []}
           />
         ))}
       </div>
     </CollapsibleSection>
   )}
 </CardContent>

 Import Separator (add to line 2):
 import { Separator } from "@/components/ui/separator";

 File Structure

 src/
 ├── lib/
 │   ├── FormCache.ts               [MODIFY] - Enhance getCacheInfo()
 │   ├── cacheHelpers.ts            [CREATE]  - Format utilities
 │   └── formExtraction.ts          [NO CHANGE]
 ├── components/
 │   ├── cache/
 │   │   ├── CollapsibleSection.tsx [CREATE]  - Expandable sections
 │   │   ├── DocumentCard.tsx       [CREATE]  - Document display
 │   │   └── FormFieldsList.tsx     [CREATE]  - Fields list
 │   └── ui/
 │       └── separator.tsx          [CHECK]   - May need to create
 └── FormDetectionPage.tsx          [MODIFY] - Update dialog UI

 Key Design Decisions

 1. Collapsible Sections: Documents open by default (most important), fields closed (secondary info)
 2. Field Mappings: Convert field IDs to readable labels using helper function
 3. Scrollable Areas: Max height limits with overflow-y-auto for long lists
 4. Visual Hierarchy: Overview at top, details below with separators
 5. Native HTML: Use <details> element for accessibility and simplicity

 Testing Scenarios

 1. Normal Case: Form with 10 fields, 3 required documents with field mappings
 2. Many Fields: Form with 50+ fields (test scrolling)
 3. No Mappings: Document with empty fields_provided array
 4. Mixed Necessity: Documents with required/optional/conditional status
 5. Long Names: Documents/fields with very long names (test wrapping)

 Edge Cases Handled

 - Missing Bangla translations (show only English)
 - Empty fields_provided arrays (hide "Fills:" line)
 - Empty notes (hide notes section)
 - Field ID not found in formData (fallback to raw ID)

 Implementation Order

 1. Create helper utilities (cacheHelpers.ts)
 2. Create UI components (CollapsibleSection → FormFieldsList → DocumentCard)
 3. Enhance FormCache.getCacheInfo()
 4. Update FormDetectionPage dialog
5. Test with real cached data