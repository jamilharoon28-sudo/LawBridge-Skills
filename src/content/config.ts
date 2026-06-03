import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),

    eyebrow: z.string().optional(),
    heading: z.string().optional(),
    description: z.string().optional(),

    hero: z
      .object({
        eyebrow: z.string().optional(),
        heading: z.string().optional(),
        description: z.string().optional(),
        primaryButtonText: z.string().optional(),
        primaryButtonLink: z.string().optional(),
        secondaryButtonText: z.string().optional(),
        secondaryButtonLink: z.string().optional(),
        tertiaryButtonText: z.string().optional(),
        tertiaryButtonLink: z.string().optional(),
      })
      .optional(),

    dashboard: z
      .object({
        label: z.string().optional(),
        heading: z.string().optional(),
        description: z.string().optional(),
        items: z.array(z.string()).optional(),
      })
      .optional(),

    sections: z.any().optional(),
    cards: z.any().optional(),
    buttons: z.any().optional(),
  }),
});

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    category: z.string().optional(),
    author: z.string().optional(),
  }),
});

const webinars = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    status: z.string().optional(),
    location: z.string().optional(),
  }),
});

const workshops = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    status: z.string().optional(),
    location: z.string().optional(),
  }),
});

const resources = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    type: z.string().optional(),
  }),
});

export const collections = {
  pages,
  blog,
  webinars,
  workshops,
  resources,
};
