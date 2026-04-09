import { z } from 'zod';

// Schema for individual annotations (highlights, notes, etc.)
export const AnnotationSchema = z.object({
  id: z.string().optional().default(() => Math.random().toString(36).substring(7)),
  pageIndex: z.number(),
  type: z.enum(['highlight', 'underline', 'box', 'note']).default('highlight'),
  color: z.string().optional().default('#ff0000'),
  x: z.number().optional().default(0),
  y: z.number().optional().default(0),
  width: z.number().optional().default(0),
  height: z.number().optional().default(0),
  text: z.string().optional().default(''),
  title: z.string().optional().default(''),
  chapter: z.string().optional(),
  createdAt: z.number().optional().default(() => Date.now()),
});

// Schema for individual books within a shelf
export const BookExportSchema = z.object({
  id: z.string().optional().default(() => Math.random().toString(36).substring(7)),
  title: z.string().min(1, 'Book title cannot be empty'),
  author: z.string().optional().default('Unknown Author'),
  cover: z.string().optional(), // Base64 or URL
  content: z.string().optional(), // Base64 encoded PDF content
  annotations: z.array(AnnotationSchema).optional().default([]),
  stars: z.number().optional().default(0),
  lastPage: z.number().optional().default(0),
  addedAt: z.number().optional().default(() => Date.now()),
});

// Schema for the entire community shelf export (JSON file)
export const CommunityShelfExportSchema = z.object({
  version: z.string().optional().default('1.0.0'),
  // Made exportedAt more flexible: accepts any string or defaults to current date
  exportedAt: z.string().optional().default(() => new Date().toISOString()),
  shelfName: z.string().min(1, 'Shelf name cannot be empty'),
  shelfColor: z.string().optional().default('#000a00'),
  userName: z.string().optional().default('Anonymous'),
  books: z.array(BookExportSchema).optional().default([]),
});

// Types derived from schemas
export type Annotation = z.infer<typeof AnnotationSchema>;
export type BookExport = z.infer<typeof BookExportSchema>;
export type CommunityShelfExport = z.infer<typeof CommunityShelfExportSchema>;
