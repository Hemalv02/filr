/**
 * Custom Select Expander
 * Automatically opens custom select components to capture their options
 */

interface CustomSelectInfo {
  element: HTMLElement;
  type: 'ng-select' | 'react-select' | 'vue-select' | 'generic';
  container: HTMLElement;
  trigger: HTMLElement | null;
  isOpen: boolean;
}

/**
 * Detect all custom select components on the page
 */
export function detectCustomSelects(): CustomSelectInfo[] {
  const selects: CustomSelectInfo[] = [];

  // Detect ng-select components
  const ngSelects = document.querySelectorAll('ng-select, [class*="ng-select"]');
  ngSelects.forEach((element) => {
    const container = element.querySelector<HTMLElement>('.ng-select-container');
    const input = element.querySelector<HTMLElement>('input[role="combobox"]');
    const isOpen = input?.getAttribute('aria-expanded') === 'true';

    selects.push({
      element: element as HTMLElement,
      type: 'ng-select',
      container: element as HTMLElement,
      trigger: container || input,
      isOpen,
    });
  });

  // Detect react-select components
  const reactSelects = document.querySelectorAll('[class*="react-select"]');
  reactSelects.forEach((element) => {
    const control = element.querySelector<HTMLElement>('.react-select__control');
    const input = element.querySelector<HTMLElement>('input[role="combobox"]');
    const isOpen =
      element.classList.contains('react-select__menu-is-open') ||
      input?.getAttribute('aria-expanded') === 'true';

    selects.push({
      element: element as HTMLElement,
      type: 'react-select',
      container: element as HTMLElement,
      trigger: control || element as HTMLElement,
      isOpen,
    });
  });

  // Detect vue-select/multiselect components
  const vueSelects = document.querySelectorAll('[class*="multiselect"], [class*="vue-select"]');
  vueSelects.forEach((element) => {
    const input = element.querySelector<HTMLElement>('.multiselect__input');
    const content = element.querySelector<HTMLElement>('.multiselect__content-wrapper');
    const isOpen = content?.style.display !== 'none';

    selects.push({
      element: element as HTMLElement,
      type: 'vue-select',
      container: element as HTMLElement,
      trigger: element as HTMLElement,
      isOpen,
    });
  });

  // Detect generic combobox elements
  const comboboxes = document.querySelectorAll<HTMLElement>('[role="combobox"]');
  comboboxes.forEach((element) => {
    // Skip if already detected as part of a known framework
    const alreadyDetected = selects.some((s) => s.container.contains(element));
    if (alreadyDetected) return;

    const isOpen = element.getAttribute('aria-expanded') === 'true';

    selects.push({
      element,
      type: 'generic',
      container: element.closest('[class*="select"]') as HTMLElement || element,
      trigger: element,
      isOpen,
    });
  });

  return selects;
}

/**
 * Open a custom select component
 */
export async function openCustomSelect(info: CustomSelectInfo): Promise<boolean> {
  if (info.isOpen) {
    return true; // Already open
  }

  try {
    switch (info.type) {
      case 'ng-select':
        return await openNgSelect(info);
      case 'react-select':
        return await openReactSelect(info);
      case 'vue-select':
        return await openVueSelect(info);
      case 'generic':
        return await openGenericSelect(info);
      default:
        return false;
    }
  } catch (error) {
    console.error('Failed to open custom select:', error);
    return false;
  }
}

/**
 * Open ng-select component
 */
