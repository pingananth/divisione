import { defineField, defineType } from 'sanity'

export const memberProfileSchema = defineType({
  name: 'memberProfile',
  title: 'Member Profile',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Full Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'e.g., Division Director, Area Director, Member',
    }),
    defineField({
      name: 'club',
      title: 'Home Club',
      type: 'string',
    }),
    defineField({
      name: 'professionalExpertise',
      title: 'Ask me about...',
      type: 'string',
      description: 'e.g., Career Advice, Mentoring, Tech',
    }),
    defineField({
      name: 'icebreaker',
      title: 'Icebreaker Fact',
      type: 'string',
      description: 'e.g., "I\'ve run 5 marathons"',
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
    }),
  ],
})
