import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Filr',
    action: {
      default_title: 'Open Filr Side Panel',
    },
    permissions: ['scripting', 'tabs', 'downloads'],
    host_permissions: ['<all_urls>'],
  },
});
