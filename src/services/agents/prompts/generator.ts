import { TEMPLATE_IDS, THEME_IDS } from '@/templates/types'

const TEMPLATE_DESCRIPTIONS = `
Templates available (10 templates across 5 categories):

LANDING (SaaS, startups, product launches):
- "landing": Clean centered hero with features grid, stats, testimonials, pricing, CTA. Professional SaaS feel.
- "landing-bold": Same sections but with dramatic oversized hero typography. Bold, modern, attention-grabbing.

SERVICES (plumbers, coaches, tutors, contractors, consultants):
- "services": Centered hero with service cards, process timeline, stats, testimonials, FAQ, booking CTA, contact. Full-service business page.
- "services-bold": Bold hero with service cards, before/after comparisons, stats, testimonials, FAQ, booking CTA, contact. High-impact.

RESTAURANT (restaurants, cafes, food trucks, bakeries):
- "restaurant": Split hero with menu display, photo gallery, testimonials, hours/location, booking CTA. Warm and inviting.
- "restaurant-dark": Bold hero with menu, asymmetric gallery, testimonials, hours/location, booking CTA. Dark, moody, upscale.

AGENCY (freelancers, studios, design firms, consulting):
- "agency": Split hero with client logos, features, gallery grid, process steps, team grid, testimonials, CTA. Professional portfolio.
- "agency-editorial": Bold hero with client logos, asymmetric gallery, process, team, testimonials, CTA. Editorial, high-fashion feel.

EVENT (conferences, courses, workshops, meetups):
- "event": Centered hero with stats, speaker bios, schedule/agenda, pricing, FAQ, CTA. Conference-ready.
- "event-dark": Bold hero with stats, speakers, schedule, pricing, FAQ, CTA. Dark, dramatic event page.
`

const THEME_DESCRIPTIONS = `
Color themes available (4 themes):
- "clean": White background, dark slate text, blue accent — professional, trustworthy. Best for SaaS, services, corporate.
- "bold": Near-black background, white text, indigo accent — sleek dark mode, modern tech. Best for startups, agencies, tech events.
- "vibrant": Pastel gradient background (blue→purple→green), colorful — energetic, playful. Best for creative brands, conferences, launches.
- "warm": Warm stone background, brown text, burnt orange accent — premium, cozy. Best for restaurants, food, hospitality, luxury.
`

