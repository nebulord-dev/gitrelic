import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'GitRelic',
    description:
      'Git archaeology for your repository — churn, bus factor, hotspots, and cursed files.',
    base: '/gitrelic/',
    appearance: 'dark',
    lastUpdated: true,

    // Known future analyzer pages cross-linked from existing docs. Drop entries
    // as their pages land so genuine typos still surface in the build.
    ignoreDeadLinks: [
      '/analyzers/hotspots',
      '/analyzers/cursed-files',
      '/analyzers/churn-velocity',
      '/analyzers/rename-tracking',
      '/analyzers/coupling',
      '/analyzers/bus-factor',
      '/analyzers/commit-timing',
    ],

    themeConfig: {
      nav: [
        {
          text: 'Changelog',
          link: 'https://github.com/nebulord-dev/gitrelic/blob/main/CHANGELOG.md',
        },
        {
          text: 'Contributing',
          link: 'https://github.com/nebulord-dev/gitrelic/blob/main/CONTRIBUTING.md',
        },
      ],

      sidebar: [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [{ text: 'Introduction', link: '/guide/introduction' }],
        },
        {
          text: 'Guide',
          collapsed: false,
          items: [{ text: 'Core Concepts', link: '/guide/concepts' }],
        },
        {
          text: 'Analyzers',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/analyzers/' },
            { text: 'Blast Radius', link: '/analyzers/blast-radius' },
            { text: 'Churn', link: '/analyzers/churn' },
            { text: 'Rewrite Ratio', link: '/analyzers/rewrite-ratio' },
            { text: 'Shame', link: '/analyzers/shame' },
          ],
        },
        {
          text: 'Web Dashboard',
          collapsed: false,
          items: [{ text: 'Overview', link: '/dashboard/' }],
        },
        {
          text: 'Advanced',
          collapsed: false,
          items: [{ text: 'Overview', link: '/advanced/' }],
        },
      ],

      // No socialLinks — repo is private, would 404 for outsiders
      // Add { icon: 'github', link: '...' } when going public

      search: {
        provider: 'local',
      },

      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright 2026-present Nebulord',
      },
    },

    // Force pre-bundle of mermaid in dev so its CJS dayjs dep doesn't trip
    // Vite's ESM analysis. Build mode is unaffected.
    vite: {
      optimizeDeps: {
        include: ['mermaid'],
      },
    },
  }),
);
