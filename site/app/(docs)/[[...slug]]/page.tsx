import { getPageImage, source } from '@/lib/source'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { notFound } from 'next/navigation'
import { getMDXComponents } from '@/mdx-components'
import type { Metadata } from 'next'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { Feedback } from '@/components/feedback'

export default async function Page(props: PageProps<'/[[...slug]]'>) {
  const params = await props.params
  const page = source.getPage(params.slug ?? [])
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full ?? false}>
      <DocsTitle className="fd-title">{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
        <Feedback url={page.url} />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: PageProps<'/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug ?? [])
  if (!page) notFound()

  /* Every docs page gets its own generated card from app/og/[...slug]. The
     home page is the exception: it is the one the estate links to, and it has
     a hand-built card of its own in the root layout. Overriding it here would
     replace that card with the generic template. */
  const isHome = (params.slug ?? []).length === 0

  return {
    title: page.data.title,
    description: page.data.description,
    ...(isHome ? {} : { openGraph: { images: getPageImage(page).url } }),
  }
}