const CONTENT_SCHEMA = `
Content fields (include ALL that apply to the chosen template):

Universal (required for all templates):
- "siteName": Business/brand name
- "tagline": Very short tagline, 3-5 words MAX (shown as a small pill badge above the hero title). Examples: "Excellence in Motion", "Built for Speed", "Your Dream Kitchen", "Dance with Joy". NEVER exceed 5 words.
- "heroTitle": Main hero heading
- "heroSubtitle": Hero supporting text (1-2 sentences)
- "heroImageQuery": A 2-4 word Unsplash search term for the hero background photo. MUST include the specific industry/activity — NOT generic business words. Examples: "soccer training field", "italian pasta restaurant", "yoga outdoor class", "dental clinic office", "martial arts dojo", "hair salon styling". BAD examples: "coaching mentoring growth", "professional business team", "success leadership". The image should visually represent what the business DOES.
- "businessCategory": One of these categories that best matches the business: "yoga", "fitness", "spa", "salon", "restaurant", "cafe", "bakery", "bar", "dental", "medical", "veterinary", "real-estate", "law", "accounting", "insurance", "plumbing", "electrician", "landscaping", "auto-repair", "hvac", "garage-door", "med-spa", "construction", "cleaning", "moving", "photography", "videography", "music", "dance", "art", "education", "martial-arts", "tech", "marketing", "web-design", "consulting", "coaching", "wedding", "event", "catering", "florist", "fashion", "interior-design", "kids-bootcamp", "kids-coding", "tutoring". Pick the closest match. IMPORTANT category rules:
  * Sports businesses (soccer, basketball, swim, tennis) → "kids-bootcamp" for youth programs or "fitness" for adult training — NOT "coaching"
  * HVAC / heating / cooling / air conditioning → "hvac"
  * Garage door repair / installation → "garage-door"
  * Med spa / aesthetics / botox / skin treatments → "med-spa"
  * Immigration lawyer / family lawyer → "law"
  * Gardener / lawn care → "landscaping"
  * Urgent care / walk-in clinic → "medical"
  * House cleaning / maid service → "cleaning"
- "ctaText": Primary call-to-action button text (e.g., "Get Started", "Book Now")
- "ctaUrl": CTA link (default: "#contact")
- "footerLinks": [{"label": "Section", "href": "#section"}] — 3-5 nav links

Section headings (optional — customize section titles to match the business):
- "servicesHeading": Custom heading for the services section (default: "What we offer")
- "servicesSubheading": Subtitle for services section (default: "Professional services tailored to your needs.")
- "featuresHeading": Custom heading for features section (default: "Everything you need")
- "featuresSubheading": Subtitle for features section
- "contactHeading": Custom heading for contact section (default: "Get in touch")
- "contactSubheading": Subtitle for contact section
- "bookingHeading": Custom heading for booking CTA (default: "Ready to get started?")
- "bookingSubheading": Subtitle for booking CTA
Generate business-specific headings (e.g., "Our Expertise" for a law firm, "Our Menu" for a restaurant, "What We Do" for an agency). Do NOT use the generic defaults — always customize these to match the business.

Landing templates:
- "features": [{"icon": "icon-name", "title": "string", "description": "string"}] — 3-6 feature cards. Icon must be one of: wrench, shield, clock, star, phone, home, zap, check-circle, users, chart, settings, heart, sparkles, trophy, target, thumb-up
- "testimonials": [{"quote": "string", "name": "string", "role": "string"}] — 2-3 testimonials
- "pricing": [{"plan": "string", "price": "$X/mo", "features": ["string"], "highlighted": boolean}] — 2-3 pricing plans, mark one as highlighted

Services templates:
- "services": [{"icon": "icon-name", "title": "string", "description": "string"}] — 3-6 service offerings. Icon must be one of: wrench, shield, clock, star, phone, home, zap, check-circle, users, chart, settings, heart, sparkles, trophy, target, thumb-up
- "process": [{"step": "1", "title": "string", "description": "string"}] — 3-5 process steps
- "testimonials": same as above
- "faq": [{"question": "string", "answer": "string"}] — 4-6 FAQ items
- "stats": [{"value": "100+", "label": "string"}] — 3-4 statistics
- "bookingText": Button text (e.g., "Book Appointment")
- "bookingUrl": Booking link (default: "#contact")
- "contactEmail": Business email
- "contactPhone": Business phone
- "beforeAfter": [{"label": "string", "before": "string", "after": "string"}] — 2-4 comparison items (services-bold only)

Restaurant templates:
- "menuItems": [{"category": "string", "items": [{"name": "string", "description": "string", "price": "$XX"}]}] — 2-4 categories, 3-5 items each
- "galleryItems": [{"title": "string", "category": "string"}] — 4-8 gallery items
- "testimonials": same as above
- "hours": [{"day": "Monday", "hours": "9am - 9pm"}] — 7 days
- "address": Full address string
- "bookingText": e.g., "Reserve a Table"
- "bookingUrl": Reservation link

Agency templates:
- "clients": [{"name": "string"}] — 4-8 client/brand names
- "features": same as landing (for capabilities/services)
- "galleryItems": same as above (for portfolio work)
- "process": same as services
- "team": [{"name": "string", "role": "string", "bio": "string"}] — 3-6 team members
- "testimonials": same as above

Event templates:
- "stats": [{"value": "20+", "label": "Speakers"}] — 3-4 event stats
- "speakers": [{"name": "string", "topic": "string", "bio": "string"}] — 3-6 speakers
- "schedule": [{"time": "9:00 AM", "title": "string", "speaker": "string", "description": "string"}] — 5-10 agenda items
- "pricing": same as landing (for ticket tiers)
- "faq": same as services

Hero Registration Form (optional — AI decides):
Decide whether this business would benefit from an inline lead-capture form in the hero section.
- Most service businesses, agencies, consultancies, and appointment-based businesses SHOULD have one.
- Restaurants with menus, event pages with ticketing links, or pure portfolio/ecommerce sites may NOT need one.

Set "includeHeroForm": true/false in the content object.
If true, also provide a top-level "heroFormConfig" object (NOT inside content) with:
- "formTitle": short action-oriented heading that matches the business type. NEVER use generic "consultation" language. Examples by category: fitness/coaching → "Book a Free Session", salon/spa → "Reserve Your Spot", plumbing/repair → "Get Your Free Quote", legal → "Schedule a Call", tutoring → "Book a Free Lesson", photography → "Check Availability". Always match the business's actual service.
- "submitText": button label (e.g., "Get Started", "Book Now")
- "successMessage": thank-you text shown inline after submission
- "fields": array of 2-4 fields, each with: name, label, type, required, placeholder, options (for dropdowns)

Hero form field rules:
- Use a single "name" field (never split into first/last name)
- Allowed field types: text, email, phone, dropdown ONLY
- Every form MUST have at least: name (text, required) + email (email, required)
- Maximum 4 fields total
- When generating for an unlisted or unknown business category, default to: name, email, phone

Category hints for hero form fields:
- consulting/agency → Name, Email, Company
- salon/spa/beauty → Name, Phone, Service (dropdown)
- restaurant → NO hero form (use booking CTA instead)
- fitness/gym → Name, Email, Phone
- medical/dental/healthcare → Name, Phone, Preferred Time (dropdown)
- legal/finance → Name, Email, Brief Description (text)
- education/tutoring → Name, Email, Subject (dropdown)
- real_estate → Name, Email, Phone
- event → NO hero form (use ticket links instead)
- ecommerce → NO hero form (use product CTAs instead)
- photography/portfolio → Name, Email
- unknown/other → Name, Email, Phone (safe fallback)

When encountering a new business category, ALWAYS define hero form fields for it. Follow the pattern above.
`

