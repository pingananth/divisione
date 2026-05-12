import { type SchemaTypeDefinition } from 'sanity'
import { eventSchema } from './event'
import { memberProfileSchema } from './memberProfile'
import { noticeSchema } from './notice'
import { resourceSchema } from './resource'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [eventSchema, memberProfileSchema, noticeSchema, resourceSchema],
}
