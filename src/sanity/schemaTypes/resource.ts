import { defineField, defineType } from 'sanity'

export const resourceSchema = defineType({
  name: 'resource',
  title: 'Resource Vault',
  type: 'document',
  fields: [
    defineField({
      name: 'fileName',
      title: 'File Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Scripts & Templates', value: 'scripts' },
          { title: 'Club Directory', value: 'directory' },
          { title: 'POSH & Safety', value: 'safety' },
          { title: 'Member Handbook', value: 'handbook' },
          { title: 'Other', value: 'other' },
        ],
      },
    }),
    defineField({
      name: 'fileType',
      title: 'File Type',
      type: 'string',
      options: {
        list: [
          { title: 'PDF', value: 'pdf' },
          { title: 'DOCX', value: 'docx' },
          { title: 'XLSX', value: 'xlsx' },
          { title: 'Template', value: 'template' },
        ],
      },
    }),
    defineField({
      name: 'fileUpload',
      title: 'File Upload',
      type: 'file',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
    }),
  ],
})
