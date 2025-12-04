import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Primitives.org.ai',
    },
    links: [
      {
        text: 'GitHub',
        url: 'https://github.com/dot-org-ai/primitives.org.ai',
      },
    ],
  };
}
