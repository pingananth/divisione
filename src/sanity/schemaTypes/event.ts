import { defineField, defineType } from 'sanity'

export const eventSchema = defineType({
  name: 'event',
  title: 'Event',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
    }),
    defineField({
      name: 'dateTime',
      title: 'Date and Time',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      description: 'Physical address or link to virtual meeting (e.g. Zoom)',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Contest', value: 'contest' },
          { title: 'Training', value: 'training' },
          { title: 'Social', value: 'social' },
          { title: 'Meeting', value: 'meeting' },
        ],
      },
    }),
    defineField({
      name: 'area',
      title: 'Area',
      type: 'string',
      options: {
        list: [
          { title: 'E1', value: 'E1' },
          { title: 'E2', value: 'E2' },
          { title: 'E3', value: 'E3' },
          { title: 'E4', value: 'E4' },
          { title: 'Division Wide', value: 'division' },
        ],
      },
    }),
    defineField({
      name: 'registrationLink',
      title: 'Registration Link',
      type: 'url',
    }),
  ],
})