async function openNgSelect(info: CustomSelectInfo): Promise<boolean> {
  console.log('🔍 Opening ng-select...');
  console.log('Container:', info.container);
  console.log('Container HTML:', info.container.outerHTML.substring(0, 500));

  const container = info.container.querySelector<HTMLElement>('.ng-select-container');
  if (!container) {
    console.log('❌ .ng-select-container not found');
    return false;
  }

  console.log('✅ Found .ng-select-container');

  // Dispatch mousedown event to open
  console.log('📤 Dispatching mousedown event');
  container.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
    })
  );

  // Wait for dropdown to appear
  console.log('⏳ Waiting 300ms for dropdown...');
  await sleep(300);

  // Check if dropdown panel appeared (more reliable than aria-expanded)
  const dropdown = document.querySelector('.ng-dropdown-panel');
  const isOpened = dropdown !== null;

  console.log('Is opened?', isOpened);

  if (dropdown) {
    console.log('✅ Dropdown panel found!');
    console.log('Dropdown HTML:', dropdown.outerHTML.substring(0, 1000));

    const options = dropdown.querySelectorAll('[role="option"]');
    console.log(`Found ${options.length} options in dropdown:`);
    options.forEach((opt, i) => {
      console.log(`  ${i + 1}. "${opt.textContent?.trim()}"`);
    });
  } else {
    console.log('❌ No dropdown panel found');
  }

  return isOpened;
}

/**
 * Open react-select component
 */
async function openReactSelect(info: CustomSelectInfo): Promise<boolean> {
  const control = info.container.querySelector<HTMLElement>('.react-select__control');
  if (!control) return false;

  // Click the control
  control.click();

  // Wait for menu to appear
  await sleep(300);

  // Check if opened
  const menu = document.querySelector('.react-select__menu');
  return menu !== null;
}

/**
 * Open vue-select component
 */
async function openVueSelect(info: CustomSelectInfo): Promise<boolean> {
  // Click the container
  info.container.click();

  // Wait for content to appear
  await sleep(300);

  // Check if opened
  const content = info.container.querySelector<HTMLElement>('.multiselect__content-wrapper');
  return content?.style.display !== 'none';
}

/**
 * Open generic combobox
 */
async function openGenericSelect(info: CustomSelectInfo): Promise<boolean> {
  if (!info.trigger) return false;

  // Try clicking
  info.trigger.click();

  // Wait
  await sleep(300);

  // Check if expanded
  return info.trigger.getAttribute('aria-expanded') === 'true';
}

/**
 * Close a custom select component
 */
export async function closeCustomSelect(info: CustomSelectInfo): Promise<void> {
  try {
    switch (info.type) {
      case 'ng-select':
        await closeNgSelect(info);
        break;
      case 'react-select':
        await closeReactSelect(info);
        break;
      case 'vue-select':
        await closeVueSelect(info);
        break;
      case 'generic':
        await closeGenericSelect(info);
        break;
    }
  } catch (error) {
    console.error('Failed to close custom select:', error);
  }
}

async function closeNgSelect(info: CustomSelectInfo): Promise<void> {
  // Click outside or press Escape
  document.body.click();
  await sleep(100);
}

async function closeReactSelect(info: CustomSelectInfo): Promise<void> {
  // Click outside
  document.body.click();
  await sleep(100);
}

async function closeVueSelect(info: CustomSelectInfo): Promise<void> {
  // Click outside
  document.body.click();
  await sleep(100);
}

async function closeGenericSelect(info: CustomSelectInfo): Promise<void> {
  // Press Escape key
  if (info.trigger) {
    info.trigger.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
      })
    );
  }
  await sleep(100);
}

/**
 * Scroll dropdown to load all options (for virtual scrolling)
 */
export async function scrollToLoadAllOptions(container: HTMLElement): Promise<void> {
  // Find scroll container
  const scrollContainer =
    container.querySelector<HTMLElement>('.ng-dropdown-panel-items') ||
    container.querySelector<HTMLElement>('.react-select__menu-list') ||
    container.querySelector<HTMLElement>('.multiselect__content') ||
    container.querySelector<HTMLElement>('[role="listbox"]');

  if (!scrollContainer) return;

  // Check if virtual scrolling is present
  const hasVirtualScroll =
    scrollContainer.scrollHeight > scrollContainer.clientHeight * 2;

  if (!hasVirtualScroll) return;

  // Scroll to bottom gradually
  let lastScrollTop = -1;
  let attempts = 0;

  while (attempts < 50) {
    scrollContainer.scrollTop += 100;

    // Wait for render
    await sleep(50);

    // Check if we've reached bottom
    if (scrollContainer.scrollTop === lastScrollTop) {
      break;
    }

    lastScrollTop = scrollContainer.scrollTop;
    attempts++;
  }

  // Scroll back to top
  scrollContainer.scrollTop = 0;
  await sleep(100);
}

