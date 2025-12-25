import type { FormData } from "./formExtraction";
import type { ExtractedData } from "./gemini";
import type { DynamicExtractedData } from "./dynamicExtraction";

// Type declarations for accessibility tree
declare global {
  interface Window {
    __claudeElementMap?: Record<string, WeakRef<HTMLElement>>;
    __claudeRefCounter?: number;
  }
}

/**
 * Find input element using ref_id from accessibility tree
 * This is the most reliable method as it directly references the element
 */
function findInputElementByRefId(refId: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  // Check if __claudeElementMap exists
  if (!window.__claudeElementMap) {
    console.warn('__claudeElementMap not found - accessibility tree not initialized');
    return null;
  }

  // Get WeakRef from map
  const weakRef = window.__claudeElementMap[refId];
  if (!weakRef) {
    console.warn(`Ref ID ${refId} not found in element map`);
    return null;
  }

  // Dereference WeakRef to get element
  const element = weakRef.deref();
  if (!element) {
    console.warn(`Element for ref_id ${refId} was garbage collected or removed`);
    return null;
  }

  // Verify it's an input element
  if (element instanceof HTMLInputElement || 
      element instanceof HTMLTextAreaElement || 
      element instanceof HTMLSelectElement) {
    return element;
  }

  console.warn(`Element for ref_id ${refId} is not an input element`);
  return null;
}

/**
 * Find input element by various methods
 * Priority: ref_id > fieldId > fieldName > case-insensitive search
 */
function findInputElement(
  fieldId: string, 
  fieldName: string, 
  refId?: string
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  // PRIORITY 1: Try ref_id first (most reliable)
  if (refId) {
    const elementByRef = findInputElementByRefId(refId);
    if (elementByRef) {
      console.log(`  ✓ Found element via ref_id: ${refId}`);
      return elementByRef;
    }
    console.log(`  ⚠️ ref_id ${refId} failed, falling back to ID/name lookup`);
  }

  // PRIORITY 2: Try by ID
  if (fieldId) {
    const byId = document.getElementById(fieldId);
    if (byId && (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement || byId instanceof HTMLSelectElement)) {
      return byId;
    }
  }

  // PRIORITY 3: Try by name attribute
  if (fieldName) {
    const byName = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
    if (byName && (byName instanceof HTMLInputElement || byName instanceof HTMLTextAreaElement || byName instanceof HTMLSelectElement)) {
      return byName;
    }
  }

  // PRIORITY 4: Try by ID as selector
  if (fieldId) {
    const bySelector = document.querySelector(`input[id="${fieldId}"], textarea[id="${fieldId}"], select[id="${fieldId}"]`);
    if (bySelector && (bySelector instanceof HTMLInputElement || bySelector instanceof HTMLTextAreaElement || bySelector instanceof HTMLSelectElement)) {
      return bySelector;
    }
  }

  // PRIORITY 5: Try case-insensitive search
  if (fieldName) {
    const allInputs = document.querySelectorAll('input, textarea, select');
    for (const input of allInputs) {
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
        const name = input.getAttribute('name')?.toLowerCase();
        const id = input.getAttribute('id')?.toLowerCase();
        if (name === fieldName.toLowerCase() || id === fieldName.toLowerCase()) {
          return input;
        }
      }
    }
  }

  return null;
}

/**
 * Set value to input element with proper event triggering
 */
function setInputValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): boolean {
  try {
    // Store original value
    const originalValue = element.value;

    // Set the value
    element.value = value;

    // Trigger events to ensure the framework detects the change
    const events = [
      new Event('input', { bubbles: true, cancelable: true }),
      new Event('change', { bubbles: true, cancelable: true }),
      new Event('blur', { bubbles: true, cancelable: true }),
    ];

    events.forEach(event => element.dispatchEvent(event));

    // For React/Vue compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    console.log(`✓ Filled field: ${element.id || element.name} = "${value}"`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to fill field: ${element.id || element.name}`, error);
    return false;
  }
}

/**
 * Auto-fill form fields with extracted data (works with both static and dynamic extraction)
 */
