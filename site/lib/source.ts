import { docs } from 'fumadocs-mdx:collections/server';
import { type InferPageType, loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';
import { createElement } from 'react';

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  // Custom icon resolver that safely handles lucide icons
  icon(iconName) {
    if (!iconName) return undefined;
    const IconComponent = icons[iconName as keyof typeof icons];
    if (!IconComponent) {
      // Icon not found in lucide-react - return undefined instead of throwing
      return undefined;
    }
    return createElement(IconComponent);
  },
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/${segments.join('/')}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primitives.org.ai';
  const processed = await page.data.getText('processed');

  return `# ${page.data.title}

URL: ${baseUrl}${page.url}
${page.data.description ? `\n> ${page.data.description}\n` : ''}
${processed}`;
}
