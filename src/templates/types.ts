export const TEMPLATE_IDS = [
  'landing', 'landing-bold',
  'services', 'services-bold',
  'restaurant', 'restaurant-dark',
  'agency', 'agency-editorial',
  'event', 'event-dark',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

const LEGACY_TEMPLATE_MAP: Record<string, TemplateId> = {
  'landing-light': 'landing',
  'landing-dark': 'landing',
  'portfolio-minimal': 'agency',
  'portfolio-bold': 'agency-editorial',
}

export function resolveTemplateId(id: string): TemplateId {
  if (TEMPLATE_IDS.includes(id as TemplateId)) return id as TemplateId
  if (id in LEGACY_TEMPLATE_MAP) return LEGACY_TEMPLATE_MAP[id]
  return 'landing'
}

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
  imageUrl?: string
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

export interface ServiceItem {
  icon: string
  title: string
  description: string
}

export interface ProcessStep {
  step: string
  title: string
  description: string
}

export interface TeamMember {
  name: string
  role: string
  bio: string
}

export interface ClientLogo {
  name: string
}

export interface FAQItem {
  question: string
  answer: string
}

export interface MenuCategory {
  category: string
  items: MenuItem[]
}

export interface MenuItem {
  name: string
  description: string
  price: string
}

export interface HoursEntry {
  day: string
  hours: string
}

export interface ScheduleItem {
  time: string
  title: string
  speaker?: string
  description?: string
}

export interface Speaker {
  name: string
  topic: string
  bio: string
}

export interface StatItem {
  value: string
  label: string
}

export interface BeforeAfterItem {
  label: string
  before: string
  after: string
}

export interface TemplateContent {
  // Universal
  siteName: string
  tagline: string
  heroTitle: string
  heroSubtitle: string
  ctaText: string
  ctaUrl: string
  footerLinks?: NavLink[]

  // Images
  heroImageUrl?: string
  heroImageQuery?: string
  businessCategory?: string

  // Landing
  features?: Feature[]
  testimonials?: Testimonial[]
  pricing?: PricingPlan[]

  // Services
  services?: ServiceItem[]
  process?: ProcessStep[]
  faq?: FAQItem[]
  beforeAfter?: BeforeAfterItem[]
  bookingUrl?: string
  bookingText?: string

  // Restaurant
  menuItems?: MenuCategory[]
  hours?: HoursEntry[]
  address?: string

  // Agency
  team?: TeamMember[]
  clients?: ClientLogo[]
  galleryItems?: GalleryItem[]

  // Event
  schedule?: ScheduleItem[]
  speakers?: Speaker[]

  // Shared
  stats?: StatItem[]
  contactEmail?: string
  contactPhone?: string

  // Section headings (optional — sections use sensible defaults)
  servicesHeading?: string
  servicesSubheading?: string
  featuresHeading?: string
  featuresSubheading?: string
  contactHeading?: string
  contactSubheading?: string
  bookingHeading?: string
  bookingSubheading?: string
}

export interface TemplateConfig {
  template: TemplateId
  theme: ThemeId
  content: TemplateContent
}