export async function autoFillForm(
  formData: FormData,
  extractedData: ExtractedData | DynamicExtractedData
): Promise<{ filled: number; failed: number; details: string[] }> {
  const details: string[] = [];
  let filled = 0;
  let failed = 0;

  console.log('=== AUTO-FILL EXECUTION IN PAGE CONTEXT ===');
  console.log('Form Data:', formData);
  console.log('Extracted Data:', extractedData);
  console.log('Number of form inputs to fill:', formData.inputs.length);

  // Iterate through form fields and try to fill them
  for (const field of formData.inputs) {
    const fieldId = field.input_field_id;
    const fieldName = field.input_field_name;
    const fieldLabel = field.label;
    const refId = field.ref_id; // Get ref_id from field

    console.log(`\n--- Processing field: ${fieldLabel} ---`);
    console.log(`  ID: "${fieldId}"`);
    console.log(`  Name: "${fieldName}"`);
    console.log(`  Ref ID: "${refId || 'N/A'}"`);

    // Find the input element (ref_id takes priority)
    const element = findInputElement(fieldId, fieldName, refId);

    if (!element) {
      const refInfo = refId ? `, Ref ID: ${refId}` : '';
      const msg = `⚠️ Field not found in DOM: ${fieldLabel} (ID: ${fieldId}, Name: ${fieldName}${refInfo})`;
      console.warn(msg);
      details.push(msg);
      failed++;
      continue;
    }

    // Log which method was used to find the element
    let methodUsed = 'ID/name fallback';
    if (refId) {
      const elementByRef = findInputElementByRefId(refId);
      if (elementByRef && elementByRef === element) {
        methodUsed = 'ref_id';
      }
    }
    console.log(`  ✓ Element found via ${methodUsed}:`, element);

    // Try to find matching value in extracted data
    let value: string | null = null;
    let matchMethod = '';

    // For dynamic extraction, try direct match first (field names should match exactly)
    if (extractedData[fieldName]) {
      value = String(extractedData[fieldName]);
      matchMethod = 'exact-name';
      console.log(`  ✓ Direct match by name: "${fieldName}" = "${value}"`);
    }
    // Try by field ID
    else if (extractedData[fieldId]) {
      value = String(extractedData[fieldId]);
      matchMethod = 'exact-id';
      console.log(`  ✓ Direct match by ID: "${fieldId}" = "${value}"`);
    }
    // For static ExtractedData, try with type assertion
    else if ('name_english' in extractedData) {
      // This is static ExtractedData, try known fields
      if (extractedData[fieldName as keyof ExtractedData]) {
        value = String(extractedData[fieldName as keyof ExtractedData]);
        matchMethod = 'static-name';
      } else if (extractedData[fieldId as keyof ExtractedData]) {
        value = String(extractedData[fieldId as keyof ExtractedData]);
        matchMethod = 'static-id';
      }
    }

    // If still no match, try fuzzy matching
    if (!value) {
      const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedFieldId = fieldId.toLowerCase().replace(/[^a-z0-9]/g, '');

      console.log(`  Trying fuzzy match...`);
      console.log(`    Normalized name: "${normalizedFieldName}"`);
      console.log(`    Normalized ID: "${normalizedFieldId}"`);

      for (const [key, val] of Object.entries(extractedData)) {
        if (!val) continue; // Skip empty values

        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedKey === normalizedFieldName || normalizedKey === normalizedFieldId) {
          value = String(val);
          matchMethod = `fuzzy (matched "${key}")`;
          console.log(`    ✓ Fuzzy match found: ${key} = "${val}"`);
          break;
        }
      }
    }

    console.log(`  Match method: ${matchMethod || 'NONE'}`);
    console.log(`  Value to fill: "${value}"`);

    if (value && value !== '' && value !== 'undefined' && value !== 'null') {
      const success = setInputValue(element, value);
      if (success) {
        const msg = `✓ ${fieldLabel} [${fieldName}]: "${value}" (${matchMethod})`;
        console.log(`  ${msg}`);
        details.push(msg);
        filled++;
      } else {
        const msg = `✗ Failed to set ${fieldLabel} [${fieldName}]`;
        console.error(`  ${msg}`);
        details.push(msg);
        failed++;
      }
    } else {
      const msg = `⚠️ No data available for: ${fieldLabel} [${fieldName}]`;
      console.warn(`  ${msg}`);
      details.push(msg);
      failed++;
    }
  }

  console.log('\n=== AUTO-FILL SUMMARY ===');
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);
  console.log('Details:', details);

  return { filled, failed, details };
}

/**
 * Execute auto-fill in the current tab
 */
