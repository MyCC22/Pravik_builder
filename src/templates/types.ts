export const TEMPLATE_IDS = [
  'landing-light',
  'landing-dark',
  'portfolio-minimal',
  'portfolio-bold',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

export const THEME_IDS = ['clean', 'bold', 'vibrant', 'warm'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export interface Feature {
  icon: string
  title: string
  description: string
}

export interface GalleryItem {
  title: string
  category: string
}

export interface Testimonial {
  quote: string
  name: string
  role: string
}

export interface PricingPlan {
  plan: string
  price: string
  features: string[]
  highlighted?: boolean
}

export interface NavLink {
  label: string
  href: string
}

export interface TemplateContent {
  siteName: string
  tagline: string
  heroTitle: string
  heroSubtitle: string
  ctaText?: string
  ctaUrl?: string
  features?: Feature[]
  galleryItems?: GalleryItem[]
  testimonials?: Testimonial[]
  pricing?: PricingPlan[]
  contactEmail?: string
  contactPhone?: string
  footerLinks?: NavLink[]
}

export interface TemplateConfig {
  template: TemplateId
  theme: ThemeId
  content: TemplateContent
}
