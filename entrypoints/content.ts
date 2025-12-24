import { initAccessibilityTree } from '@/src/lib/accessibility-tree';
import { enhanceTreeWithCustomSelectOptions } from '@/src/lib/tree-merger';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('🚀 ===== FILR CONTENT SCRIPT LOADED =====');
    console.log('🚀 Version: TREE-MERGER-ENABLED');

    // Initialize accessibility tree generator
    initAccessibilityTree();
    console.log('✅ Accessibility tree initialized');

    // Listen for messages from sidepanel
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'generateAccessibilityTree') {
        (async () => {
          try {
            // Step 1: Generate initial tree
            console.log('🌲 Generating initial accessibility tree...');
            const initialResult = window.__generateAccessibilityTree(
              message.filter || 'all',
              message.depth || 15,
              message.refId
            );

            console.log('✅ Initial tree generated');

            // Step 2: Enhance tree with custom select options
            let finalPageContent = initialResult.pageContent;

            if (message.expandCustomSelects !== false && !initialResult.error) {
              console.log('🔧 Starting tree enhancement with custom select options...');
              try {
                finalPageContent = await enhanceTreeWithCustomSelectOptions(
                  initialResult.pageContent
                );
                console.log('✅ Tree enhancement complete');
              } catch (enhanceError) {
                console.error('❌ Tree enhancement failed:', enhanceError);
                // Continue with original tree if enhancement fails
              }
            } else {
              console.log('⏭️ Skipping custom select enhancement');
            }

            // Step 3: Return enhanced result
            sendResponse({
              success: true,
              data: {
                ...initialResult,
                pageContent: finalPageContent,
              },
            });
          } catch (error) {
            console.error('❌ Error:', error);
            sendResponse({
              success: false,
              error: (error as Error).message,
            });
          }
        })();
        return true; // Keep the message channel open for async response
      }
    });
  },
});
