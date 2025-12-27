/**
 * Accessibility Tree Generator
 * Based on Claude's accessibility tree implementation
 */

// Define types for better type safety
interface AccessibilityTreeResult {
  pageContent: string;
  viewport: {
    width: number;
    height: number;
  };
  error?: string;
}

interface TreeOptions {
  filter: 'all' | 'interactive';
  refId?: string | null;
}

declare global {
  interface Window {
    __claudeElementMap: Record<string, WeakRef<HTMLElement>>;
    __claudeRefCounter: number;
    __generateAccessibilityTree: (
      filter?: string,
      depth?: number,
      refId?: string
    ) => AccessibilityTreeResult;
  }
}

/**
 * Initialize the accessibility tree generator
 */
export function initAccessibilityTree() {
  // Initialize global element map
  if (!window.__claudeElementMap) {
    window.__claudeElementMap = {};
  }

  // Initialize reference counter
  if (!window.__claudeRefCounter) {
    window.__claudeRefCounter = 0;
  }

  /**
   * Get ARIA role from element
   */
  const getRole = (element: HTMLElement): string => {
    // Check for explicit ARIA role
    const explicitRole = element.getAttribute('role');
    if (explicitRole) {
      return explicitRole;
    }

    // Get implicit role from tag name
    const tagName = element.tagName.toLowerCase();
    const inputType = element.getAttribute('type');

    // Helper for input roles
    const getInputRole = (inputType: string | null): string => {
      if (inputType === 'submit' || inputType === 'button') return 'button';
      if (inputType === 'checkbox') return 'checkbox';
      if (inputType === 'radio') return 'radio';
      if (inputType === 'file') return 'button';
      return 'textbox';
    };

    // Map of tag names to ARIA roles
    const roleMap: Record<string, string> = {
      a: 'link',
      button: 'button',
      input: getInputRole(inputType),
      select: 'combobox',
      textarea: 'textbox',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
      img: 'image',
      nav: 'navigation',
      main: 'main',
      header: 'banner',
      footer: 'contentinfo',
      section: 'region',
      article: 'article',
      aside: 'complementary',
      form: 'form',
      table: 'table',
      ul: 'list',
      ol: 'list',
      li: 'listitem',
      label: 'label',
    };

    return roleMap[tagName] || 'generic';
  };

  /**
   * Find label within custom component wrapper (ng-select, react-select, etc.)
   */
  const findLabelInCustomComponent = (element: HTMLElement): string | null => {
    // Look up to 5 levels in parent tree for custom component wrappers
    let current: HTMLElement | null = element;
    let depth = 0;

    while (current && depth < 5) {
      // Check if this is a custom component wrapper
      const className = current.className?.toLowerCase() || '';

      // Check for common custom component patterns
      const isCustomComponent =
        className.includes('vbeop-select') ||
        className.includes('ng-select') ||
        className.includes('react-select') ||
        className.includes('multiselect') ||
        className.includes('vue-select') ||
        className.includes('vbeop-input') ||
        className.includes('form-group') ||
        className.includes('field-wrapper') ||
        current.tagName.toLowerCase().includes('select');

      if (isCustomComponent) {
        // Found a custom component wrapper, look for label inside it
        const label = current.querySelector('label');
        if (label?.textContent?.trim()) {
          return label.textContent.trim();
        }
      }

      current = current.parentElement;
      depth++;
    }

    return null;
  };

  /**
   * Get accessible name/label for element (11-level priority system)
   */
  const getAccessibleName = (element: HTMLElement): string => {
    const tagName = element.tagName.toLowerCase();

    // PRIORITY 1: aria-label attribute
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel?.trim()) {
      return ariaLabel.trim();
    }

    // PRIORITY 2: Associated <label> element (check early for form fields)
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label?.textContent?.trim()) {
        return label.textContent.trim();
      }
    }

    // PRIORITY 2b: Find label in parent custom component wrapper
    // For custom selects like ng-select, react-select, vue-select
    if (['input', 'select', 'textarea'].includes(tagName) || element.getAttribute('role') === 'combobox') {
      const customComponentLabel = findLabelInCustomComponent(element);
      if (customComponentLabel) {
        return customComponentLabel;
      }
    }

    // PRIORITY 3: placeholder attribute
    const placeholder = element.getAttribute('placeholder');
    if (placeholder?.trim()) {
      return placeholder.trim();
    }

    // PRIORITY 4: title attribute
    const title = element.getAttribute('title');
    if (title?.trim()) {
      return title.trim();
    }

    // PRIORITY 5: alt attribute
    const alt = element.getAttribute('alt');
    if (alt?.trim()) {
      return alt.trim();
    }

    // PRIORITY 6: Select element - use selected option text (only if no label found)
    if (tagName === 'select') {
      const selectElement = element as HTMLSelectElement;
      const selectedOption =
        selectElement.querySelector('option[selected]') ||
        selectElement.options[selectElement.selectedIndex];

      if (selectedOption?.textContent) {
        return selectedOption.textContent.trim();
      }
    }

    // PRIORITY 7: Input value
    if (tagName === 'input') {
      const inputElement = element as HTMLInputElement;
      const inputType = element.getAttribute('type') || '';
      const value = element.getAttribute('value');

      if (inputType === 'submit' && value?.trim()) {
        return value.trim();
      }

      if (inputElement.value && inputElement.value.length < 50 && inputElement.value.trim()) {
        return inputElement.value.trim();
      }
    }

    // PRIORITY 8: Button/link text content
    if (['button', 'a', 'summary'].includes(tagName)) {
      let textContent = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          textContent += node.textContent;
        }
      }
      if (textContent.trim()) {
        return textContent.trim();
      }
    }

    // PRIORITY 9: Heading text content
    if (tagName.match(/^h[1-6]$/)) {
      const headingText = element.textContent;
      if (headingText?.trim()) {
        return headingText.trim().substring(0, 100);
      }
    }

    // PRIORITY 10: Image elements
    if (tagName === 'img') {
      return '';
    }

    // PRIORITY 11: Generic text content
    let genericText = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        genericText += node.textContent;
      }
    }

    if (genericText?.trim() && genericText.trim().length >= 3) {
      const trimmedText = genericText.trim();
      return trimmedText.length > 100
        ? trimmedText.substring(0, 100) + '...'
        : trimmedText;
    }

    return '';
  };

  /**
   * Check if element is visible
   */
  const isElementVisible = (element: HTMLElement): boolean => {
    const style = window.getComputedStyle(element);

    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    if (element.offsetWidth <= 0) return false;
    if (element.offsetHeight <= 0) return false;

    return true;
  };

  /**
   * Check if element is interactive
   */
  const isInteractiveElement = (element: HTMLElement): boolean => {
    const tagName = element.tagName.toLowerCase();

    const interactiveTags = [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'details',
      'summary',
    ];

    if (interactiveTags.includes(tagName)) return true;
    if (element.getAttribute('onclick') !== null) return true;
    if (element.getAttribute('tabindex') !== null) return true;
    if (element.getAttribute('role') === 'button') return true;
    if (element.getAttribute('role') === 'link') return true;
    if (element.getAttribute('contenteditable') === 'true') return true;

    return false;
  };

  /**
   * Check if element is semantic
   */
  const isSemanticElement = (element: HTMLElement): boolean => {
    const tagName = element.tagName.toLowerCase();

    const semanticTags = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'nav',
      'main',
      'header',
      'footer',
      'section',
      'article',
      'aside',
    ];

    if (semanticTags.includes(tagName)) return true;
    if (element.getAttribute('role') !== null) return true;

    return false;
  };

  /**
   * Check if element should be included in tree
   */
  const shouldIncludeElement = (element: HTMLElement, options: TreeOptions): boolean => {
    const tagName = element.tagName.toLowerCase();

    // Skip script, style, meta tags
    const excludedTags = ['script', 'style', 'meta', 'link', 'title', 'noscript'];
    if (excludedTags.includes(tagName)) return false;

    // Skip if aria-hidden
    if (
      options.filter !== 'all' &&
      element.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }

    // Skip if not visible
    if (options.filter !== 'all' && !isElementVisible(element)) {
      return false;
    }

    // Skip if not in viewport
    if (options.filter !== 'all' && !options.refId) {
      const rect = element.getBoundingClientRect();
      const inViewport =
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0;

      if (!inViewport) return false;
    }

    // If filter is "interactive", only include interactive elements
    if (options.filter === 'interactive') {
      return isInteractiveElement(element);
    }

    // Include if interactive, semantic, or has accessible name
    if (isInteractiveElement(element)) return true;
    if (isSemanticElement(element)) return true;
    if (getAccessibleName(element).length > 0) return true;

    // Include if has meaningful role
    const role = getRole(element);
    if (role && role !== 'generic' && role !== 'image') return true;

    return false;
  };

  /**
   * Traverse DOM and build tree
   */
  const traverseDOM = (
    element: HTMLElement,
    currentDepth: number,
    maxDepth: number,
    options: TreeOptions,
    outputLines: string[]
  ): void => {
    if (currentDepth > maxDepth) return;
    if (!element || !element.tagName) return;

    const shouldInclude =
      shouldIncludeElement(element, options) ||
      (options.refId !== null && currentDepth === 0);

    if (shouldInclude) {
      const role = getRole(element);
      let name = getAccessibleName(element);

      // Get or create reference ID
      let refId: string | null = null;

      // Check if element already has a ref_id
      for (const existingRefId in window.__claudeElementMap) {
        if (window.__claudeElementMap[existingRefId].deref() === element) {
          refId = existingRefId;
          break;
        }
      }

      // Create new ref_id if not found
      if (!refId) {
        refId = 'ref_' + ++window.__claudeRefCounter;
        window.__claudeElementMap[refId] = new WeakRef(element);
      }

      // Build output line
      let line = ' '.repeat(currentDepth) + role;

      // Add accessible name
      if (name) {
        name = name.replace(/\s+/g, ' ').substring(0, 100);
        name = name.replace(/"/g, '\\"');
        line += ' "' + name + '"';
      }

      // Add ref_id
      line += ' [' + refId + ']';

      // Add attributes
      const href = element.getAttribute('href');
      const type = element.getAttribute('type');
      const placeholder = element.getAttribute('placeholder');

      if (href) line += ' href="' + href + '"';
      if (type) line += ' type="' + type + '"';
      if (placeholder) line += ' placeholder="' + placeholder + '"';

      outputLines.push(line);
    }

    // Recurse into children
    if (element.children && currentDepth < maxDepth) {
      for (let i = 0; i < element.children.length; i++) {
        traverseDOM(
          element.children[i] as HTMLElement,
          shouldInclude ? currentDepth + 1 : currentDepth,
          maxDepth,
          options,
          outputLines
        );
      }
    }
  };

  /**
   * Main function: Generate accessibility tree
   */
  window.__generateAccessibilityTree = (
    filter: string = 'all',
    depth: number = 15,
    refId?: string
  ): AccessibilityTreeResult => {
    try {
      const outputLines: string[] = [];
      const maxDepth = depth;

      const options: TreeOptions = {
        filter: (filter as 'all' | 'interactive') || 'all',
        refId: refId || null,
      };

      // If refId provided, start from that element
      if (refId) {
        const weakRef = window.__claudeElementMap[refId];

        if (!weakRef) {
          return {
            error: `Element with ref_id '${refId}' not found. It may have been removed from the page.`,
            pageContent: '',
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          };
        }

        const element = weakRef.deref();

        if (!element) {
          return {
            error: `Element with ref_id '${refId}' no longer exists.`,
            pageContent: '',
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          };
        }

        traverseDOM(element, 0, maxDepth, options, outputLines);
      } else {
        // Traverse from document.body
        if (document.body) {
          traverseDOM(document.body, 0, maxDepth, options, outputLines);
        }
      }

      // Clean up dead WeakRefs
      for (const refId in window.__claudeElementMap) {
        if (!window.__claudeElementMap[refId].deref()) {
          delete window.__claudeElementMap[refId];
        }
      }

      const output = outputLines.join('\n');

      // Check output size limit
      if (output.length > 50000) {
        let errorMessage = `Output exceeds 50000 character limit (${output.length} characters). `;

        if (refId) {
          errorMessage +=
            'The specified element has too much content. Try specifying a smaller depth parameter.';
        } else {
          errorMessage +=
            'Try specifying a depth parameter (e.g., depth: 5) or use ref_id to focus on a specific element.';
        }

        return {
          error: errorMessage,
          pageContent: '',
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        };
      }

      return {
        pageContent: output,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
    } catch (error) {
      throw new Error(
        'Error generating accessibility tree: ' +
          ((error as Error).message || 'Unknown error')
      );
    }
  };
}