export async function executeAutoFill(
  formData: FormData,
  extractedData: ExtractedData | DynamicExtractedData
): Promise<{ filled: number; failed: number; details: string[] }> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("No active tab found");
    }

    console.log('Executing auto-fill in tab:', tab.id);
    console.log('Form data to send:', formData);
    console.log('Extracted data to send:', extractedData);

    // Execute auto-fill script in the page context
    // We need to pass the entire logic as a self-contained function
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: (formDataArg, extractedDataArg) => {
        // Helper function to find element by ref_id
        function findInputElementByRefId(refId: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
          // Check if __claudeElementMap exists
          if (!window.__claudeElementMap) {
            console.warn('__claudeElementMap not found - accessibility tree not initialized');
            return null;
          }

          // Get WeakRef from map
          const weakRef = window.__claudeElementMap[refId];
          if (!weakRef) {
            console.warn(`Ref ID ${refId} not found in element map`);
            return null;
          }

          // Dereference WeakRef to get element
          const element = weakRef.deref();
          if (!element) {
            console.warn(`Element for ref_id ${refId} was garbage collected or removed`);
            return null;
          }

          // Verify it's an input element
          if (element instanceof HTMLInputElement || 
              element instanceof HTMLTextAreaElement || 
              element instanceof HTMLSelectElement) {
            return element;
          }

          console.warn(`Element for ref_id ${refId} is not an input element`);
          return null;
        }

        // Helper function to find input element by various methods
        // Priority: ref_id > fieldId > fieldName > case-insensitive search
        function findInputElement(
          fieldId: string, 
          fieldName: string, 
          refId?: string
        ): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
          // PRIORITY 1: Try ref_id first (most reliable)
          if (refId) {
            const elementByRef = findInputElementByRefId(refId);
            if (elementByRef) {
              console.log(`  ✓ Found element via ref_id: ${refId}`);
              return elementByRef;
            }
            console.log(`  ⚠️ ref_id ${refId} failed, falling back to ID/name lookup`);
          }

          // PRIORITY 2: Try by ID
          if (fieldId) {
            const byId = document.getElementById(fieldId);
            if (byId && (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement || byId instanceof HTMLSelectElement)) {
              return byId;
            }
          }

          // PRIORITY 3: Try by name attribute
          if (fieldName) {
            const byName = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
            if (byName && (byName instanceof HTMLInputElement || byName instanceof HTMLTextAreaElement || byName instanceof HTMLSelectElement)) {
              return byName;
            }
          }

          // PRIORITY 4: Try by ID as selector
          if (fieldId) {
            const bySelector = document.querySelector(`input[id="${fieldId}"], textarea[id="${fieldId}"], select[id="${fieldId}"]`);
            if (bySelector && (bySelector instanceof HTMLInputElement || bySelector instanceof HTMLTextAreaElement || bySelector instanceof HTMLSelectElement)) {
              return bySelector;
            }
          }

          // PRIORITY 5: Try case-insensitive search
          if (fieldName) {
            const allInputs = document.querySelectorAll('input, textarea, select');
            for (const input of allInputs) {
              if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
                const name = input.getAttribute('name')?.toLowerCase();
                const id = input.getAttribute('id')?.toLowerCase();
                if (name === fieldName.toLowerCase() || id === fieldName.toLowerCase()) {
                  return input;
                }
              }
            }
          }

          return null;
        }

        function setInputValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): boolean {
          try {
            // Special handling for select dropdowns
            if (element instanceof HTMLSelectElement) {
              const normalizedValue = value.toLowerCase().trim();
              const options = Array.from(element.options);
              let optionFound = false;
              let selectedOption: HTMLOptionElement | null = null;

              // Method 1: Try exact value match (case-sensitive)
              selectedOption = options.find(opt => opt.value === value) || null;
              if (selectedOption) {
                element.value = selectedOption.value;
                optionFound = true;
              }

              // Method 2: Try case-insensitive value match
              if (!optionFound) {
                selectedOption = options.find(opt => opt.value.toLowerCase().trim() === normalizedValue) || null;
                if (selectedOption) {
                  element.value = selectedOption.value;
                  optionFound = true;
                }
              }

              // Method 3: Try exact text content match
              if (!optionFound) {
                selectedOption = options.find(opt => {
                  const text = (opt.textContent || opt.innerText || '').trim();
                  return text === value;
                }) || null;
                if (selectedOption) {
                  element.value = selectedOption.value;
                  optionFound = true;
                }
              }

              // Method 4: Try case-insensitive text content match
              if (!optionFound) {
                selectedOption = options.find(opt => {
                  const text = (opt.textContent || opt.innerText || '').toLowerCase().trim();
                  return text === normalizedValue;
                }) || null;
                if (selectedOption) {
                  element.value = selectedOption.value;
                  optionFound = true;
                }
              }

              // Method 5: Try partial match - value contains the search term
              if (!optionFound) {
                selectedOption = options.find(opt => {
                  const optValue = opt.value.toLowerCase().trim();
                  return optValue.includes(normalizedValue) && normalizedValue.length >= 3;
                }) || null;
                if (selectedOption) {
                  element.value = selectedOption.value;
                  optionFound = true;
                }
              }

              // Method 6: Try partial match - text contains the search term
              if (!optionFound) {
                selectedOption = options.find(opt => {
                  const text = (opt.textContent || opt.innerText || '').toLowerCase().trim();
                  return text.includes(normalizedValue) && normalizedValue.length >= 3;
                }) || null;
                if (selectedOption) {
                  element.value = selectedOption.value;
                  optionFound = true;
                }
              }

              // Method 7: Try reverse partial match - search term contains option text
              if (!optionFound) {
                selectedOption = options.find(opt => {
                  const text = (opt.textContent || opt.innerText || '').toLowerCase().trim();
                  return text.length >= 3 && normalizedValue.includes(text);
                }) || null;
                if (selectedOption) {
                  element.value = selectedOption.value;
                  optionFound = true;
                }
              }

              // Method 8: Common variations for specific field types
              if (!optionFound) {
                // Gender/Sex variations
                if (normalizedValue === 'male' || normalizedValue === 'পুরুষ' || normalizedValue === 'm') {
                  selectedOption = options.find(opt => {
                    const optValue = opt.value.toLowerCase();
                    const optText = (opt.textContent || '').toLowerCase();
                    return optValue.includes('male') || optText.includes('male') ||
                           optValue.includes('পুরুষ') || optText.includes('পুরুষ') ||
                           optValue === 'm' || optValue === '1';
                  }) || null;
                } else if (normalizedValue === 'female' || normalizedValue === 'মহিলা' || normalizedValue === 'f') {
                  selectedOption = options.find(opt => {
                    const optValue = opt.value.toLowerCase();
                    const optText = (opt.textContent || '').toLowerCase();
                    return optValue.includes('female') || optText.includes('female') ||
                           optValue.includes('মহিলা') || optText.includes('মহিলা') ||
                           optValue === 'f' || optValue === '2';
                  }) || null;
                }
                // Religion variations
                else if (normalizedValue === 'islam' || normalizedValue === 'ইসলাম') {
                  selectedOption = options.find(opt => {
                    const optValue = opt.value.toLowerCase();
                    const optText = (opt.textContent || '').toLowerCase();
                    return optValue.includes('islam') || optText.includes('islam') ||
                           optValue.includes('ইসলাম') || optText.includes('ইসলাম') ||
                           optValue === 'muslim' || optText.includes('muslim');
                  }) || null;
                }
                // Marital Status variations
                else if (normalizedValue === 'unmarried' || normalizedValue === 'single' || normalizedValue === 'অবিবাহিত') {
                  selectedOption = options.find(opt => {
                    const optValue = opt.value.toLowerCase();
                    const optText = (opt.textContent || '').toLowerCase();
                    return optValue.includes('unmarried') || optText.includes('unmarried') ||
                           optValue.includes('single') || optText.includes('single') ||
                           optValue.includes('অবিবাহিত') || optText.includes('অবিবাহিত');
                  }) || null;
                } else if (normalizedValue === 'married' || normalizedValue === 'বিবাহিত') {
                  selectedOption = options.find(opt => {
                    const optValue = opt.value.toLowerCase();
                    const optText = (opt.textContent || '').toLowerCase();
                    return optValue.includes('married') || optText.includes('married') ||
                           optValue.includes('বিবাহিত') || optText.includes('বিবাহিত');
                  }) || null;
                }

                if (selectedOption) {
                  element.value = selectedOption.value;
                  optionFound = true;
                }
              }

              if (!optionFound) {
                console.warn(`Could not find matching option for value: "${value}" in select:`, element);
                console.log('Available options:', options.map(o => ({ value: o.value, text: o.textContent })));
                return false;
              }
            } else {
              // Regular input/textarea
              element.value = value;

              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              )?.set;

              if (nativeInputValueSetter && element instanceof HTMLInputElement) {
                nativeInputValueSetter.call(element, value);
              }

              const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value'
              )?.set;

              if (nativeTextAreaValueSetter && element instanceof HTMLTextAreaElement) {
                nativeTextAreaValueSetter.call(element, value);
              }
            }

            // Trigger events for all element types
            const events = [
              new Event('input', { bubbles: true, cancelable: true }),
              new Event('change', { bubbles: true, cancelable: true }),
              new Event('blur', { bubbles: true, cancelable: true }),
            ];

            events.forEach(event => element.dispatchEvent(event));

            return true;
          } catch (error) {
            console.error('Error setting value:', error);
            return false;
          }
        }

        // Main auto-fill logic
        const details: string[] = [];
        let filled = 0;
        let failed = 0;

        console.log('=== AUTO-FILL EXECUTION IN PAGE CONTEXT ===');
        console.log('Form Data:', formDataArg);
        console.log('Extracted Data:', extractedDataArg);

        for (const field of formDataArg.inputs) {
          const fieldId = field.input_field_id;
          const fieldName = field.input_field_name;
          const fieldLabel = field.label;
          const refId = field.ref_id; // Get ref_id from field

          console.log(`\n--- Processing field: ${fieldLabel} ---`);
          console.log(`  ID: "${fieldId}"`);
          console.log(`  Name: "${fieldName}"`);
          console.log(`  Ref ID: "${refId || 'N/A'}"`);

          const element = findInputElement(fieldId, fieldName, refId);

          if (!element) {
            const refInfo = refId ? `, Ref ID: ${refId}` : '';
            const msg = `⚠️ Field not found in DOM: ${fieldLabel} (ID: ${fieldId}, Name: ${fieldName}${refInfo})`;
            console.warn(msg);
            details.push(msg);
            failed++;
            continue;
          }

          // Log which method was used to find the element
          let methodUsed = 'ID/name fallback';
          if (refId) {
            const elementByRef = findInputElementByRefId(refId);
            if (elementByRef && elementByRef === element) {
              methodUsed = 'ref_id';
            }
          }
          console.log(`  ✓ Element found via ${methodUsed}:`, element);

          let value: string | null = null;
          let matchMethod = '';

          if (extractedDataArg[fieldName]) {
            value = String(extractedDataArg[fieldName]);
            matchMethod = 'exact-name';
          } else if (extractedDataArg[fieldId]) {
            value = String(extractedDataArg[fieldId]);
            matchMethod = 'exact-id';
          } else {
            const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedFieldId = fieldId.toLowerCase().replace(/[^a-z0-9]/g, '');

            for (const [key, val] of Object.entries(extractedDataArg)) {
              if (!val) continue;
              const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normalizedKey === normalizedFieldName || normalizedKey === normalizedFieldId) {
                value = String(val);
                matchMethod = `fuzzy (matched "${key}")`;
                break;
              }
            }
          }

          if (value && value !== '' && value !== 'undefined' && value !== 'null') {
            const success = setInputValue(element, value);
            if (success) {
              const msg = `✓ ${fieldLabel} [${fieldName}]: "${value}" (${matchMethod})`;
              console.log(`  ${msg}`);
              details.push(msg);
              filled++;
            } else {
              const msg = `✗ Failed to set ${fieldLabel} [${fieldName}]`;
              console.error(`  ${msg}`);
              details.push(msg);
              failed++;
            }
          } else {
            const msg = `⚠️ No data available for: ${fieldLabel} [${fieldName}]`;
            console.warn(`  ${msg}`);
            details.push(msg);
            failed++;
          }
        }

        console.log('\n=== AUTO-FILL SUMMARY ===');
        console.log(`Filled: ${filled}`);
        console.log(`Failed: ${failed}`);

        return { filled, failed, details };
      },
      args: [formData, extractedData],
    });

    console.log('Script execution results:', results);

    if (!results || !results[0]) {
      throw new Error("Script execution returned no results");
    }

    if (!results[0].result) {
      throw new Error("Script execution returned no result data");
    }

    return results[0].result as { filled: number; failed: number; details: string[] };
  } catch (error) {
    console.error('Execute auto-fill error:', error);
    throw error;
  }
}
