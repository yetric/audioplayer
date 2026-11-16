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
    'timed-metadata',
    'destinations',
    'recipes',
    'migration',
    'support',
    'stability',
    'server-rendering',
    'angular',
    'web-components',
    'roadmap',
    'issue-priority',
  ],
};

export default sidebars;
