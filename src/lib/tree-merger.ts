/**
 * Tree Merger - Merges custom select options into accessibility tree
 */

import { detectCustomSelects, openCustomSelect, closeCustomSelect } from './custom-select-expander';

interface TreeNode {
  line: string;
  refId: string;
  depth: number;
  element?: HTMLElement;
}

/**
 * Parse tree output into structured nodes
 */
function parseTree(treeOutput: string): TreeNode[] {
  const lines = treeOutput.split('\n');
  const nodes: TreeNode[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Calculate depth by counting leading spaces
    const depth = line.search(/\S/);

    // Extract ref_id
    const refMatch = line.match(/\[ref_(\d+)\]/);
    const refId = refMatch ? `ref_${refMatch[1]}` : '';

    nodes.push({
      line,
      refId,
      depth,
    });
  }

  return nodes;
}

/**
 * Build tree output from nodes
 */
function buildTree(nodes: TreeNode[]): string {
  return nodes.map((node) => node.line).join('\n');
}

/**
 * Find combobox nodes in the tree
 */
function findComboboxNodes(nodes: TreeNode[]): TreeNode[] {
  const comboboxes = nodes.filter((node) => {
    const trimmed = node.line.trim();
    return trimmed.startsWith('combobox ') || trimmed.includes('role="combobox"');
  });

  console.log(`Found ${comboboxes.length} combobox nodes:`, comboboxes.map(n => n.refId));
  return comboboxes;
}

/**
 * Get element from ref_id
 */
function getElement(refId: string): HTMLElement | null {
  const weakRef = (window as any).__claudeElementMap?.[refId];
  return weakRef?.deref() || null;
}

/**
 * Generate tree for a specific element (when it's open with options visible)
 */