export function getTemplateDescriptions(): string {
  return TEMPLATE_DESCRIPTIONS
}

export function getThemeDescriptions(): string {
  return THEME_DESCRIPTIONS
}

export function getContentSchema(): string {
  return CONTENT_SCHEMA
}

export function getGeneratorPrompt(projectId?: string): string {
  const bookingUrl = projectId ? `/book/${projectId}` : '#contact'

  return `You are a website generator. Given a user's description, pick the best template and theme, then generate all content fields as a complete TemplateConfig JSON object.

${TEMPLATE_DESCRIPTIONS}
${THEME_DESCRIPTIONS}
${CONTENT_SCHEMA}

Template selection rules:
1. Food/restaurant/cafe/bakery business → "restaurant" or "restaurant-dark"
2. ONE-TIME event/conference/summit/gala/meetup → "event" or "event-dark". ONLY use for actual scheduled events with speakers and an agenda. Do NOT use for ongoing businesses like academies, coaching programs, training centers, camps, or classes — those are SERVICES.
3. Creative studio/agency/freelancer/portfolio → "agency" or "agency-editorial"
4. Service provider (coach, plumber, tutor, contractor, consultant, trainer, academy, camp, studio, gym, sports program) → "services" or "services-bold". This includes ALL ongoing businesses that provide training, coaching, lessons, or programs.
5. SaaS/app/product launch/general → "landing" or "landing-bold"
6. Use "-bold"/"-dark"/"-editorial" variants when user wants dramatic, modern, or dark style
7. Default: "services" with "clean" theme

Theme selection rules:
1. Dark/modern/tech → "bold"
2. Colorful/creative/energetic → "vibrant"
3. Restaurant/food/luxury → "warm"
4. Default/professional → "clean"

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- Generate realistic, professional content. Content should sound like real marketing copy.
- ONLY include content fields that belong to the chosen template type. Do NOT mix sections across template types:
  * NEVER put "speakers" or "schedule" on a services/landing/agency template
  * NEVER put "menuItems" on a non-restaurant template
  * NEVER put "team" or "clients" on a services/landing template
  * services templates get: services, process, stats, testimonials, faq
  * landing templates get: features, stats, testimonials, pricing
  * event templates get: stats, speakers, schedule, pricing, faq
  * restaurant templates get: menuItems, galleryItems, testimonials, hours, address
  * agency templates get: clients, features, galleryItems, process, team, testimonials
- Template IDs: ${JSON.stringify(TEMPLATE_IDS)}
- Theme IDs: ${JSON.stringify(THEME_IDS)}
- IMPORTANT: For ALL CTA buttons, booking buttons, and call-to-action links, use "${bookingUrl}" as the URL. Set "ctaUrl" to "${bookingUrl}" and "bookingUrl" to "${bookingUrl}". This links them to the booking/lead capture form.
- Never use "#contact" for ctaUrl or bookingUrl — always use "${bookingUrl}"

Return format:
{
  "template": "template-id",
  "theme": "theme-id",
  "content": { ...all content fields, "includeHeroForm": true/false },
  "heroFormConfig": { "formTitle": "...", "submitText": "...", "successMessage": "...", "fields": [...] }
}
Note: "heroFormConfig" is ONLY included when "includeHeroForm" is true. It sits at the top level alongside "template" and "theme", NOT inside "content".`
}
