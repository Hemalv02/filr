import type { FormData } from "./formExtraction";
import type { ExtractedData } from "./gemini";
import type { DynamicExtractedData } from "./dynamicExtraction";

/**
 * Find input element by label text (for Angular/dynamic forms)
 */
function findInputByLabel(labelText: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  if (!labelText) return null;

  const normalizedLabel = labelText.toLowerCase().trim();

  // Find all labels
  const labels = document.querySelectorAll('label');

  for (const label of labels) {
    const labelContent = label.textContent?.toLowerCase().trim() || '';

    // Check if label matches (exact or contains)
    if (labelContent.includes(normalizedLabel) || normalizedLabel.includes(labelContent)) {
      // Find the associated input - try multiple strategies

      // Strategy 1: Look for input with matching 'for' attribute
      const forAttr = label.getAttribute('for');
      if (forAttr) {
        const input = document.getElementById(forAttr);
        if (input && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
          return input;
        }
      }

      // Strategy 2: Look in the same container (Angular pattern)
      const container = label.closest('.col-md-5, .col-md-3, .col-md-12, .vbeop-input, .vbeop-select, .vbeop-checkbox, [class*="form"], [class*="field"]');
      if (container) {
        // Try native inputs first
        const nativeInput = container.querySelector('input:not([type="hidden"]), textarea, select');
        if (nativeInput && (nativeInput instanceof HTMLInputElement || nativeInput instanceof HTMLTextAreaElement || nativeInput instanceof HTMLSelectElement)) {
          return nativeInput;
        }

        // For ng-select or custom components, find the underlying input
        const ngSelectInput = container.querySelector('ng-select input, .ng-select input');
        if (ngSelectInput && ngSelectInput instanceof HTMLInputElement) {
          return ngSelectInput;
        }
      }

      // Strategy 3: Next sibling or descendant
      let nextElement = label.nextElementSibling;
      while (nextElement) {
        if (nextElement instanceof HTMLInputElement || nextElement instanceof HTMLTextAreaElement || nextElement instanceof HTMLSelectElement) {
          return nextElement;
        }
        const input = nextElement.querySelector('input, textarea, select');
        if (input && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
          return input;
        }
        nextElement = nextElement.nextElementSibling;
      }
    }
  }

  return null;
}

/**
 * Find ng-select component by label
 */
function findNgSelectByLabel(labelText: string): Element | null {
  if (!labelText) return null;

  const normalizedLabel = labelText.toLowerCase().trim();
  const labels = document.querySelectorAll('label');

  for (const label of labels) {
    const labelContent = label.textContent?.toLowerCase().trim() || '';

    if (labelContent.includes(normalizedLabel) || normalizedLabel.includes(labelContent)) {
      const container = label.closest('.col-md-5, .col-md-3, .col-md-12, .vbeop-select, [class*="form"], [class*="field"]');
      if (container) {
        const ngSelect = container.querySelector('ng-select, .ng-select');
        if (ngSelect) {
          return ngSelect;
        }
      }
    }
  }

  return null;
}

/**
 * Find input element by various methods
 */
function findInputElement(fieldId: string, fieldName: string, fieldLabel: string = ''): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  // Try by ID first
  if (fieldId) {
    const byId = document.getElementById(fieldId);
    if (byId && (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement || byId instanceof HTMLSelectElement)) {
      return byId;
    }
  }

  // Try by name attribute
  if (fieldName) {
    const byName = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
    if (byName && (byName instanceof HTMLInputElement || byName instanceof HTMLTextAreaElement || byName instanceof HTMLSelectElement)) {
      return byName;
    }
  }

  // Try by ID as selector
  if (fieldId) {
    const bySelector = document.querySelector(`input[id="${fieldId}"], textarea[id="${fieldId}"], select[id="${fieldId}"]`);
    if (bySelector && (bySelector instanceof HTMLInputElement || bySelector instanceof HTMLTextAreaElement || bySelector instanceof HTMLSelectElement)) {
      return bySelector;
    }
  }

  // Try case-insensitive search
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

  // Try by label text (for Angular/dynamic forms)
  if (fieldLabel) {
    const byLabel = findInputByLabel(fieldLabel);
    if (byLabel) {
      return byLabel;
    }
  }

  return null;
}