/**
 * Get options from a custom select by opening it temporarily
 */
export async function getCustomSelectOptions(
  select: CustomSelectInfo
): Promise<HTMLElement[]> {
  const options: HTMLElement[] = [];

  try {
    // Open the select
    const opened = await openCustomSelect(select);

    if (!opened) {
      return options;
    }

    // Scroll to load all options if virtual scrolling
    await scrollToLoadAllOptions(select.container);

    // Give Angular/React/Vue time to render
    await sleep(300);

    // Find all options in the dropdown
    const optionElements = findOptionsInDropdown(select);
    options.push(...optionElements);

    // Close the select
    await closeCustomSelect(select);
    await sleep(100);
  } catch (error) {
    console.error('Error getting custom select options:', error);
  }

  return options;
}

/**
 * Find option elements in a dropdown
 */
function findOptionsInDropdown(select: CustomSelectInfo): HTMLElement[] {
  const options: HTMLElement[] = [];

  // Try different selectors based on type
  let optionElements: NodeListOf<HTMLElement> | null = null;

  switch (select.type) {
    case 'ng-select':
      optionElements = document.querySelectorAll<HTMLElement>(
        '.ng-dropdown-panel [role="option"], .ng-option'
      );
      break;

    case 'react-select':
      optionElements = document.querySelectorAll<HTMLElement>(
        '.react-select__menu [role="option"], .react-select__option'
      );
      break;

    case 'vue-select':
      optionElements = select.container.querySelectorAll<HTMLElement>(
        '.multiselect__option'
      );
      break;

    case 'generic':
      const menuId = select.trigger?.getAttribute('aria-controls');
      if (menuId) {
        const menu = document.getElementById(menuId);
        if (menu) {
          optionElements = menu.querySelectorAll<HTMLElement>('[role="option"]');
        }
      }
      break;
  }

  if (optionElements) {
    options.push(...Array.from(optionElements));
  }

  return options;
}

/**
 * Create temporary option elements that will be included in the tree
 * These are clones that appear in the DOM but are hidden
 */
export async function injectCustomSelectOptionsIntoDOM(): Promise<void> {
  const selects = detectCustomSelects();

  console.log(`Found ${selects.length} custom select components`);

  for (const select of selects) {
    try {
      // Get options by opening select temporarily
      const options = await getCustomSelectOptions(select);

      if (options.length === 0) continue;

      console.log(`Found ${options.length} options for select`, select.type);

      // Clone options and inject them into the select container
      // Make them hidden but still in DOM so tree can find them
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'filrr-injected-options';
      optionsContainer.style.display = 'none';
      optionsContainer.setAttribute('aria-hidden', 'false'); // Include in tree
      optionsContainer.setAttribute('role', 'listbox');

      options.forEach((option) => {
        const clone = option.cloneNode(true) as HTMLElement;
        // Keep role and text content
        clone.setAttribute('role', 'option');
        optionsContainer.appendChild(clone);
      });

      // Inject into the select container
      select.container.appendChild(optionsContainer);
    } catch (error) {
      console.error('Error injecting custom select options:', error);
    }
  }

  console.log('Finished injecting custom select options');
}

/**
 * Clean up injected options after tree generation
 */
export function removeInjectedOptions(): void {
  const injected = document.querySelectorAll('.filrr-injected-options');
  injected.forEach((el) => el.remove());
  console.log(`Removed ${injected.length} injected option containers`);
}

/**
 * Close all custom selects after tree generation
 */
export async function closeAllCustomSelects(): Promise<void> {
  const selects = detectCustomSelects();

  for (const select of selects) {
    if (select.isOpen) {
      try {
        await closeCustomSelect(select);
        await sleep(50);
      } catch (error) {
        console.error('Error closing custom select:', error);
      }
    }
  }

  console.log('Closed all custom selects');
}

/**
 * Helper: Sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

