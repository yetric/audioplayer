import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: '@yetric/audioplayer',
  tagline: 'Headless TypeScript audio player for modern browsers.',
  favicon: 'img/favicon.ico',
  future: {
    v4: true,
  },
  url: 'https://yetric.github.io',
  baseUrl: '/audioplayer/',
  organizationName: 'yetric',
  projectName: 'audioplayer',
  onBrokenLinks: 'throw',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/yetric/audioplayer/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '@yetric/audioplayer',
      logo: {
        alt: 'audioplayer',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/yetric/audioplayer',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Guides',
          items: [
            {
              label: 'Core API',
              to: '/docs/core-api',
            },
            {
              label: 'React',
              to: '/docs/react',
            },
            {
              label: 'Integrations',
              to: '/docs/integrations',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Migration',
              to: '/docs/podcast-app-migration',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/yetric/audioplayer',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Yetric AB.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