/**
 * Set value to ng-select dropdown (Angular component)
 */
function setNgSelectValue(ngSelect: Element, value: string, fieldLabel: string): boolean {
  try {
    console.log(`  Attempting to fill ng-select: "${fieldLabel}" with value: "${value}"`);

    // Find the input inside ng-select
    const input = ngSelect.querySelector('input');
    if (!input) {
      console.error('  No input found inside ng-select');
      return false;
    }

    // Click to open the dropdown
    const container = ngSelect.querySelector('.ng-select-container');
    if (container) {
      (container as HTMLElement).click();
      console.log('  Clicked ng-select to open dropdown');
    }

    // Wait a bit for dropdown to open
    setTimeout(() => {
      // Type the value into the search input
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      console.log('  Typed value into ng-select search');

      // Wait for options to filter
      setTimeout(() => {
        // Find matching options
        const options = document.querySelectorAll('.ng-dropdown-panel .ng-option');
        console.log(`  Found ${options.length} options`);

        const normalizedValue = value.toLowerCase().trim();

        for (const option of options) {
          const optionText = option.textContent?.toLowerCase().trim() || '';
          console.log(`  Checking option: "${optionText}"`);

          if (optionText.includes(normalizedValue) || normalizedValue.includes(optionText)) {
            console.log(`  ✓ Matched option: "${optionText}"`);
            (option as HTMLElement).click();
            return;
          }
        }

        // If no exact match, try first option if available
        if (options.length > 0) {
          console.log('  Using first available option');
          (options[0] as HTMLElement).click();
        }
      }, 200);
    }, 200);

    return true;
  } catch (error) {
    console.error('  Error setting ng-select value:', error);
    return false;
  }
}

/**
 * Set value to vbeop-checkbox (custom checkbox component)
 */
function setCheckboxValue(label: string, checked: boolean): boolean {
  try {
    const labels = document.querySelectorAll('label');
    const normalizedLabel = label.toLowerCase().trim();

    for (const labelEl of labels) {
      const labelText = labelEl.textContent?.toLowerCase().trim() || '';

      if (labelText.includes(normalizedLabel)) {
        const checkbox = labelEl.previousElementSibling || labelEl.querySelector('input[type="checkbox"]');

        if (checkbox && checkbox instanceof HTMLInputElement && checkbox.type === 'checkbox') {
          if (checkbox.checked !== checked) {
            checkbox.checked = checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`  ✓ Set checkbox "${label}" to ${checked}`);
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error('  Error setting checkbox:', error);
    return false;
  }
}

/**
 * Convert date to DD/MM/YYYY format
 */
function formatDateForInput(value: string, fieldLabel: string): string {
  // Check if this is a date field
  const isDateField = fieldLabel.toLowerCase().includes('date') ||
                      fieldLabel.toLowerCase().includes('birth') ||
                      fieldLabel.toLowerCase().includes('তারিখ');

  if (!isDateField) return value;

  // Try to parse various date formats
  // Format: "28 JULY 2003" or "28 July 2003"
  const monthNamePattern = /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i;
  let match = value.match(monthNamePattern);

  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2].toLowerCase();
    const year = match[3];

    const monthMap: Record<string, string> = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };

    const month = monthMap[monthName];
    if (month) {
      return `${day}/${month}/${year}`;
    }
  }

  // Format: "28-07-2003" or "28.07.2003"
  const separatorPattern = /(\d{1,2})[-.](\d{1,2})[-.](\d{4})/;
  match = value.match(separatorPattern);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${day}/${month}/${year}`;
  }

  // Already in DD/MM/YYYY format
  const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  match = value.match(slashPattern);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${day}/${month}/${year}`;
  }

  // ISO format: "2003-07-28"
  const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  match = value.match(isoPattern);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // Return original if no pattern matches
  return value;
}

