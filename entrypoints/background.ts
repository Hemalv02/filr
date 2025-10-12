export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  // Enable the side panel on all sites (we will restrict this later)
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});
