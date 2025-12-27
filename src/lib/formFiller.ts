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
function findInputElementByRefId(refId: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement | Element | null {
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

  // Verify it's an input element, button, or ng-select
  if (element instanceof HTMLInputElement || 
      element instanceof HTMLTextAreaElement || 
      element instanceof HTMLSelectElement ||
      element instanceof HTMLButtonElement) {
    return element;
  }

  // Also accept ng-select custom elements
  if (element.tagName && element.tagName.toLowerCase() === 'ng-select') {
    return element;
  }

  console.warn(`Element for ref_id ${refId} is not an input element, button, or ng-select`);
  return null;
}

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
 * Priority: ref_id > fieldId > fieldName > label > case-insensitive search
 */
function findInputElement(fieldId: string, fieldName: string, fieldLabel: string = '', refId?: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement | Element | null {
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
    if (byId && (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement || byId instanceof HTMLSelectElement || byId instanceof HTMLButtonElement)) {
      return byId;
    }
  }

  // PRIORITY 3: Try by name attribute (including ng-select)
  if (fieldName) {
    const byName = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"], button[name="${fieldName}"], ng-select[formControlName="${fieldName}"]`);
    if (byName) {
      // ng-select is a custom element, return as-is
      if (byName.tagName.toLowerCase() === 'ng-select') {
      return byName;
      }
      if (byName instanceof HTMLInputElement || byName instanceof HTMLTextAreaElement || byName instanceof HTMLSelectElement || byName instanceof HTMLButtonElement) {
        return byName;
      }
    }
  }

  // PRIORITY 4: Try by ID as selector
  if (fieldId) {
    const bySelector = document.querySelector(`input[id="${fieldId}"], textarea[id="${fieldId}"], select[id="${fieldId}"], button[id="${fieldId}"]`);
    if (bySelector && (bySelector instanceof HTMLInputElement || bySelector instanceof HTMLTextAreaElement || bySelector instanceof HTMLSelectElement || bySelector instanceof HTMLButtonElement)) {
      return bySelector;
    }
  }

  // PRIORITY 5: Try case-insensitive search
  if (fieldName) {
    const allInputs = document.querySelectorAll('input, textarea, select, button');
    for (const input of allInputs) {
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement || input instanceof HTMLButtonElement) {
        const name = input.getAttribute('name')?.toLowerCase();
        const id = input.getAttribute('id')?.toLowerCase();
        if (name === fieldName.toLowerCase() || id === fieldName.toLowerCase()) {
          return input;
        }
      }
    }
  }

  // PRIORITY 6: Try by label text (for Angular/dynamic forms)
  if (fieldLabel) {
    const byLabel = findInputByLabel(fieldLabel);
    if (byLabel) {
      return byLabel;
    }
  }

  // PRIORITY 7: For button groups, try to find by label text
  if (fieldName) {
    const normalizedFieldName = fieldName.toLowerCase();
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const labelText = (label.textContent || label.innerText || '').toLowerCase();
      if (labelText.includes(normalizedFieldName) || normalizedFieldName.includes(labelText)) {
        const container = label.closest('.selectContainer, .form-group, .form-row') || label.parentElement;
        if (container) {
          const firstButton = container.querySelector('button[type="button"], button:not([type="submit"]):not([type="reset"])');
          if (firstButton instanceof HTMLButtonElement) {
            console.log(`  ✓ Found button group via label: ${labelText}`);
            return firstButton;
          }
        }
      }
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
 * Enhanced button finding and clicking with multiple strategies
 */
function findButtonsInContainer(element: HTMLButtonElement): HTMLButtonElement[] {
  const selectors = [
    // Primary containers
    '.selectContainer, .form-group, .form-row, .button-group, .radio_button_set',
    // Generic containers with button classes
    '[class*="button"], [class*="select"], [class*="choice"], [class*="option"]',
    // Bootstrap and common framework containers
    '.btn-group, .btn-toolbar, .form-check, .form-radio',
    // Custom containers
    '[role="group"], [role="radiogroup"], fieldset'
  ];

  for (const selector of selectors) {
    const container = element.closest(selector);
    if (container && container !== document.body) {
      const buttons = Array.from(container.querySelectorAll('button[type="button"], button:not([type="submit"]):not([type="reset"])'))
        .filter(btn => btn instanceof HTMLButtonElement) as HTMLButtonElement[];
      if (buttons.length > 1) return buttons; // Only return if there are multiple buttons (group)
    }
  }

  // Fallback: check parent element
  const parent = element.parentElement;
  if (parent) {
    const siblingButtons = Array.from(parent.querySelectorAll('button[type="button"], button:not([type="submit"]):not([type="reset"])'))
      .filter(btn => btn instanceof HTMLButtonElement) as HTMLButtonElement[];
    if (siblingButtons.length > 1) return siblingButtons;
  }

  return [element]; // Return just the single button if no group found
}

/**
 * Extract all possible text representations from a button
 */
function extractButtonTexts(btn: HTMLButtonElement): string[] {
  const texts: string[] = [];
  
  // Primary text sources
  const textContent = (btn.textContent || '').trim();
  const innerText = (btn.innerText || '').trim();
  const value = (btn.value || '').trim();
  const ariaLabel = (btn.getAttribute('aria-label') || '').trim();
  const title = (btn.getAttribute('title') || '').trim();
  const dataValue = (btn.getAttribute('data-value') || '').trim();
  
  // Add non-empty unique texts
  [textContent, innerText, value, ariaLabel, title, dataValue].forEach(text => {
    if (text && !texts.includes(text)) {
      texts.push(text);
    }
  });

  // Check nested elements for text
  const nestedElements = btn.querySelectorAll('span, div, i, .text, .label, [class*="text"], [class*="label"]');
  nestedElements.forEach(elem => {
    const elemText = (elem.textContent || '').trim();
    if (elemText && !texts.includes(elemText)) {
      texts.push(elemText);
    }
  });

  return texts;
}

/**
 * Advanced text matching with various strategies (prioritized)
 */
function matchButtonText(buttonTexts: string[], targetValue: string): boolean {
  const normalizedTarget = targetValue.toLowerCase().trim();
  
  // PRIORITY 1: Exact match (highest priority)
  for (const text of buttonTexts) {
    const normalizedText = text.toLowerCase().trim();
    if (normalizedText === normalizedTarget) return true;
  }
  
  // PRIORITY 2: Special keyword matching (prevents gender/yes-no confusion)
  for (const text of buttonTexts) {
    const normalizedText = text.toLowerCase().trim();
    if (matchSpecialKeywords(normalizedText, normalizedTarget)) return true;
  }
  
  // PRIORITY 3: Word boundary matches (prevents partial word confusion)
  for (const text of buttonTexts) {
    const normalizedText = text.toLowerCase().trim();
    // Check if target is a complete word in the button text
    const wordBoundaryRegex = new RegExp(`\\b${normalizedTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (wordBoundaryRegex.test(normalizedText)) return true;
  }
  
  // PRIORITY 4: Contains match (both directions, but be careful)
  for (const text of buttonTexts) {
    const normalizedText = text.toLowerCase().trim();
    
    // Only allow contains match if it's not a problematic case
    if (normalizedText.includes(normalizedTarget) || normalizedTarget.includes(normalizedText)) {
      // Prevent "male" matching "female" and similar issues
      if (isProblematicMatch(normalizedText, normalizedTarget)) {
        continue;
      }
      return true;
    }
  }
  
  // PRIORITY 5: Fuzzy matching for single words (lowest priority)
  for (const text of buttonTexts) {
    const normalizedText = text.toLowerCase().trim();
    if (normalizedTarget.length >= 3 && normalizedText.length >= 3) {
      if (fuzzyMatch(normalizedText, normalizedTarget)) return true;
    }
  }
  
  return false;
}

/**
 * Check if a match would be problematic (e.g., "male" matching "female")
 */
function isProblematicMatch(buttonText: string, targetValue: string): boolean {
  const problematicPairs = [
    ['male', 'female'], ['female', 'male'],
    ['yes', 'no'], ['no', 'yes'],
    ['true', 'false'], ['false', 'true'],
    ['accept', 'reject'], ['reject', 'accept'],
    ['agree', 'disagree'], ['disagree', 'agree']
  ];
  
  for (const [word1, word2] of problematicPairs) {
    if ((buttonText.includes(word1) && targetValue === word2) ||
        (buttonText.includes(word2) && targetValue === word1)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Handle special keyword mappings (YES/NO, True/False, Male/Female, etc.)
 */
function matchSpecialKeywords(buttonText: string, targetValue: string): boolean {
  const yesKeywords = ['yes', 'y', 'true', '1', 'ok', 'confirm', 'agree', 'accept'];
  const noKeywords = ['no', 'n', 'false', '0', 'cancel', 'deny', 'reject', 'decline'];
  
  // Gender-specific matching (most important for the current issue)
  const maleKeywords = ['male', 'm', 'পুরুষ', 'man'];
  const femaleKeywords = ['female', 'f', 'মহিলা', 'woman'];
  
  const isTargetYes = yesKeywords.includes(targetValue);
  const isTargetNo = noKeywords.includes(targetValue);
  const isTargetMale = maleKeywords.includes(targetValue);
  const isTargetFemale = femaleKeywords.includes(targetValue);
  
  const isButtonYes = yesKeywords.some(keyword => buttonText.includes(keyword));
  const isButtonNo = noKeywords.some(keyword => buttonText.includes(keyword));
  const isButtonMale = maleKeywords.some(keyword => buttonText.includes(keyword));
  const isButtonFemale = femaleKeywords.some(keyword => buttonText.includes(keyword));
  
  // Exact keyword category matching
  if (isTargetYes && isButtonYes) return true;
  if (isTargetNo && isButtonNo) return true;
  if (isTargetMale && isButtonMale && !isButtonFemale) return true; // Make sure it's not "female" 
  if (isTargetFemale && isButtonFemale && !isButtonMale) return true; // Make sure it's not "male"
  
  return false;
}

/**
 * Simple fuzzy matching for typos and variations
 */
function fuzzyMatch(text1: string, text2: string): boolean {
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(text1, text2);
  const maxLength = Math.max(text1.length, text2.length);
  const threshold = 0.8; // 80% similarity
  
  return (maxLength - distance) / maxLength >= threshold;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Trigger comprehensive click events for maximum compatibility
 */
function triggerButtonClick(button: HTMLButtonElement): void {
  // Focus the button first
  button.focus();
  
  // Get button coordinates for realistic mouse events
  const rect = button.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // Create mouse events with realistic coordinates
  const mouseEventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: centerX,
    clientY: centerY,
    button: 0,
  };
  
  // Full mouse interaction sequence
  button.dispatchEvent(new MouseEvent('mousedown', { ...mouseEventOptions, buttons: 1 }));
  
  // Small delay to simulate real interaction
  setTimeout(() => {
    button.dispatchEvent(new MouseEvent('mouseup', { ...mouseEventOptions, buttons: 0 }));
    button.dispatchEvent(new MouseEvent('click', { ...mouseEventOptions, buttons: 0 }));
    
    // Framework-specific events
    button.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    button.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    
    // Custom events that some frameworks listen for
    button.dispatchEvent(new CustomEvent('buttonClick', { bubbles: true, detail: { value: button.value || button.textContent } }));
  }, 10);
}

/**
 * Generalized button click - finds and clicks button by text content
 * Works with button groups (radio-style buttons, YES/NO buttons, etc.)
 */
function clickButtonByValue(element: HTMLButtonElement, value: string): boolean {
  try {
    const normalizedValue = value.toLowerCase().trim();
    console.log(`🔘 Starting button click search for value: "${value}"`);

    // Find all buttons in the group/container
    const buttons = findButtonsInContainer(element);
    console.log(`  📋 Found ${buttons.length} buttons to search through`);

    // Try to find matching button using advanced matching
    for (const button of buttons) {
      const buttonTexts = extractButtonTexts(button);
      console.log(`  🔍 Checking button with texts: [${buttonTexts.join(', ')}]`);

      if (matchButtonText(buttonTexts, normalizedValue)) {
        console.log(`  ✅ Match found! Triggering click on button`);
        
        // Use native click first
        button.click();
        
        // Then trigger comprehensive events for framework compatibility
        triggerButtonClick(button);
        
        console.log(`✅ Successfully clicked button with value: "${value}"`);
        return true;
      }
    }

    // Fallback: Search by data attributes or class names
    console.log(`  🔄 Trying fallback search by attributes...`);
    for (const button of buttons) {
      const datasets = Object.values(button.dataset);
      const classNames = button.className.toLowerCase();
      
      if (datasets.some(data => data.toLowerCase().includes(normalizedValue)) ||
          classNames.includes(normalizedValue)) {
        console.log(`  ✅ Fallback match found via attributes`);
        button.click();
        triggerButtonClick(button);
        return true;
      }
    }

    console.warn(`❌ No matching button found for value: "${value}"`);
    console.warn(`  Available buttons:`, buttons.map(btn => ({
      text: btn.textContent,
      value: btn.value,
      id: btn.id,
      className: btn.className
    })));
    return false;
  } catch (error) {
    console.error('❌ Error in clickButtonByValue:', error);
    return false;
  }
}

/**
 * Alternative button finder by text content across the entire document
 * Use this when element-based search fails
 */
function findButtonByTextGlobal(targetValue: string): HTMLButtonElement | null {
  const normalizedTarget = targetValue.toLowerCase().trim();
  const allButtons = document.querySelectorAll('button[type="button"], button:not([type="submit"]):not([type="reset"])');
  
  for (const button of allButtons) {
    if (!(button instanceof HTMLButtonElement)) continue;
    
    const texts = extractButtonTexts(button);
    if (matchButtonText(texts, normalizedTarget)) {
      return button;
    }
  }
  
  return null;
}

/**
 * Force click button using multiple DOM methods
 * Sometimes frameworks need specific event sequences
 */
function forceClickButton(button: HTMLButtonElement, value: string): boolean {
  try {
    console.log(`🔧 Force clicking button with multiple methods...`);
    
    // Method 1: Standard click
    button.click();
    
    // Method 2: Dispatch mouse events
    triggerButtonClick(button);
    
    // Method 3: Trigger form events
    const form = button.closest('form');
    if (form) {
      form.dispatchEvent(new Event('input', { bubbles: true }));
      form.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Method 4: Try triggering on parent container
    const container = button.closest('.form-group, .button-group, [class*="button"]');
    if (container) {
      container.dispatchEvent(new Event('click', { bubbles: true }));
    }
    
    // Method 5: Set data attributes that frameworks might listen to
    button.setAttribute('data-clicked', 'true');
    button.setAttribute('data-value-selected', value);
    
    console.log(`✅ Force click completed for button`);
    return true;
  } catch (error) {
    console.error(`❌ Force click failed:`, error);
    return false;
  }
}

/**
 * Enhanced button clicking with multiple fallback strategies
 * This function tries various approaches if the primary method fails
 */
function clickButtonWithFallbacks(element: HTMLButtonElement | null, value: string, fieldLabel: string = ''): boolean {
  const strategies = [
    // Strategy 1: Use the enhanced clickButtonByValue if we have an element
    () => {
      if (element) {
        console.log(`🎯 Strategy 1: Enhanced click on provided element`);
        return clickButtonByValue(element, value);
      }
      return false;
    },
    
    // Strategy 2: Search globally by text content
    () => {
      console.log(`🔍 Strategy 2: Global button search by text`);
      const foundButton = findButtonByTextGlobal(value);
      if (foundButton) {
        return clickButtonByValue(foundButton, value);
      }
      return false;
    },
    
    // Strategy 3: Search by label association
    () => {
      console.log(`🏷️ Strategy 3: Search by label association`);
      if (!fieldLabel) return false;
      
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        const labelText = (label.textContent || '').toLowerCase();
        if (labelText.includes(fieldLabel.toLowerCase())) {
          const container = label.closest('.form-group, .button-group, fieldset') || label.parentElement;
          if (container) {
            const buttons = container.querySelectorAll('button[type="button"], button:not([type="submit"]):not([type="reset"])');
            for (const btn of buttons) {
              if (btn instanceof HTMLButtonElement) {
                const texts = extractButtonTexts(btn);
                if (matchButtonText(texts, value)) {
                  return clickButtonByValue(btn, value);
                }
              }
            }
          }
        }
      }
      return false;
    },
    
    // Strategy 4: CSS selector based search
    () => {
      console.log(`🎨 Strategy 4: CSS selector based search`);
      const selectors = [
        `button[value*="${value}"]`,
        `button[data-value*="${value}"]`,
        `button[aria-label*="${value}"]`,
        `button[title*="${value}"]`
      ];
      
      for (const selector of selectors) {
        try {
          const buttons = document.querySelectorAll(selector);
          for (const btn of buttons) {
            if (btn instanceof HTMLButtonElement) {
              return forceClickButton(btn, value);
            }
          }
        } catch (e) {
          // Invalid selector, continue
        }
      }
      return false;
    },
    
    // Strategy 5: Partial text matching with relaxed criteria
    () => {
      console.log(`🔤 Strategy 5: Relaxed text matching`);
      const allButtons = document.querySelectorAll('button');
      const normalizedValue = value.toLowerCase().trim();
      
      for (const btn of allButtons) {
        if (btn instanceof HTMLButtonElement && btn.type !== 'submit' && btn.type !== 'reset') {
          const allText = [
            btn.textContent || '',
            btn.innerText || '',
            btn.value || '',
            btn.getAttribute('aria-label') || '',
            btn.getAttribute('title') || ''
          ].join(' ').toLowerCase();
          
          // Very relaxed matching - any partial match
          if (allText.includes(normalizedValue) || normalizedValue.includes(allText.trim())) {
            if (allText.trim().length > 0) { // Avoid empty text matches
              return forceClickButton(btn, value);
            }
          }
        }
      }
      return false;
    }
  ];
  
  // Try each strategy in order
  for (let i = 0; i < strategies.length; i++) {
    try {
      if (strategies[i]()) {
        console.log(`✅ Button clicking succeeded with strategy ${i + 1}`);
        return true;
      }
    } catch (error) {
      console.warn(`⚠️ Strategy ${i + 1} failed:`, error);
    }
  }
  
  console.error(`❌ All button clicking strategies failed for value: "${value}"`);
  return false;
}

/**
 * Set value to input element with proper event triggering
 */
function setInputValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement, value: string, fieldLabel: string = ''): boolean {
  try {
    // Special handling for button elements - use enhanced click function with fallbacks
    if (element instanceof HTMLButtonElement) {
      return clickButtonWithFallbacks(element, value, fieldLabel);
    }

    // OLD button code - keeping but disabled
    if (false && element instanceof HTMLButtonElement) {
      const normalizedValue = value.toLowerCase().trim();
      
      // Helper function to normalize date formats for matching
      const normalizeDate = (dateStr: string): string => {
        if (!dateStr) return '';
        // Normalize separators: convert - and . to /
        let normalized = dateStr.replace(/[-.]/g, '/');
        // Remove leading/trailing whitespace
        normalized = normalized.trim();
        // Handle DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD formats
        return normalized.toLowerCase();
      };
      
      // Normalize date formats if this looks like a date field
      const isDateField = fieldLabel.toLowerCase().includes('date') || 
                         fieldLabel.toLowerCase().includes('arrival') ||
                         fieldLabel.toLowerCase().includes('departure') ||
                         fieldLabel.toLowerCase().includes('birth');
      const normalizedValueForMatch = isDateField ? normalizeDate(value) : normalizedValue;
      
      // Helper function to extract button text (check multiple sources)
      // IMPORTANT: Prefer textContent over value attribute to get actual displayed text (e.g., "YES"/"NO" vs "Y"/"N")
      const getButtonText = (btn: HTMLButtonElement): string => {
        // Try textContent first (includes nested text like spans with YES/NO)
        const textContent = (btn.textContent || '').toLowerCase().trim();
        if (textContent) return textContent;
        
        // Try innerText
        const innerText = (btn.innerText || '').toLowerCase().trim();
        if (innerText) return innerText;
        
        // Try to find nested elements with text (spans, divs, generic elements)
        // Look for elements with class "button_label_space" or similar
        const nestedElements = btn.querySelectorAll('span, div, [role="generic"], .generic, .button_label_space');
        for (const elem of nestedElements) {
          const elemText = (elem.textContent || '').toLowerCase().trim();
          if (elemText && elemText.length > 0) {
            // Prefer longer text (like "YES" over "Y")
            if (elemText.length > 1) return elemText;
          }
        }
        
        // Fall back to value attribute if no text found
        if (btn.value) return btn.value.toLowerCase().trim();
        
        // Try aria-label
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase().trim();
        if (ariaLabel) return ariaLabel;
        
        // Try title attribute
        const title = btn.getAttribute('title')?.toLowerCase().trim();
        if (title) return title;
        
        return '';
      };
      
      // Try to find a button in the same container that matches the value
      // For button groups, look for common container classes or parent elements
      let container = element.closest('.selectContainer, .form-group, .form-row, .button-group, .radio_button_set, [class*="button"], [class*="date"], [class*="select"], [class*="radio"]') || element.parentElement;
      
      // If no container found, try to find by label association
      if (!container || container === document.body) {
        // Try to find associated label and its container
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
          const labelText = (label.textContent || label.innerText || '').toLowerCase();
          if (labelText.includes(fieldLabel.toLowerCase()) || fieldLabel.toLowerCase().includes(labelText)) {
            container = label.closest('.selectContainer, .form-group, .form-row, .button-group, [class*="button"], [class*="date"]') || label.parentElement;
            if (container && container !== document.body) break;
          }
        }
      }
      
      if (container && container !== document.body) {
        const buttons = container.querySelectorAll('button[type="button"], button:not([type="submit"]):not([type="reset"])');
        
        console.log(`  Searching ${buttons.length} buttons for value: "${value}"`);
        
        for (const button of buttons) {
          if (button instanceof HTMLButtonElement) {
            const buttonValue = button.value?.toLowerCase().trim() || '';
            const buttonText = getButtonText(button);
            
            // Normalize button text (remove extra whitespace)
            let normalizedButtonText = buttonText.replace(/\s+/g, ' ').trim();
            
            // Normalize date format for date buttons
            if (isDateField) {
              normalizedButtonText = normalizeDate(normalizedButtonText);
            }
            
            console.log(`  Checking button: value="${buttonValue}", text="${normalizedButtonText}", normalizedValue="${normalizedValueForMatch}"`);
            
            // Exact matches
            let isMatch = false;
            if (buttonValue === normalizedValueForMatch || normalizedButtonText === normalizedValueForMatch) {
              isMatch = true;
            }
            // Special case for YES/NO buttons (value might be Y/N but text is YES/NO)
            else if (normalizedValueForMatch === 'yes' || normalizedValueForMatch === 'y') {
              if (buttonValue === 'y' || normalizedButtonText === 'yes' || normalizedButtonText.includes('yes')) {
                isMatch = true;
              }
            }
            else if (normalizedValueForMatch === 'no' || normalizedValueForMatch === 'n') {
              if (buttonValue === 'n' || normalizedButtonText === 'no' || normalizedButtonText.includes('no')) {
                isMatch = true;
              }
            }
            // For dates, try exact match with normalized dates
            else if (isDateField) {
              const normalizedButtonValue = normalizeDate(buttonValue);
              if (normalizedButtonValue === normalizedValueForMatch || normalizedButtonText === normalizedValueForMatch) {
                isMatch = true;
              }
            }
            // Partial matches (if value is at least 3 chars)
            else if (normalizedValueForMatch.length >= 3) {
              if (normalizedButtonText.includes(normalizedValueForMatch) || normalizedValueForMatch.includes(normalizedButtonText)) {
                isMatch = true;
              }
            }
            // Special case for gender (exact matching to avoid "male" matching "female")
            else if (normalizedValue === 'male' || normalizedValue === 'm' || normalizedValue === 'পুরুষ') {
              if (buttonValue === 'm' || normalizedButtonText === 'male' || normalizedButtonText === 'পুরুষ' || 
                  normalizedButtonText.includes('male') && !normalizedButtonText.includes('female')) {
                isMatch = true;
              }
            }
            else if (normalizedValue === 'female' || normalizedValue === 'f' || normalizedValue === 'মহিলা') {
              if (buttonValue === 'f' || normalizedButtonText === 'female' || normalizedButtonText === 'মহিলা' ||
                  normalizedButtonText.includes('female')) {
                isMatch = true;
              }
            }

            if (isMatch) {
              console.log(`  ✓ Matched button, clicking...`);
              
              // Get button coordinates for accurate clicking
              const rect = button.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              
              // Full mouse event sequence (like we do for select elements)
              button.focus();
              
              // Dispatch mousedown
              button.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: centerX,
                clientY: centerY,
                button: 0,
                buttons: 1
              }));
              
              // Dispatch mouseup
              button.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: centerX,
                clientY: centerY,
                button: 0,
                buttons: 0
              }));
              
              // Call native click
              button.click();
              
              // Dispatch click event
              button.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: centerX,
                clientY: centerY,
                button: 0,
                buttons: 0
              }));
              
              // Also dispatch change event
              button.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
              
              console.log(`✓ Clicked button: ${button.id || button.className} = "${value}"`);
              return true;
            }
          }
        }
      }
      
      console.warn(`✗ Could not find matching button for value: "${value}"`);
      console.warn(`  Searched in container:`, container);
      return false;
    }

    // Format date if needed
    const formattedValue = formatDateForInput(value, fieldLabel);

    // Special handling for select dropdowns
    if (element instanceof HTMLSelectElement) {
      const normalizedValue = formattedValue.toLowerCase().trim();
      const options = Array.from(element.options);
      let optionFound = false;
      let selectedOption: HTMLOptionElement | null = null;

      // Method 1: Try exact value match
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

      // Method 5: Try partial match
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

      // Method 6: Try partial text match
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

      // Method 7: Common variations for specific field types
      if (!optionFound) {
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

        if (selectedOption) {
          element.value = selectedOption.value;
          optionFound = true;
        }
      }

      if (!optionFound) {
        console.warn(`Could not find matching option for value: "${value}" in select:`, element);
        return false;
      }
    } else {
      // Regular input/textarea
      element.value = formattedValue;

      // For React/Vue/Angular compatibility
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

    // Trigger events to ensure the framework detects the change
    const events = [
      new Event('input', { bubbles: true, cancelable: true }),
      new Event('change', { bubbles: true, cancelable: true }),
      new Event('blur', { bubbles: true, cancelable: true }),
    ];

    events.forEach(event => element.dispatchEvent(event));

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
    // Try to get ref_id from extracted data first (from AI response), then fall back to field ref_id
    let refId = field.ref_id || '';
    const extractedRefIds = (window as any).__extractedRefIds || {};
    if (extractedRefIds[fieldName] || extractedRefIds[fieldId]) {
      refId = extractedRefIds[fieldName] || extractedRefIds[fieldId] || refId;
      console.log(`  Using ref_id from extracted data: ${refId}`);
    }

    console.log(`\n--- Processing field: ${fieldLabel} ---`);
    console.log(`  ID: "${fieldId}"`);
    console.log(`  Name: "${fieldName}"`);
    console.log(`  Label: "${fieldLabel}"`);
    console.log(`  Ref ID: "${refId || 'N/A'}"`);

    // Try to find ng-select first (for dropdowns)
    let ngSelect = findNgSelectByLabel(fieldLabel);

    // Find the input element (ref_id takes priority)
    const element = findInputElement(fieldId, fieldName, fieldLabel, refId);

    if (!element && !ngSelect) {
      const refInfo = refId ? `, Ref ID: ${refId}` : '';
      const msg = `⚠️ Field not found in DOM: ${fieldLabel} (ID: ${fieldId}, Name: ${fieldName}${refInfo})`;
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

    // PRIORITY 1: Use data_format for date component fields (most specific)
    const extractedDataAny = extractedData as any;
    const dataFormat = field.data_format;
    const dataType = field.data_type;

    if (dataFormat && dataType === 'date') {
      console.log(`  Using data_format: "${dataFormat}" to extract value`);

      // CRITICAL: Only use DOB for fields that are actually asking for birth date
      const isDOBField = fieldName.toLowerCase().includes('birth') ||
                         fieldName.toLowerCase().includes('dob') ||
                         fieldId.toLowerCase().includes('birth') ||
                         fieldId.toLowerCase().includes('dob') ||
                         fieldLabel.toLowerCase().includes('birth');

      if (!isDOBField) {
        console.log(`  ⚠️ Field "${fieldLabel}" is a date field but NOT a birth date field - skipping DOB extraction`);
      } else {
        const dateOfBirth = extractedDataAny.date_of_birth || extractedDataAny.dob;

        if (dateOfBirth) {
          const dateStr = String(dateOfBirth);

          // Handle date component fields (day_digit_1, month_digit_2, year_digit_3, etc.)
          if (dataFormat.includes('digit')) {
            const parts = dateStr.split(/[\/\-\.]/);

            if (dataFormat.startsWith('day_digit_')) {
              const digitNum = parseInt(dataFormat.replace('day_digit_', ''));
              const day = parts[0]?.padStart(2, '0') || '';
              value = day[digitNum - 1] || '';
              matchMethod = `date-component (${dataFormat} from "${dateStr}")`;
            } else if (dataFormat.startsWith('month_digit_')) {
              const digitNum = parseInt(dataFormat.replace('month_digit_', ''));
              const month = parts[1]?.padStart(2, '0') || '';
              value = month[digitNum - 1] || '';
              matchMethod = `date-component (${dataFormat} from "${dateStr}")`;
            } else if (dataFormat.startsWith('year_digit_')) {
              const digitNum = parseInt(dataFormat.replace('year_digit_', ''));
              const year = parts[2] || '';
              value = year[digitNum - 1] || '';
              matchMethod = `date-component (${dataFormat} from "${dateStr}")`;
            }

            if (value) {
              console.log(`  ✓ Extracted "${value}" from date "${dateStr}" using format "${dataFormat}"`);
            }
          }
          // Handle full date format conversion (DD/MM/YYYY vs MM/DD/YYYY)
          else if (dataFormat.includes('/') || dataFormat.includes('-')) {
            const parts = dateStr.split(/[\/\-\.]/);
            const day = parts[0]?.padStart(2, '0') || '';
            const month = parts[1]?.padStart(2, '0') || '';
            const year = parts[2] || '';

            const separator = dataFormat.includes('/') ? '/' : '-';

            if (dataFormat.startsWith('DD')) {
              value = `${day}${separator}${month}${separator}${year}`;
              matchMethod = `date-format (converted to ${dataFormat})`;
            } else if (dataFormat.startsWith('MM')) {
              value = `${month}${separator}${day}${separator}${year}`;
              matchMethod = `date-format (converted to ${dataFormat})`;
            } else if (dataFormat.startsWith('YYYY')) {
              value = `${year}${separator}${month}${separator}${day}`;
              matchMethod = `date-format (converted to ${dataFormat})`;
            }

            if (value) {
              console.log(`  ✓ Converted date "${dateStr}" to format "${dataFormat}" = "${value}"`);
            }
          }
        }
      }
    }

    // PRIORITY 2: Direct field name/ID match
    if (!value && fieldName && extractedDataAny[fieldName]) {
      value = String(extractedDataAny[fieldName]);
      matchMethod = 'exact-name';
      console.log(`  ✓ Direct match by name: "${fieldName}" = "${value}"`);
    }
    // Try by field ID
    else if (!value && fieldId && extractedDataAny[fieldId]) {
      value = String(extractedDataAny[fieldId]);
      matchMethod = 'exact-id';
      console.log(`  ✓ Direct match by ID: "${fieldId}" = "${value}"`);
    }
    // Try by label-based key (for dynamic forms with empty IDs/names)
    else if (!value) {
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
        // Type guard for Element vs specific input types
        if (element instanceof HTMLInputElement || 
            element instanceof HTMLTextAreaElement || 
            element instanceof HTMLSelectElement || 
            element instanceof HTMLButtonElement) {
          success = setInputValue(element, value, fieldLabel);
        } else if (element.tagName && element.tagName.toLowerCase() === 'ng-select') {
          // Handle ng-select separately
          success = setNgSelectValue(element, value, fieldLabel);
        }
      }
      // Fallback: If no element found but might be a button field, try global button search
      else if (!element && !ngSelect && 
               (fieldLabel.toLowerCase().includes('button') || 
                fieldLabel.toLowerCase().includes('select') || 
                fieldLabel.toLowerCase().includes('choice') ||
                fieldName.toLowerCase().includes('button') ||
                fieldId.toLowerCase().includes('button'))) {
        console.log(`  🔄 No element found, trying global button search for: "${value}"`);
        success = clickButtonWithFallbacks(null, value, fieldLabel);
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
  extractedData: ExtractedData | DynamicExtractedData,
  additionalContext?: string
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
      func: (formDataArg: any, extractedDataArg: any, contextArg: string) => {
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

        function findInputElement(fieldId: string, fieldName: string, fieldLabel: string = '', refId: string = ''): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement | null {
          // PRIORITY 1: Try ref_id first (most reliable)
          if (refId && window.__claudeElementMap) {
            const weakRef = window.__claudeElementMap[refId];
            if (weakRef) {
              const elementByRef = weakRef.deref();
              if (elementByRef && (elementByRef instanceof HTMLInputElement || elementByRef instanceof HTMLTextAreaElement || elementByRef instanceof HTMLSelectElement || elementByRef instanceof HTMLButtonElement)) {
                console.log('  ✓ Found element via ref_id: ' + refId);
              return elementByRef;
            }
            }
          }

          // PRIORITY 2: Try by ID
          if (fieldId) {
            const byId = document.getElementById(fieldId);
            if (byId && (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement || byId instanceof HTMLSelectElement || byId instanceof HTMLButtonElement)) {
              return byId;
            }
          }

          // PRIORITY 3: Try by name attribute (including buttons)
          if (fieldName) {
            const byName = document.querySelector('input[name="' + fieldName + '"], textarea[name="' + fieldName + '"], select[name="' + fieldName + '"], button[name="' + fieldName + '"]');
            if (byName && (byName instanceof HTMLInputElement || byName instanceof HTMLTextAreaElement || byName instanceof HTMLSelectElement || byName instanceof HTMLButtonElement)) {
              return byName;
            }
          }

          // PRIORITY 4: Try by ID as selector
          if (fieldId) {
            const bySelector = document.querySelector('input[id="' + fieldId + '"], textarea[id="' + fieldId + '"], select[id="' + fieldId + '"], button[id="' + fieldId + '"]');
            if (bySelector && (bySelector instanceof HTMLInputElement || bySelector instanceof HTMLTextAreaElement || bySelector instanceof HTMLSelectElement || bySelector instanceof HTMLButtonElement)) {
              return bySelector;
            }
          }

          // PRIORITY 5: Try case-insensitive search
          if (fieldName) {
            const allInputs = document.querySelectorAll('input, textarea, select, button');
            for (const input of allInputs) {
              if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement || input instanceof HTMLButtonElement) {
                const name = input.getAttribute('name')?.toLowerCase();
                const id = input.getAttribute('id')?.toLowerCase();
                if (name === fieldName.toLowerCase() || id === fieldName.toLowerCase()) {
                  return input;
                }
              }
            }
          }

          // PRIORITY 6: Try by label text
          if (fieldLabel) {
            const byLabel = findInputByLabel(fieldLabel);
            if (byLabel) return byLabel;
          }

          // PRIORITY 7: For button groups, try to find by label text
          if (fieldName) {
            const normalizedFieldName = fieldName.toLowerCase();
            const labels = document.querySelectorAll('label');
            for (const label of labels) {
              const labelText = (label.textContent || label.innerText || '').toLowerCase();
              if (labelText.includes(normalizedFieldName) || normalizedFieldName.includes(labelText)) {
                const container = label.closest('.selectContainer, .form-group, .form-row') || label.parentElement;
                if (container) {
                  const firstButton = container.querySelector('button[type="button"], button:not([type="submit"]):not([type="reset"])');
                  if (firstButton instanceof HTMLButtonElement) {
                    console.log('  ✓ Found button group via label: ' + labelText);
                    return firstButton;
                  }
                }
              }
            }
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

        // Enhanced button click function with multiple strategies
        function clickButtonByValue(element, value) {
          try {
            const normalizedValue = value.toLowerCase().trim();
            console.log('🔘 Starting button click search for value: "' + value + '"');

            // Find buttons in container using multiple selectors
            function findButtonsInContainer(element) {
              const selectors = [
                '.selectContainer, .form-group, .form-row, .button-group, .radio_button_set',
                '[class*="button"], [class*="select"], [class*="choice"], [class*="option"]',
                '.btn-group, .btn-toolbar, .form-check, .form-radio',
                '[role="group"], [role="radiogroup"], fieldset'
              ];

              for (const selector of selectors) {
                const container = element.closest(selector);
                if (container && container !== document.body) {
                  const buttons = Array.from(container.querySelectorAll('button[type="button"], button:not([type="submit"]):not([type="reset"])'))
                    .filter(btn => btn instanceof HTMLButtonElement);
                  if (buttons.length > 1) return buttons;
                }
              }

              const parent = element.parentElement;
              if (parent) {
                const siblingButtons = Array.from(parent.querySelectorAll('button[type="button"], button:not([type="submit"]):not([type="reset"])'))
                  .filter(btn => btn instanceof HTMLButtonElement);
                if (siblingButtons.length > 1) return siblingButtons;
              }

              return [element];
            }

            // Extract all text sources from button
            function extractButtonTexts(btn) {
              const texts = [];
              const textContent = (btn.textContent || '').trim();
              const innerText = (btn.innerText || '').trim();
              const value = (btn.value || '').trim();
              const ariaLabel = (btn.getAttribute('aria-label') || '').trim();
              const title = (btn.getAttribute('title') || '').trim();
              const dataValue = (btn.getAttribute('data-value') || '').trim();
              
              [textContent, innerText, value, ariaLabel, title, dataValue].forEach(text => {
                if (text && !texts.includes(text)) {
                  texts.push(text);
                }
              });

              const nestedElements = btn.querySelectorAll('span, div, i, .text, .label, [class*="text"], [class*="label"]');
              nestedElements.forEach(elem => {
                const elemText = (elem.textContent || '').trim();
                if (elemText && !texts.includes(elemText)) {
                  texts.push(elemText);
                }
              });

              return texts;
            }

            // Special keyword matching with gender-specific logic
            function matchSpecialKeywords(buttonText, targetValue) {
              const yesKeywords = ['yes', 'y', 'true', '1', 'ok', 'confirm', 'agree', 'accept'];
              const noKeywords = ['no', 'n', 'false', '0', 'cancel', 'deny', 'reject', 'decline'];
              const maleKeywords = ['male', 'm', 'পুরুষ', 'man'];
              const femaleKeywords = ['female', 'f', 'মহিলা', 'woman'];
              
              const isTargetYes = yesKeywords.includes(targetValue);
              const isTargetNo = noKeywords.includes(targetValue);
              const isTargetMale = maleKeywords.includes(targetValue);
              const isTargetFemale = femaleKeywords.includes(targetValue);
              
              const isButtonYes = yesKeywords.some(keyword => buttonText.includes(keyword));
              const isButtonNo = noKeywords.some(keyword => buttonText.includes(keyword));
              const isButtonMale = maleKeywords.some(keyword => buttonText.includes(keyword));
              const isButtonFemale = femaleKeywords.some(keyword => buttonText.includes(keyword));
              
              if (isTargetYes && isButtonYes) return true;
              if (isTargetNo && isButtonNo) return true;
              if (isTargetMale && isButtonMale && !isButtonFemale) return true;
              if (isTargetFemale && isButtonFemale && !isButtonMale) return true;
              
              return false;
            }

            // Check for problematic matches
            function isProblematicMatch(buttonText, targetValue) {
              const problematicPairs = [
                ['male', 'female'], ['female', 'male'],
                ['yes', 'no'], ['no', 'yes'],
                ['true', 'false'], ['false', 'true']
              ];
              
              for (const pair of problematicPairs) {
                if ((buttonText.includes(pair[0]) && targetValue === pair[1]) ||
                    (buttonText.includes(pair[1]) && targetValue === pair[0])) {
                  return true;
                }
              }
              return false;
            }

            // Enhanced button text matching with priorities
            function matchButtonText(buttonTexts, targetValue) {
              const normalizedTarget = targetValue.toLowerCase().trim();
              
              // PRIORITY 1: Exact match
              for (const text of buttonTexts) {
                const normalizedText = text.toLowerCase().trim();
                if (normalizedText === normalizedTarget) return true;
              }
              
              // PRIORITY 2: Special keyword matching
              for (const text of buttonTexts) {
                const normalizedText = text.toLowerCase().trim();
                if (matchSpecialKeywords(normalizedText, normalizedTarget)) return true;
              }
              
              // PRIORITY 3: Word boundary matches
              for (const text of buttonTexts) {
                const normalizedText = text.toLowerCase().trim();
                try {
                  const wordBoundaryRegex = new RegExp('\\\\b' + normalizedTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&') + '\\\\b');
                  if (wordBoundaryRegex.test(normalizedText)) return true;
                } catch (e) {
                  // Invalid regex, skip
                }
              }
              
              // PRIORITY 4: Contains match (with safety checks)
              for (const text of buttonTexts) {
                const normalizedText = text.toLowerCase().trim();
                if (normalizedText.includes(normalizedTarget) || normalizedTarget.includes(normalizedText)) {
                  if (!isProblematicMatch(normalizedText, normalizedTarget)) {
                    return true;
                  }
                }
              }
              
              return false;
            }

            // Trigger comprehensive click events
            function triggerButtonClick(button) {
              button.focus();
              
              const rect = button.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              
              const mouseEventOptions = {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: centerX,
                clientY: centerY,
                button: 0,
              };
              
              button.dispatchEvent(new MouseEvent('mousedown', Object.assign({}, mouseEventOptions, { buttons: 1 })));
              
              setTimeout(() => {
                button.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, mouseEventOptions, { buttons: 0 })));
                button.dispatchEvent(new MouseEvent('click', Object.assign({}, mouseEventOptions, { buttons: 0 })));
                button.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                button.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              }, 10);
            }

            // Main logic
            const buttons = findButtonsInContainer(element);
            console.log('  📋 Found ' + buttons.length + ' buttons to search through');

            // Try to find matching button using advanced matching
            for (const button of buttons) {
              const buttonTexts = extractButtonTexts(button);
              console.log('  🔍 Checking button with texts: [' + buttonTexts.join(', ') + '] for target: "' + normalizedValue + '"');
              
              // Debug each matching strategy
              for (const text of buttonTexts) {
                const normalizedText = text.toLowerCase().trim();
                console.log('    - Text: "' + normalizedText + '" vs Target: "' + normalizedValue + '"');
                
                // Check exact match
                if (normalizedText === normalizedValue) {
                  console.log('      → Exact match found!');
                }
                
                // Check special keyword match
                if (matchSpecialKeywords(normalizedText, normalizedValue)) {
                  console.log('      → Special keyword match found!');
                }
                
                // Check if problematic
                if (isProblematicMatch(normalizedText, normalizedValue)) {
                  console.log('      → ⚠️  Problematic match detected, skipping');
                }
              }

              if (matchButtonText(buttonTexts, normalizedValue)) {
                console.log('  ✅ Match found! Triggering click on button');
                button.click();
                triggerButtonClick(button);
                console.log('✅ Successfully clicked button with value: "' + value + '"');
                return true;
              }
            }

            // Fallback: Search by data attributes or class names
            console.log('  🔄 Trying fallback search by attributes...');
            for (const button of buttons) {
              const datasets = Object.values(button.dataset || {});
              const classNames = button.className.toLowerCase();
              
              if (datasets.some(data => data.toLowerCase().includes(normalizedValue)) ||
                  classNames.includes(normalizedValue)) {
                console.log('  ✅ Fallback match found via attributes');
                button.click();
                triggerButtonClick(button);
                return true;
              }
            }

            console.warn('❌ No matching button found for value: "' + value + '"');
            return false;
          } catch (error) {
            console.error('❌ Error in clickButtonByValue:', error);
            return false;
          }
        }

        function setInputValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement, value: string, fieldLabel: string = ''): boolean {
          try {
            // Special handling for button elements - use generalized click function
            if (element instanceof HTMLButtonElement) {
              return clickButtonByValue(element, value);
            }

            // OLD button code - keeping but disabled
            if (false && element instanceof HTMLButtonElement) {
              const normalizedValue = value.toLowerCase().trim();
              
              // Helper function to normalize date formats for matching
              function normalizeDate(dateStr: string): string {
                if (!dateStr) return '';
                // Normalize separators: convert - and . to /
                let normalized = dateStr.replace(/[-.]/g, '/');
                // Remove leading/trailing whitespace
                normalized = normalized.trim();
                return normalized.toLowerCase();
              }
              
              // Normalize date formats if this looks like a date field
              const isDateField = fieldLabel.toLowerCase().includes('date') || 
                                 fieldLabel.toLowerCase().includes('arrival') ||
                                 fieldLabel.toLowerCase().includes('departure') ||
                                 fieldLabel.toLowerCase().includes('birth');
              const normalizedValueForMatch = isDateField ? normalizeDate(value) : normalizedValue;
              
              // Helper function to extract button text (check multiple sources)
              // IMPORTANT: Prefer textContent over value attribute to get actual displayed text (e.g., "YES"/"NO" vs "Y"/"N")
              function getButtonText(btn: HTMLButtonElement): string {
                // Try textContent first (includes nested text like spans with YES/NO)
                const textContent = (btn.textContent || '').toLowerCase().trim();
                if (textContent) return textContent;
                
                // Try innerText
                const innerText = (btn.innerText || '').toLowerCase().trim();
                if (innerText) return innerText;
                
                // Try to find nested elements with text (spans, divs, generic elements)
                // Look for elements with class "button_label_space" or similar
                const nestedElements = btn.querySelectorAll('span, div, [role="generic"], .generic, .button_label_space');
                for (const elem of nestedElements) {
                  const elemText = (elem.textContent || '').toLowerCase().trim();
                  if (elemText && elemText.length > 0) {
                    // Prefer longer text (like "YES" over "Y")
                    if (elemText.length > 1) return elemText;
                  }
                }
                
                // Fall back to value attribute if no text found
                if (btn.value) return btn.value.toLowerCase().trim();
                
                const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase().trim();
                if (ariaLabel) return ariaLabel;
                const title = btn.getAttribute('title')?.toLowerCase().trim();
                if (title) return title;
                return '';
              }
              
              // Try to find a button in the same container that matches the value
              // For button groups, look for common container classes or parent elements
              let container = element.closest('.selectContainer, .form-group, .form-row, .button-group, .radio_button_set, [class*="button"], [class*="date"], [class*="select"], [class*="radio"]') || element.parentElement;
              
              // If no container found, try to find by label association
              if (!container || container === document.body) {
                // Try to find associated label and its container
                const labels = document.querySelectorAll('label');
                for (const label of labels) {
                  const labelText = (label.textContent || label.innerText || '').toLowerCase();
                  if (labelText.includes(fieldLabel.toLowerCase()) || fieldLabel.toLowerCase().includes(labelText)) {
                    container = label.closest('.selectContainer, .form-group, .form-row, .button-group, .radio_button_set, [class*="button"], [class*="date"], [class*="radio"]') || label.parentElement;
                    if (container && container !== document.body) break;
                  }
                }
              }
              
              if (container && container !== document.body) {
                const buttons = container.querySelectorAll('button[type="button"], button:not([type="submit"]):not([type="reset"])');
                
                console.log('  Searching ' + buttons.length + ' buttons for value: "' + value + '"');
                
                for (const button of buttons) {
                  if (button instanceof HTMLButtonElement) {
                    const buttonValue = (button.value || '').toLowerCase().trim();
                    const buttonText = getButtonText(button);
                    let normalizedButtonText = buttonText.replace(/\s+/g, ' ').trim();
                    
                    // Normalize date format for date buttons
                    if (isDateField) {
                      normalizedButtonText = normalizeDate(normalizedButtonText);
                    }
                    
                    console.log('  Checking button: value="' + buttonValue + '", text="' + normalizedButtonText + '", normalizedValue="' + normalizedValueForMatch + '"');
                    
                    // Exact matches
                    let isMatch = false;
                    if (buttonValue === normalizedValueForMatch || normalizedButtonText === normalizedValueForMatch) {
                      isMatch = true;
                    }
                    // Special case for YES/NO buttons (value might be Y/N but text is YES/NO)
                    else if (normalizedValueForMatch === 'yes' || normalizedValueForMatch === 'y') {
                      if (buttonValue === 'y' || normalizedButtonText === 'yes' || normalizedButtonText.includes('yes')) {
                        isMatch = true;
                      }
                    }
                    else if (normalizedValueForMatch === 'no' || normalizedValueForMatch === 'n') {
                      if (buttonValue === 'n' || normalizedButtonText === 'no' || normalizedButtonText.includes('no')) {
                        isMatch = true;
                      }
                    }
                    // For dates, try exact match with normalized dates
                    else if (isDateField) {
                      const normalizedButtonValue = normalizeDate(buttonValue);
                      if (normalizedButtonValue === normalizedValueForMatch || normalizedButtonText === normalizedValueForMatch) {
                        isMatch = true;
                      }
                    }
                    // Partial matches (if value is at least 3 chars)
                    else if (normalizedValueForMatch.length >= 3) {
                      if (normalizedButtonText.includes(normalizedValueForMatch) || normalizedValueForMatch.includes(normalizedButtonText)) {
                        isMatch = true;
                      }
                    }
                    // Special case for gender
                    else if (normalizedValue === 'male' || normalizedValue === 'm' || normalizedValue === 'পুরুষ') {
                      if (buttonValue === 'm' || normalizedButtonText === 'male' || normalizedButtonText === 'পুরুষ' || 
                          (normalizedButtonText.includes('male') && !normalizedButtonText.includes('female'))) {
                        isMatch = true;
                      }
                    }
                    else if (normalizedValue === 'female' || normalizedValue === 'f' || normalizedValue === 'মহিলা') {
                      if (buttonValue === 'f' || normalizedButtonText === 'female' || normalizedButtonText === 'মহিলা' ||
                          normalizedButtonText.includes('female')) {
                        isMatch = true;
                      }
                    }

                    if (isMatch) {
                      console.log('  ✓ Matched button, clicking...');
                      
                      // Get button coordinates for accurate clicking
                      const rect = button.getBoundingClientRect();
                      const centerX = rect.left + rect.width / 2;
                      const centerY = rect.top + rect.height / 2;
                      
                      // Full mouse event sequence
                      button.focus();
                      
                      // Dispatch mousedown
                      button.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: centerX,
                        clientY: centerY,
                        button: 0,
                        buttons: 1
                      }));
                      
                      // Dispatch mouseup
                      button.dispatchEvent(new MouseEvent('mouseup', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: centerX,
                        clientY: centerY,
                        button: 0,
                        buttons: 0
                      }));
                      
                      // Call native click
                      button.click();
                      
                      // Dispatch click event
                      button.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: centerX,
                        clientY: centerY,
                        button: 0,
                        buttons: 0
                      }));
                      
                      // Also dispatch change event
                      button.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                      
                      console.log('✓ Clicked button: ' + (button.id || button.className) + ' = "' + value + '"');
                      return true;
                    }
                  }
                }
              }
              
              console.warn('✗ Could not find matching button for value: "' + value + '"');
              return false;
            }

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
          // Try to get ref_id from extracted data first (from AI response), then fall back to field ref_id
          let refId = field.ref_id || '';
          const extractedRefIds = (window as any).__extractedRefIds || {};
          if (extractedRefIds[fieldName] || extractedRefIds[fieldId]) {
            refId = extractedRefIds[fieldName] || extractedRefIds[fieldId] || refId;
            console.log('  Using ref_id from extracted data: ' + refId);
          }
          const element = findInputElement(fieldId, fieldName, fieldLabel, refId);

          if (!element && !ngSelect) {
            const refInfo = refId ? ', Ref ID: ' + refId : '';
            const msg = '⚠️ Field not found in DOM: ' + fieldLabel + ' (ID: ' + fieldId + ', Name: ' + fieldName + refInfo + ')';
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

          // Use context hints to improve field matching if provided
          const contextHints = (contextArg && contextArg.trim()) ? contextArg.toLowerCase() : '';
          const normalizedFieldLabel = fieldLabel.toLowerCase();
          const normalizedFieldName = fieldName.toLowerCase();
          const normalizedFieldId = fieldId.toLowerCase();
          const contextMentionsField = contextArg && contextArg.trim() && (
            contextHints.includes(normalizedFieldLabel) ||
            contextHints.includes(normalizedFieldName) ||
            contextHints.includes(normalizedFieldId)
          );

          // PRIORITY 0.5: Use context hints to find alternative field names
          if (contextArg && contextArg.trim() && contextMentionsField) {
            const contextLines = contextArg.split('\n');
            for (const line of contextLines) {
              const lowerLine = line.toLowerCase();
              if (lowerLine.includes(normalizedFieldLabel) || lowerLine.includes(normalizedFieldName)) {
                // Look for patterns like "field X might be labeled as Y"
                const altNameMatch = line.match(/(?:labeled as|called|named|is|maps to|use)\s+['"]?([^'",\n]+)['"]?/i);
                if (altNameMatch && altNameMatch[1]) {
                  const altName = altNameMatch[1].trim().toLowerCase();
                  // Try matching with alternative name
                  for (const key in extractedDataArg) {
                    if (key.toLowerCase() === altName || key.toLowerCase().includes(altName)) {
                      if (extractedDataArg[key] !== undefined && extractedDataArg[key] !== null && extractedDataArg[key] !== '') {
                        value = String(extractedDataArg[key]);
                        matchMethod = 'context hint: "' + altName + '"';
                        console.log('  ✓ Found via context hint: ' + key + ' = "' + value + '"');
                        break;
                      }
                    }
                  }
                  if (value) break;
                }
              }
            }
          }

          // Try by field name
          if (!value && fieldName && extractedDataArg[fieldName]) {
            value = String(extractedDataArg[fieldName]);
            matchMethod = 'exact-name';
          }
          // Try by field ID
          else if (!value && fieldId && extractedDataArg[fieldId]) {
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
            } else if (!element && !ngSelect && 
                       (fieldLabel.toLowerCase().includes('button') || 
                        fieldLabel.toLowerCase().includes('select') || 
                        fieldLabel.toLowerCase().includes('choice') ||
                        fieldName.toLowerCase().includes('button') ||
                        fieldId.toLowerCase().includes('button'))) {
              console.log('  🔄 No element found, trying global button search for: "' + value + '"');
              // Use the enhanced button clicking function
              success = clickButtonByValue(null, value);
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
      args: [formData, extractedData, additionalContext || ''],
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