/**
 * Set value to input element with proper event triggering
 */
function setInputValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string, fieldLabel: string = ''): boolean {
  try {
    // Format date if needed
    const formattedValue = formatDateForInput(value, fieldLabel);

    // Store original value
    const originalValue = element.value;

    // Set the value
    element.value = formattedValue;

    // Trigger events to ensure the framework detects the change
    const events = [
      new Event('input', { bubbles: true, cancelable: true }),
      new Event('change', { bubbles: true, cancelable: true }),
      new Event('blur', { bubbles: true, cancelable: true }),
    ];

    events.forEach(event => element.dispatchEvent(event));

    // For React/Vue/Angular compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter && element instanceof HTMLInputElement) {
      nativeInputValueSetter.call(element, formattedValue);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    console.log(`✓ Filled field: ${element.id || element.name} = "${formattedValue}"`);
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

    console.log(`\n--- Processing field: ${fieldLabel} ---`);
    console.log(`  ID: "${fieldId}"`);
    console.log(`  Name: "${fieldName}"`);
    console.log(`  Label: "${fieldLabel}"`);

    // Try to find ng-select first (for dropdowns)
    let ngSelect = findNgSelectByLabel(fieldLabel);

    // Find the input element (fallback for regular inputs)
    const element = findInputElement(fieldId, fieldName, fieldLabel);

    if (!element && !ngSelect) {
      const msg = `⚠️ Field not found in DOM: ${fieldLabel} (ID: ${fieldId}, Name: ${fieldName})`;
      console.warn(msg);
      details.push(msg);
      failed++;
      continue;
    }

    if (element) {
      console.log(`  ✓ Element found:`, element);
    }
    if (ngSelect) {
      console.log(`  ✓ ng-select found for: ${fieldLabel}`);
    }

    // Try to find matching value in extracted data
    let value: string | null = null;
    let matchMethod = '';

    // For dynamic extraction, try direct match first (field names should match exactly)
    const extractedDataAny = extractedData as any;

    // Try by field name
    if (fieldName && extractedDataAny[fieldName]) {
      value = String(extractedDataAny[fieldName]);
      matchMethod = 'exact-name';
      console.log(`  ✓ Direct match by name: "${fieldName}" = "${value}"`);
    }
    // Try by field ID
    else if (fieldId && extractedDataAny[fieldId]) {
      value = String(extractedDataAny[fieldId]);
      matchMethod = 'exact-id';
      console.log(`  ✓ Direct match by ID: "${fieldId}" = "${value}"`);
    }
    // Try by label-based key (for dynamic forms with empty IDs/names)
    else {
      const labelKey = fieldLabel
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '_')
        .trim();

      if (labelKey && extractedDataAny[labelKey]) {
        value = String(extractedDataAny[labelKey]);
        matchMethod = 'label-key';
        console.log(`  ✓ Direct match by label key: "${labelKey}" = "${value}"`);
      }
    }

    // For static ExtractedData, try with type assertion
    if (!value && 'name_english' in extractedData) {
      // This is static ExtractedData, try known fields
      if (fieldName && extractedData[fieldName as keyof ExtractedData]) {
        value = String(extractedData[fieldName as keyof ExtractedData]);
        matchMethod = 'static-name';
      } else if (fieldId && extractedData[fieldId as keyof ExtractedData]) {
        value = String(extractedData[fieldId as keyof ExtractedData]);
        matchMethod = 'static-id';
      }
    }

    // If still no match, try fuzzy matching
    if (!value) {
      const normalizedFieldName = fieldName ? fieldName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const normalizedFieldId = fieldId ? fieldId.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const normalizedFieldLabel = fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '');

      console.log(`  Trying fuzzy match...`);
      console.log(`    Normalized name: "${normalizedFieldName}"`);
      console.log(`    Normalized ID: "${normalizedFieldId}"`);
      console.log(`    Normalized label: "${normalizedFieldLabel}"`);

      for (const [key, val] of Object.entries(extractedData)) {
        if (!val) continue; // Skip empty values

        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedKey === normalizedFieldName ||
            normalizedKey === normalizedFieldId ||
            normalizedKey === normalizedFieldLabel) {
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
      let success = false;

      // Special handling for checkbox fields
      if (fieldLabel.toLowerCase().includes('i apply for myself') ||
          fieldLabel.toLowerCase().includes('checkbox')) {
        const isChecked = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value === '1';
        success = setCheckboxValue(fieldLabel, isChecked);
      }
      // Try ng-select if found
      else if (ngSelect) {
        success = setNgSelectValue(ngSelect, value, fieldLabel);
      }
      // Regular input
      else if (element) {
        success = setInputValue(element, value, fieldLabel);
      }

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
      func: (formDataArg: any, extractedDataArg: any) => {
        // Helper functions defined inline
        function findInputByLabel(labelText: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
          if (!labelText) return null;
          const normalizedLabel = labelText.toLowerCase().trim();
          const labels = document.querySelectorAll('label');

          for (const label of labels) {
            const labelContent = label.textContent?.toLowerCase().trim() || '';
            if (labelContent.includes(normalizedLabel) || normalizedLabel.includes(labelContent)) {
              const forAttr = label.getAttribute('for');
              if (forAttr) {
                const input = document.getElementById(forAttr);
                if (input && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
                  return input;
                }
              }

              const container = label.closest('.col-md-5, .col-md-3, .col-md-12, .vbeop-input, .vbeop-select, .vbeop-checkbox, [class*="form"], [class*="field"]');
              if (container) {
                const nativeInput = container.querySelector('input:not([type="hidden"]), textarea, select');
                if (nativeInput && (nativeInput instanceof HTMLInputElement || nativeInput instanceof HTMLTextAreaElement || nativeInput instanceof HTMLSelectElement)) {
                  return nativeInput;
                }
                const ngSelectInput = container.querySelector('ng-select input, .ng-select input');
                if (ngSelectInput && ngSelectInput instanceof HTMLInputElement) {
                  return ngSelectInput;
                }
              }

              let nextElement = label.nextElementSibling;
              while (nextElement) {
                if (nextElement instanceof HTMLInputElement || nextElement instanceof HTMLTextAreaElement || nextElement instanceof HTMLSelectElement) {
                  return nextElement;
                }
                const input = nextElement.querySelector('input, textarea, select');
                if (input && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
                  return input;
                }
                nextElement = nextElement.nextElementSibling;
              }
            }
          }
          return null;
        }

        function findNgSelectByLabel(labelText: string): Element | null {
          if (!labelText) return null;
          const normalizedLabel = labelText.toLowerCase().trim();
          const labels = document.querySelectorAll('label');

          for (const label of labels) {
            const labelContent = label.textContent?.toLowerCase().trim() || '';
            if (labelContent.includes(normalizedLabel) || normalizedLabel.includes(labelContent)) {
              const container = label.closest('.col-md-5, .col-md-3, .col-md-12, .vbeop-select, [class*="form"], [class*="field"]');
              if (container) {
                const ngSelect = container.querySelector('ng-select, .ng-select');
                if (ngSelect) return ngSelect;
              }
            }
          }
          return null;
        }

        function findInputElement(fieldId: string, fieldName: string, fieldLabel: string = ''): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
          if (fieldId) {
            const byId = document.getElementById(fieldId);
            if (byId && (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement || byId instanceof HTMLSelectElement)) {
              return byId;
            }
          }

          if (fieldName) {
            const byName = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
            if (byName && (byName instanceof HTMLInputElement || byName instanceof HTMLTextAreaElement || byName instanceof HTMLSelectElement)) {
              return byName;
            }
          }

          if (fieldId) {
            const bySelector = document.querySelector(`input[id="${fieldId}"], textarea[id="${fieldId}"], select[id="${fieldId}"]`);
            if (bySelector && (bySelector instanceof HTMLInputElement || bySelector instanceof HTMLTextAreaElement || bySelector instanceof HTMLSelectElement)) {
              return bySelector;
            }
          }

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

          if (fieldLabel) {
            const byLabel = findInputByLabel(fieldLabel);
            if (byLabel) return byLabel;
          }

          return null;
        }

        function setNgSelectValue(ngSelect: Element, value: string, fieldLabel: string): boolean {
          try {
            console.log(`  Attempting to fill ng-select: "${fieldLabel}" with value: "${value}"`);
            const input = ngSelect.querySelector('input');
            if (!input) {
              console.error('  No input found inside ng-select');
              return false;
            }

            const container = ngSelect.querySelector('.ng-select-container');
            if (container) {
              (container as HTMLElement).click();
              console.log('  Clicked ng-select to open dropdown');
            }

            setTimeout(() => {
              input.value = value;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('  Typed value into ng-select search');

              setTimeout(() => {
                const options = document.querySelectorAll('.ng-dropdown-panel .ng-option');
                console.log(`  Found ${options.length} options`);
                const normalizedValue = value.toLowerCase().trim();

                for (const option of options) {
                  const optionText = option.textContent?.toLowerCase().trim() || '';
                  console.log(`  Checking option: "${optionText}"`);

                  if (optionText.includes(normalizedValue) || normalizedValue.includes(optionText)) {
                    console.log(`  ✓ Matched option: "${optionText}"`);
                    (option as HTMLElement).click();
                    return;
                  }
                }

                if (options.length > 0) {
                  console.log('  Using first available option');
                  (options[0] as HTMLElement).click();
                }
              }, 200);
            }, 200);

            return true;
          } catch (error) {
            console.error('  Error setting ng-select value:', error);
            return false;
          }
        }

        function setCheckboxValue(label: string, checked: boolean): boolean {
          try {
            const labels = document.querySelectorAll('label');
            const normalizedLabel = label.toLowerCase().trim();

            for (const labelEl of labels) {
              const labelText = labelEl.textContent?.toLowerCase().trim() || '';
              if (labelText.includes(normalizedLabel)) {
                const checkbox = labelEl.previousElementSibling || labelEl.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox instanceof HTMLInputElement && checkbox.type === 'checkbox') {
                  if (checkbox.checked !== checked) {
                    checkbox.checked = checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`  ✓ Set checkbox "${label}" to ${checked}`);
                    return true;
                  }
                }
              }
            }
            return false;
          } catch (error) {
            console.error('  Error setting checkbox:', error);
            return false;
          }
        }

        function formatDateForInput(value: string, fieldLabel: string): string {
          const isDateField = fieldLabel.toLowerCase().includes('date') ||
                              fieldLabel.toLowerCase().includes('birth') ||
                              fieldLabel.toLowerCase().includes('তারিখ');

          if (!isDateField) return value;

          const monthNamePattern = /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i;
          let match = value.match(monthNamePattern);

          if (match) {
            const day = match[1].padStart(2, '0');
            const monthName = match[2].toLowerCase();
            const year = match[3];

            const monthMap: Record<string, string> = {
              'january': '01', 'february': '02', 'march': '03', 'april': '04',
              'may': '05', 'june': '06', 'july': '07', 'august': '08',
              'september': '09', 'october': '10', 'november': '11', 'december': '12'
            };

            const month = monthMap[monthName];
            if (month) {
              return `${day}/${month}/${year}`;
            }
          }

          const separatorPattern = /(\d{1,2})[-.](\d{1,2})[-.](\d{4})/;
          match = value.match(separatorPattern);
          if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            return `${day}/${month}/${year}`;
          }

          const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
          match = value.match(slashPattern);
          if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            return `${day}/${month}/${year}`;
          }

          const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
          match = value.match(isoPattern);
          if (match) {
            const year = match[1];
            const month = match[2].padStart(2, '0');
            const day = match[3].padStart(2, '0');
            return `${day}/${month}/${year}`;
          }

          return value;
        }

        function setInputValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string, fieldLabel: string = ''): boolean {
          try {
            // Format date if needed
            const formattedValue = formatDateForInput(value, fieldLabel);

            // Special handling for select dropdowns
            if (element instanceof HTMLSelectElement) {
              const normalizedValue = formattedValue.toLowerCase().trim();
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
              element.value = formattedValue;

              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              )?.set;

              if (nativeInputValueSetter && element instanceof HTMLInputElement) {
                nativeInputValueSetter.call(element, formattedValue);
              }

              const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value'
              )?.set;

              if (nativeTextAreaValueSetter && element instanceof HTMLTextAreaElement) {
                nativeTextAreaValueSetter.call(element, formattedValue);
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

          console.log(`\n--- Processing field: ${fieldLabel} ---`);
          console.log(`  ID: "${fieldId}"`);
          console.log(`  Name: "${fieldName}"`);
          console.log(`  Label: "${fieldLabel}"`);

          const ngSelect = findNgSelectByLabel(fieldLabel);
          const element = findInputElement(fieldId, fieldName, fieldLabel);

          if (!element && !ngSelect) {
            const msg = `⚠️ Field not found in DOM: ${fieldLabel} (ID: ${fieldId}, Name: ${fieldName})`;
            console.warn(msg);
            details.push(msg);
            failed++;
            continue;
          }

          if (element) {
            console.log(`  ✓ Element found:`, element);
          }
          if (ngSelect) {
            console.log(`  ✓ ng-select found for: ${fieldLabel}`);
          }

          let value: string | null = null;
          let matchMethod = '';

          // Try by field name
          if (fieldName && extractedDataArg[fieldName]) {
            value = String(extractedDataArg[fieldName]);
            matchMethod = 'exact-name';
          }
          // Try by field ID
          else if (fieldId && extractedDataArg[fieldId]) {
            value = String(extractedDataArg[fieldId]);
            matchMethod = 'exact-id';
          }
          // Try by label-based key (for dynamic forms with empty IDs/names)
          else {
            const labelKey = fieldLabel
              .toLowerCase()
              .replace(/[^\w\s]/g, '')
              .replace(/\s+/g, '_')
              .trim();

            if (labelKey && extractedDataArg[labelKey]) {
              value = String(extractedDataArg[labelKey]);
              matchMethod = 'label-key';
              console.log(`  ✓ Direct match by label key: "${labelKey}" = "${value}"`);
            }
          }

          // If still no match, try fuzzy matching
          if (!value) {
            const normalizedFieldName = fieldName ? fieldName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            const normalizedFieldId = fieldId ? fieldId.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            const normalizedFieldLabel = fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '');

            console.log(`  Trying fuzzy match...`);
            console.log(`    Normalized name: "${normalizedFieldName}"`);
            console.log(`    Normalized ID: "${normalizedFieldId}"`);
            console.log(`    Normalized label: "${normalizedFieldLabel}"`);

            for (const [key, val] of Object.entries(extractedDataArg)) {
              if (!val) continue;
              const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normalizedKey === normalizedFieldName ||
                  normalizedKey === normalizedFieldId ||
                  normalizedKey === normalizedFieldLabel) {
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
            let success = false;

            if (fieldLabel.toLowerCase().includes('i apply for myself') ||
                fieldLabel.toLowerCase().includes('checkbox')) {
              const isChecked = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value === '1';
              success = setCheckboxValue(fieldLabel, isChecked);
            } else if (ngSelect) {
              success = setNgSelectValue(ngSelect, value, fieldLabel);
            } else if (element) {
              success = setInputValue(element, value, fieldLabel);
            }

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