function generateTreeForElement(element: HTMLElement, baseDepth: number): TreeNode[] {
  const nodes: TreeNode[] = [];

  // Find all option elements - try multiple selectors
  let options: HTMLElement[] = [];

  console.log(`Looking for options...`);

  // Try finding in ng-dropdown-panel (Angular ng-select)
  const dropdownPanel = document.querySelector('.ng-dropdown-panel');
  if (dropdownPanel) {
    console.log(`Found .ng-dropdown-panel`);
    const ngOptions = Array.from(dropdownPanel.querySelectorAll<HTMLElement>('[role="option"], .ng-option'));
    console.log(`Found ${ngOptions.length} ng-select options`);
    options.push(...ngOptions);
  }

  // Try finding in react-select menu
  if (options.length === 0) {
    const reactMenu = document.querySelector('.react-select__menu');
    if (reactMenu) {
      console.log(`Found .react-select__menu`);
      const reactOptions = Array.from(reactMenu.querySelectorAll<HTMLElement>('[role="option"], .react-select__option'));
      console.log(`Found ${reactOptions.length} react-select options`);
      options.push(...reactOptions);
    }
  }

  // Try finding in vue multiselect
  if (options.length === 0) {
    const vueContent = element.querySelector('.multiselect__content');
    if (vueContent) {
      console.log(`Found .multiselect__content`);
      const vueOptions = Array.from(vueContent.querySelectorAll<HTMLElement>('.multiselect__option'));
      console.log(`Found ${vueOptions.length} vue-select options`);
      options.push(...vueOptions);
    }
  }

  // Generic fallback - try finding any [role="option"] in document
  if (options.length === 0) {
    console.log(`Trying generic [role="option"] selector in document`);
    const genericOptions = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
    console.log(`Found ${genericOptions.length} generic options`);
    options.push(...genericOptions);
  }

  // Filter out invisible options
  options = options.filter((opt) => {
    const style = window.getComputedStyle(opt);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    if (!isVisible) {
      console.log(`Filtering out invisible option: ${opt.textContent?.trim()}`);
    }
    return isVisible;
  });

  console.log(`Total visible options found: ${options.length}`);

  options.forEach((option) => {
    // Get or create ref for this option
    let refId: string | null = null;

    // Check if option already has a ref
    for (const existingRefId in (window as any).__claudeElementMap) {
      if ((window as any).__claudeElementMap[existingRefId].deref() === option) {
        refId = existingRefId;
        break;
      }
    }

    // Create new ref if not found
    if (!refId) {
      refId = `ref_${++(window as any).__claudeRefCounter}`;
      (window as any).__claudeElementMap[refId] = new WeakRef(option);
    }

    // Get option text
    const text = option.textContent?.trim() || '';
    const sanitizedText = text.replace(/\s+/g, ' ').substring(0, 100).replace(/"/g, '\\"');

    // Build line with proper indentation
    const indent = ' '.repeat(baseDepth + 1);
    const line = `${indent}generic "${sanitizedText}" [${refId}]`;

    console.log(`Adding option: ${sanitizedText}`);

    nodes.push({
      line,
      refId,
      depth: baseDepth + 1,
      element: option,
    });
  });

  return nodes;
}

/**
 * Insert option nodes after a combobox node
 */
function insertOptionsAfterCombobox(
  nodes: TreeNode[],
  comboboxIndex: number,
  optionNodes: TreeNode[]
): TreeNode[] {
  const result = [...nodes];

  // Find where to insert (after combobox, before next sibling at same depth)
  const comboboxDepth = nodes[comboboxIndex].depth;
  let insertIndex = comboboxIndex + 1;

  // Skip existing children
  while (
    insertIndex < result.length &&
    result[insertIndex].depth > comboboxDepth
  ) {
    insertIndex++;
  }

  // Insert option nodes
  result.splice(insertIndex, 0, ...optionNodes);

  return result;
}

/**
 * Main function: Enhance tree with custom select options
 */
export async function enhanceTreeWithCustomSelectOptions(
  initialTree: string
): Promise<string> {
  console.log('🎯 === TREE ENHANCEMENT FUNCTION CALLED ===');
  console.log('Initial tree length:', initialTree.length);
  console.log('Initial tree preview:', initialTree.substring(0, 200));

  // Parse initial tree
  let nodes = parseTree(initialTree);
  console.log(`Parsed ${nodes.length} nodes from tree`);

  // Find all combobox nodes
  const comboboxNodes = findComboboxNodes(nodes);

  console.log(`Found ${comboboxNodes.length} combobox nodes in tree`);

  // Detect custom selects on page
  const customSelects = detectCustomSelects();

  console.log(`Found ${customSelects.length} custom select components on page`);

  // Process each combobox
  for (let i = 0; i < comboboxNodes.length; i++) {
    const comboboxNode = comboboxNodes[i];
    console.log(`\n=== Processing combobox ${i + 1}/${comboboxNodes.length}: ${comboboxNode.refId} ===`);
    console.log(`Combobox line: ${comboboxNode.line.trim()}`);

    const element = getElement(comboboxNode.refId);

    if (!element) {
      console.log(`❌ Element not found for ${comboboxNode.refId}`);
      continue;
    }

    console.log(`✅ Element found:`, element.tagName, element.className);

    // Find the custom select that contains this element
    const customSelect = customSelects.find((select) =>
      select.container.contains(element) || element.contains(select.container)
    );

    if (!customSelect) {
      console.log(`❌ No custom select found for ${comboboxNode.refId}`);
      console.log(`Available custom selects:`, customSelects.map(s => s.type));
      continue;
    }

    console.log(`✅ Found custom select of type: ${customSelect.type}`);

    try {
      console.log(`🔓 Opening custom select for ${comboboxNode.refId}`);

      // Open the custom select
      const opened = await openCustomSelect(customSelect);

      if (!opened) {
        console.log(`❌ Failed to open ${comboboxNode.refId}`);
        continue;
      }

      console.log(`✅ Custom select opened`);

      // Wait for options to render and animations to complete
      await sleep(500);

      // Generate tree for the options
      console.log(`📋 Generating tree for options...`);
      const optionNodes = generateTreeForElement(
        customSelect.container,
        comboboxNode.depth
      );

      console.log(`✅ Found ${optionNodes.length} options for ${comboboxNode.refId}`);

      // Close the custom select
      console.log(`🔒 Closing custom select`);
      await closeCustomSelect(customSelect);
      await sleep(100);

      // Insert options into tree
      if (optionNodes.length > 0) {
        // Find current index of this combobox in the nodes array
        const currentIndex = nodes.findIndex(
          (n) => n.refId === comboboxNode.refId
        );

        if (currentIndex !== -1) {
          console.log(`📝 Inserting ${optionNodes.length} options after combobox at index ${currentIndex}`);
          nodes = insertOptionsAfterCombobox(nodes, currentIndex, optionNodes);
          console.log(`✅ Options inserted successfully`);
        } else {
          console.log(`❌ Could not find combobox node in array`);
        }
      } else {
        console.log(`⚠️ No options found to insert`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${comboboxNode.refId}:`, error);
    }
  }

  // Build enhanced tree
  const enhancedTree = buildTree(nodes);

  console.log('Tree enhancement complete');

  return enhancedTree;
}

/**
 * Helper: Sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

