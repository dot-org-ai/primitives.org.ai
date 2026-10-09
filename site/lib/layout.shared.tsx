import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { OrgAiMark } from './org-ai-mark';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <OrgAiMark />
          Primitives.org.ai
        </>
      ),
    },
    links: [
      { text: 'MDXLD', url: 'https://mdx.org.ai', external: true },
      { text: 'schema.org.ai', url: 'https://schema.org.ai', external: true },
      { text: 'The Org.AI Foundation', url: 'https://foundation.org.ai', external: true },
    ],
    githubUrl: 'https://github.com/dot-org-ai/primitives.org.ai',
    // dark only, as every Org.AI Foundation site is: no light theme to switch to
    themeSwitch: { enabled: false },
  };
}
