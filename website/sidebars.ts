import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'doc',
      id: 'core-api',
      label: 'Core API',
    },
    'react',
    'integrations',
    'podcast-app-migration',
    'angular',
    'web-components',
    'roadmap',
    'issue-priority',
  ],
};

export default sidebars;
