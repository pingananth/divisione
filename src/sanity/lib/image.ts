import createImageUrlBuilder from '@sanity/image-url'
import type { Image } from 'sanity'

const builder = createImageUrlBuilder({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'placeholder',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
})

export const urlFor = (source: Image) => {
  return builder.image(source)
}
