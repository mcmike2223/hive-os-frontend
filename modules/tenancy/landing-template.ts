export type TenantLandingTheme = {
  accent: string;
  accent_soft: string;
  surface: string;
  canvas: string;
  panel?: string;
  text?: string;
  muted?: string;
};

export type TenantLandingRendering = {
  mode: "structured" | "custom_code" | "raw_package";
  html: string;
  css: string;
  js: string;
  asset_base_url: string;
};

export type TenantLandingHeroSlide = {
  image: string;
  title: string;
  subtitle: string;
  badge: string;
};

export type TenantLandingHero = {
  eyebrow: string;
  title: string;
  description: string;
  primary_label: string;
  primary_href: string;
  secondary_label: string;
  secondary_href: string;
  announcement?: string;
  slides?: TenantLandingHeroSlide[];
};

export type TenantLandingStat = {
  value: string;
  label: string;
};

export type TenantLandingCard = {
  kicker: string;
  title: string;
  description: string;
  image?: string;
};

export type TenantLandingSpotlightItem = {
  title: string;
  description: string;
};

export type TenantLandingSpotlight = {
  heading: string;
  description: string;
  items: TenantLandingSpotlightItem[];
};

export type TenantLandingTestimonial = {
  quote: string;
  author: string;
  role: string;
};

export type TenantLandingFinalCta = {
  title: string;
  description: string;
  primary_label: string;
  primary_href: string;
  secondary_label: string;
  secondary_href: string;
};

export type TenantLandingMenus = {
  eyebrow?: string;
  title?: string;
  description_eyebrow?: string;
  description?: string;
  image_url?: string;
  model_3d_url?: string;
};

export type TenantLandingServiceCard = {
  title: string;
  description: string;
  image?: string;
};

export type TenantLandingServicesSection = {
  eyebrow?: string;
  title?: string;
};

export type TenantLandingFaq = {
  question: string;
  answer: string;
};

export type TenantLandingGallery = {
  eyebrow?: string;
  title?: string;
  images?: string[];
};

export type TenantLandingCellarItem = {
  title: string;
  description: string;
};

export type TenantLandingCellar = {
  eyebrow?: string;
  title?: string;
  description?: string;
  image?: string;
  items?: TenantLandingCellarItem[];
};

export type TenantLandingExperience = {
  eyebrow?: string;
  title?: string;
  description?: string;
  image?: string;
  featured_badge?: string;
  featured_title?: string;
  featured_description?: string;
};

export type TenantLandingLocationInfo = {
  hours?: string[];
  address?: string[];
  phone?: string;
  map_url?: string;
};

export type TenantLandingGuestlist = {
  eyebrow?: string;
  title?: string;
  description?: string;
  cta?: string;
};

export type TenantLandingTemplateMeta = {
  business_type?: string;
  business_label?: string;
  template_key?: string;
  template_label?: string;
  template_description?: string;
  is_custom?: boolean;
};

export type TenantLandingTemplate = {
  version: number;
  meta?: TenantLandingTemplateMeta;
  theme: TenantLandingTheme;
  hero: TenantLandingHero;
  stats: TenantLandingStat[];
  highlights: TenantLandingCard[];
  spotlight: TenantLandingSpotlight;
  testimonials: TenantLandingTestimonial[];
  final_cta: TenantLandingFinalCta;
  rendering: TenantLandingRendering;
  menus?: TenantLandingMenus;
  marquee?: string[];
  services?: TenantLandingServiceCard[];
  services_section?: TenantLandingServicesSection;
  faqs?: TenantLandingFaq[];
  gallery?: TenantLandingGallery;
  cellar?: TenantLandingCellar;
  experience?: TenantLandingExperience;
  location_info?: TenantLandingLocationInfo;
  guestlist?: TenantLandingGuestlist;
};

export type TenantLandingTemplateVariant = {
  key: string;
  label: string;
  description: string;
  template: TenantLandingTemplate;
};

export type TenantBusinessTypeDefinition = {
  key: string;
  label: string;
  description: string;
  icon: string;
  default_template_key?: string;
  default_template: TenantLandingTemplate;
  templates?: TenantLandingTemplateVariant[];
};

export const FALLBACK_TENANT_LANDING_TEMPLATE: TenantLandingTemplate = {
  version: 1,
  theme: {
    accent: "#0f766e",
    accent_soft: "#ccfbf1",
    surface: "#f0fdfa",
    canvas: "linear-gradient(135deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)",
    panel: "rgba(255,255,255,0.82)",
    text: "#0f172a",
    muted: "#475569",
  },
  hero: {
    eyebrow: "Business Landing",
    title: "Build a homepage that makes the business feel sharp before the first conversation starts.",
    description: "This editable landing template is tuned for clarity, credibility, and fast action across service-first brands.",
    primary_label: "Open Workspace",
    primary_href: "/sign-in",
    secondary_label: "Explore What We Offer",
    secondary_href: "#offers",
    announcement: "Use this as the public face of your tenant and tailor every line inside the admin editor.",
  },
  stats: [
    { value: "24/7", label: "always-on discovery" },
    { value: "3 clicks", label: "to a clear next step" },
    { value: "Editable", label: "inside admin" },
  ],
  highlights: [
    {
      kicker: "Positioning",
      title: "Lead with a stronger first impression",
      description: "Use a tighter headline, better visual rhythm, and clearer calls to action to shape perception fast.",
    },
    {
      kicker: "Clarity",
      title: "Tell visitors what matters in seconds",
      description: "Structure the page so people understand your offer, proof points, and next step quickly.",
    },
    {
      kicker: "Momentum",
      title: "Turn interest into action",
      description: "Guide prospects toward booking, inquiry, sign-in, or direct contact with less friction.",
    },
  ],
  spotlight: {
    heading: "What this template is designed to do",
    description: "The structure works especially well when the business needs to look polished, modern, and easy to understand.",
    items: [
      {
        title: "Present the offer crisply",
        description: "Use the hero and feature blocks to explain your strongest value without clutter.",
      },
      {
        title: "Show proof early",
        description: "Stats and testimonials reinforce trust before a visitor decides to act.",
      },
      {
        title: "Keep editing simple",
        description: "Every section is stored as editable JSON so admins can tune copy without touching code.",
      },
    ],
  },
  testimonials: [
    {
      quote: "This template gave us a much stronger public face without a full redesign cycle.",
      author: "Operations Team",
      role: "Default Testimonial",
    },
    {
      quote: "The structure makes it easy to explain what we do and move visitors toward the next step.",
      author: "Growth Team",
      role: "Default Testimonial",
    },
  ],
  final_cta: {
    title: "Give your tenant a sharper landing experience.",
    description: "Select a business preset, refine the copy in admin, and publish a homepage that feels purpose-built.",
    primary_label: "Open Portal",
    primary_href: "/sign-in",
    secondary_label: "Jump to Services",
    secondary_href: "#offers",
  },
  rendering: {
    mode: "structured",
    html: "",
    css: "",
    js: "",
    asset_base_url: "",
  },
  menus: {
    eyebrow: "Menus",
    title: "Explore Our Menus in 3D",
    description_eyebrow: "Interactive Experience",
    description: "Interact directly with our signature dishes in high-fidelity 3D, or select from our exquisite main courses.",
  },
};

export const FALLBACK_TENANT_BUSINESS_TYPES: TenantBusinessTypeDefinition[] = [
  {
    key: "general",
    label: "General Business",
    description: "Balanced landing page for agencies, service teams, and multipurpose brands.",
    icon: "layout-dashboard",
    default_template: FALLBACK_TENANT_LANDING_TEMPLATE,
  },
  {
    key: "b2b",
    label: "B2B Marketplace",
    description: "Connect with verified wholesale suppliers and post RFQs.",
    icon: "boxes",
    default_template: FALLBACK_TENANT_LANDING_TEMPLATE,
  },
];

const cloneTemplate = (template: TenantLandingTemplate): TenantLandingTemplate =>
  JSON.parse(JSON.stringify(template)) as TenantLandingTemplate;

export const resolveLandingTemplate = (
  template: unknown,
  fallback: TenantLandingTemplate = FALLBACK_TENANT_LANDING_TEMPLATE,
): TenantLandingTemplate => {
  if (!template || typeof template !== "object") {
    return cloneTemplate(fallback);
  }

  const candidate = template as Partial<TenantLandingTemplate>;
  const candidateMeta = candidate.meta && typeof candidate.meta === "object"
    ? candidate.meta
    : undefined;

  return {
    version: 1,
    meta: {
      business_type: typeof candidateMeta?.business_type === "string" ? candidateMeta.business_type : undefined,
      business_label: typeof candidateMeta?.business_label === "string" ? candidateMeta.business_label : undefined,
      template_key: typeof candidateMeta?.template_key === "string" ? candidateMeta.template_key : undefined,
      template_label: typeof candidateMeta?.template_label === "string" ? candidateMeta.template_label : undefined,
      template_description: typeof candidateMeta?.template_description === "string" ? candidateMeta.template_description : undefined,
      is_custom: typeof candidateMeta?.is_custom === "boolean" ? candidateMeta.is_custom : undefined,
    },
    theme: { ...fallback.theme, ...(candidate.theme ?? {}) },
    hero: {
      ...fallback.hero,
      ...(candidate.hero ?? {}),
      slides: Array.isArray(candidate.hero?.slides) && candidate.hero.slides.length > 0
        ? candidate.hero.slides.map((slide) => ({
            image: String(slide?.image ?? ""),
            title: String(slide?.title ?? ""),
            subtitle: String(slide?.subtitle ?? ""),
            badge: String(slide?.badge ?? ""),
          }))
        : (fallback.hero?.slides ?? undefined),
    },
    stats: Array.isArray(candidate.stats) && candidate.stats.length > 0
      ? candidate.stats.map((item) => ({
          value: String(item?.value ?? ""),
          label: String(item?.label ?? ""),
        }))
      : cloneTemplate(fallback).stats,
    highlights: Array.isArray(candidate.highlights) && candidate.highlights.length > 0
      ? candidate.highlights.map((item) => ({
          kicker: String(item?.kicker ?? ""),
          title: String(item?.title ?? ""),
          description: String(item?.description ?? ""),
          image: item?.image ? String(item.image) : undefined,
        }))
      : cloneTemplate(fallback).highlights,
    spotlight: {
      ...fallback.spotlight,
      ...(candidate.spotlight ?? {}),
      items: Array.isArray(candidate.spotlight?.items) && candidate.spotlight.items.length > 0
        ? candidate.spotlight.items.map((item) => ({
            title: String(item?.title ?? ""),
            description: String(item?.description ?? ""),
          }))
        : cloneTemplate(fallback).spotlight.items,
    },
    testimonials: Array.isArray(candidate.testimonials) && candidate.testimonials.length > 0
      ? candidate.testimonials.map((item) => ({
          quote: String(item?.quote ?? ""),
          author: String(item?.author ?? ""),
          role: String(item?.role ?? ""),
        }))
      : cloneTemplate(fallback).testimonials,
    final_cta: { ...fallback.final_cta, ...(candidate.final_cta ?? {}) },
    rendering: resolveLandingRendering(candidate.rendering, fallback.rendering),
    menus: {
      eyebrow: typeof candidate.menus?.eyebrow === "string" ? candidate.menus.eyebrow : (fallback.menus?.eyebrow ?? "Menus"),
      title: typeof candidate.menus?.title === "string" ? candidate.menus.title : (fallback.menus?.title ?? "Explore Our Menus in 3D"),
      description_eyebrow: typeof candidate.menus?.description_eyebrow === "string" ? candidate.menus.description_eyebrow : (fallback.menus?.description_eyebrow ?? "Interactive Experience"),
      description: typeof candidate.menus?.description === "string" ? candidate.menus.description : (fallback.menus?.description ?? "Interact directly with our signature dishes in high-fidelity 3D, or select from our exquisite main courses."),
    },
    services: Array.isArray(candidate.services) && candidate.services.length > 0
      ? candidate.services.map((item) => ({
          title: String(item?.title ?? ""),
          description: String(item?.description ?? ""),
          image: item?.image ? String(item.image) : undefined,
        }))
      : fallback.services,
    services_section: candidate.services_section && typeof candidate.services_section === "object"
      ? {
          eyebrow: typeof candidate.services_section.eyebrow === "string" ? candidate.services_section.eyebrow : undefined,
          title: typeof candidate.services_section.title === "string" ? candidate.services_section.title : undefined,
        }
      : fallback.services_section,
    faqs: Array.isArray(candidate.faqs) && candidate.faqs.length > 0
      ? candidate.faqs.map((item) => ({
          question: String(item?.question ?? ""),
          answer: String(item?.answer ?? ""),
        }))
      : fallback.faqs,
    marquee: Array.isArray(candidate.marquee)
      ? candidate.marquee.map((m) => String(m ?? "")).filter(Boolean)
      : fallback.marquee,
    gallery: candidate.gallery && typeof candidate.gallery === "object"
      ? {
          eyebrow: typeof candidate.gallery.eyebrow === "string" ? candidate.gallery.eyebrow : undefined,
          title: typeof candidate.gallery.title === "string" ? candidate.gallery.title : undefined,
          images: Array.isArray(candidate.gallery.images)
            ? candidate.gallery.images.map((img) => String(img ?? "")).filter(Boolean)
            : undefined,
        }
      : fallback.gallery,
    cellar: candidate.cellar && typeof candidate.cellar === "object"
      ? {
          eyebrow: typeof candidate.cellar.eyebrow === "string" ? candidate.cellar.eyebrow : undefined,
          title: typeof candidate.cellar.title === "string" ? candidate.cellar.title : undefined,
          description: typeof candidate.cellar.description === "string" ? candidate.cellar.description : undefined,
          image: candidate.cellar.image ? String(candidate.cellar.image) : undefined,
          items: Array.isArray(candidate.cellar.items)
            ? candidate.cellar.items.map((item) => ({
                title: String(item?.title ?? ""),
                description: String(item?.description ?? ""),
              }))
            : undefined,
        }
      : fallback.cellar,
    experience: candidate.experience && typeof candidate.experience === "object"
      ? {
          eyebrow: typeof candidate.experience.eyebrow === "string" ? candidate.experience.eyebrow : undefined,
          title: typeof candidate.experience.title === "string" ? candidate.experience.title : undefined,
          description: typeof candidate.experience.description === "string" ? candidate.experience.description : undefined,
          image: candidate.experience.image ? String(candidate.experience.image) : undefined,
          featured_badge: typeof candidate.experience.featured_badge === "string" ? candidate.experience.featured_badge : undefined,
          featured_title: typeof candidate.experience.featured_title === "string" ? candidate.experience.featured_title : undefined,
          featured_description: typeof candidate.experience.featured_description === "string" ? candidate.experience.featured_description : undefined,
        }
      : fallback.experience,
    location_info: candidate.location_info && typeof candidate.location_info === "object"
      ? {
          hours: Array.isArray(candidate.location_info.hours)
            ? candidate.location_info.hours.map((line) => String(line ?? "")).filter(Boolean)
            : undefined,
          address: Array.isArray(candidate.location_info.address)
            ? candidate.location_info.address.map((line) => String(line ?? "")).filter(Boolean)
            : undefined,
          phone: typeof candidate.location_info.phone === "string" ? candidate.location_info.phone : undefined,
          map_url: typeof candidate.location_info.map_url === "string" ? candidate.location_info.map_url : undefined,
        }
      : fallback.location_info,
    guestlist: candidate.guestlist && typeof candidate.guestlist === "object"
      ? {
          eyebrow: typeof candidate.guestlist.eyebrow === "string" ? candidate.guestlist.eyebrow : undefined,
          title: typeof candidate.guestlist.title === "string" ? candidate.guestlist.title : undefined,
          description: typeof candidate.guestlist.description === "string" ? candidate.guestlist.description : undefined,
          cta: typeof candidate.guestlist.cta === "string" ? candidate.guestlist.cta : undefined,
        }
      : fallback.guestlist,
  };
};

const resolveLandingRendering = (
  rendering: unknown,
  fallback: TenantLandingRendering = FALLBACK_TENANT_LANDING_TEMPLATE.rendering,
): TenantLandingRendering => {
  if (!rendering || typeof rendering !== "object") {
    return { ...fallback };
  }

  const candidate = rendering as Partial<TenantLandingRendering>;
  const mode = candidate.mode === "custom_code" || candidate.mode === "raw_package"
    ? candidate.mode
    : "structured";

  if (mode !== "custom_code" && mode !== "raw_package") {
    return {
      mode: "structured",
      html: "",
      css: "",
      js: "",
      asset_base_url: "",
    };
  }

  return {
    mode,
    html: String(candidate.html ?? fallback.html ?? ""),
    css: String(candidate.css ?? fallback.css ?? ""),
    js: mode === "raw_package" ? String(candidate.js ?? fallback.js ?? "") : "",
    asset_base_url: mode === "raw_package" ? String(candidate.asset_base_url ?? fallback.asset_base_url ?? "") : "",
  };
};

type TenantLandingTemplateVariantSeed = {
  key: string;
  label: string;
  description: string;
  overrides?: {
    theme?: Partial<TenantLandingTheme>;
    hero?: Partial<TenantLandingHero>;
    stats?: TenantLandingStat[];
    highlights?: TenantLandingCard[];
    spotlight?: Partial<Omit<TenantLandingSpotlight, "items">> & {
      items?: TenantLandingSpotlightItem[];
    };
    testimonials?: TenantLandingTestimonial[];
    final_cta?: Partial<TenantLandingFinalCta>;
  };
};

const variantSeedsForBusinessType = (
  businessKey: string,
): TenantLandingTemplateVariantSeed[] => {
  switch (businessKey) {
    case "b2b":
      return [
        {
          key: "signature",
          label: "Global Marketplace",
          description: "A professional B2B platform for global sourcing and bulk procurement.",
          overrides: {
            hero: {
              eyebrow: "Global B2B Sourcing",
              title: "Connect with verified wholesale suppliers and secure your supply chain.",
              description: "Post RFQs, receive competitive quotes, and transact safely with Escrow.",
              primary_label: "Post an Inquiry",
              secondary_label: "Become a Seller",
            },
            stats: [
              { value: "10K+", label: "Verified Suppliers" },
              { value: "Secure", label: "Escrow Payments" },
              { value: "Global", label: "Logistics Tracking" },
            ],
          },
        },
      ];
    case "retail":
      return [
        {
          key: "signature",
          label: "Signature Storefront",
          description: "Balanced premium layout for curated collections and everyday merchandising.",
        },
        {
          key: "campaign",
          label: "Campaign Drop",
          description: "High-energy launch template for promotions, limited drops, and seasonal pushes.",
          overrides: {
            hero: {
              eyebrow: "Launch Campaign",
              title: "Make every drop feel like an event worth showing up for.",
              description: "Lead with urgency, curated bundles, and a stronger conversion path for campaign traffic.",
              primary_label: "Shop the Drop",
              secondary_label: "See Bundle Offers",
              announcement: "Limited-time launches, exclusive bundles, and fast-moving stock are live now.",
            },
            stats: [
              { value: "72 hrs", label: "campaign urgency window" },
              { value: "4.9/5", label: "launch satisfaction" },
              { value: "Top Sellers", label: "surfaced instantly" },
            ],
          },
        },
        {
          key: "catalog",
          label: "Minimal Catalog",
          description: "Cleaner, product-first scenario for evergreen catalog browsing and repeat buyers.",
          overrides: {
            hero: {
              eyebrow: "Evergreen Catalog",
              title: "Present the catalog with a calmer, more editorial rhythm.",
              description: "Use a softer structure for products that need trust, clarity, and repeat discovery instead of launch urgency.",
              primary_label: "Browse the Catalog",
              secondary_label: "See Best Sellers",
            },
          },
        },
      ];
    case "restaurant":
      return [
        {
          key: "signature",
          label: "Chef Experience",
          description: "Warm hospitality flow for reservations, specials, and atmosphere-led storytelling.",
        },
        {
          key: "reservations",
          label: "Reservations Focus",
          description: "Streamlined dining template for table bookings, private events, and faster action.",
          overrides: {
            hero: {
              eyebrow: "Reservations First",
              title: "Turn appetite into confirmed tables with less friction.",
              description: "Put bookings, dining times, and event requests at the center of the experience.",
              primary_label: "Book a Table",
              secondary_label: "Plan a Private Event",
            },
          },
        },
        {
          key: "family",
          label: "Family Dining",
          description: "Approachable template for family meals, platters, weekend traffic, and community events.",
          overrides: {
            hero: {
              eyebrow: "Family Dining",
              title: "Welcome groups, celebrations, and everyday favorites with more warmth.",
              description: "Ideal for busy dining rooms that want to promote platters, group seating, and neighborhood loyalty.",
              primary_label: "See Family Specials",
              secondary_label: "Reserve for Groups",
            },
          },
        },
      ];
    case "hotel":
      return [
        {
          key: "signature",
          label: "Boutique Stay",
          description: "Premium hospitality landing page for elegant rooms, concierge service, and refined stays.",
        },
        {
          key: "business",
          label: "Business Travel",
          description: "Sharper scenario for executive stays, airport transfer, and weekday bookings.",
          overrides: {
            hero: {
              eyebrow: "Business Travel",
              title: "Give fast-moving guests a calmer booking path with executive confidence.",
              description: "Position the property for weekday stays, transfers, meeting-friendly rooms, and dependable service.",
              primary_label: "Book Executive Stay",
              secondary_label: "See Corporate Amenities",
            },
          },
        },
        {
          key: "escape",
          label: "Weekend Escape",
          description: "Story-first hospitality scenario for premium packages, leisure stays, and experience-led offers.",
          overrides: {
            hero: {
              eyebrow: "Weekend Escape",
              title: "Sell the getaway before guests compare another property.",
              description: "Use a softer, more atmospheric message for spa packages, suites, and experience-driven bookings.",
              primary_label: "Explore Packages",
              secondary_label: "View Signature Suites",
            },
          },
        },
      ];
    case "clinic":
      return [
        {
          key: "signature",
          label: "Primary Care",
          description: "Trust-centered clinic experience for consultations, appointments, and reassuring first visits.",
        },
        {
          key: "specialist",
          label: "Specialist Center",
          description: "Structured scenario for specialist pathways, referrals, and higher-acuity service lines.",
          overrides: {
            hero: {
              eyebrow: "Specialist Care",
              title: "Help patients reach the right specialist with more clarity and less hesitation.",
              description: "Built for clinics that need to present departments, referrals, and specialist access cleanly.",
              primary_label: "Find a Specialist",
              secondary_label: "Review Care Pathways",
            },
          },
        },
        {
          key: "wellness",
          label: "Wellness Program",
          description: "Softer healthcare scenario for preventative care, memberships, and long-term wellness journeys.",
          overrides: {
            hero: {
              eyebrow: "Wellness and Prevention",
              title: "Create a calmer landing page for recurring care and preventative programs.",
              description: "Useful for wellness packages, recurring checkups, and patient education-led experiences.",
              primary_label: "Book Wellness Visit",
              secondary_label: "Explore Programs",
            },
          },
        },
      ];
    case "logistics":
      return [
        {
          key: "signature",
          label: "Operations Control",
          description: "Confident logistics template for freight, coverage, tracking, and enterprise trust.",
        },
        {
          key: "enterprise",
          label: "Enterprise Freight",
          description: "Sales-oriented scenario for procurement teams, larger contracts, and operational credibility.",
          overrides: {
            hero: {
              eyebrow: "Enterprise Freight",
              title: "Present discipline, coverage, and scale in a way procurement teams trust fast.",
              description: "Frame lanes, SLAs, and account-ready service offers for bigger logistics conversations.",
              primary_label: "Request Enterprise Quote",
              secondary_label: "Review Service Lanes",
            },
          },
        },
        {
          key: "express",
          label: "Rapid Delivery",
          description: "Faster-moving scenario for dispatch, last-mile service, and urgency-driven delivery requests.",
          overrides: {
            hero: {
              eyebrow: "Rapid Dispatch",
              title: "Show speed and shipment visibility without losing operational credibility.",
              description: "Best for same-day delivery, dispatch-heavy teams, and time-sensitive routing offers.",
              primary_label: "Start Delivery Request",
              secondary_label: "Track Active Shipments",
            },
          },
        },
      ];
    default:
      return [
        {
          key: "signature",
          label: "Signature Brand",
          description: "Balanced premium scenario for service brands, agencies, and modern general businesses.",
        },
        {
          key: "conversion",
          label: "Lead Capture",
          description: "Action-led scenario for direct inquiries, consultations, and faster lead conversion.",
          overrides: {
            hero: {
              eyebrow: "Lead Conversion",
              title: "Reduce hesitation and move visitors toward the next action faster.",
              description: "Built for businesses that want more calls, bookings, demos, or direct consultation requests.",
              primary_label: "Book a Call",
              secondary_label: "See Services",
            },
          },
        },
        {
          key: "editorial",
          label: "Studio Portfolio",
          description: "Calmer, more atmospheric scenario for visual brands, consultants, and creative businesses.",
          overrides: {
            hero: {
              eyebrow: "Studio Presence",
              title: "Give the brand a quieter, more editorial front page.",
              description: "Use a cleaner rhythm when trust and visual refinement matter more than dense selling.",
              primary_label: "View the Portfolio",
              secondary_label: "Meet the Team",
            },
          },
        },
      ];
  }
};

export const applyLandingTemplateMeta = (
  template: TenantLandingTemplate,
  meta: Partial<TenantLandingTemplateMeta>,
): TenantLandingTemplate => {
  const resolved = resolveLandingTemplate(template);

  return {
    ...resolved,
    meta: {
      ...resolved.meta,
      ...meta,
    },
  };
};

export const stripTemplateCodeForTenantEditor = (
  template: TenantLandingTemplate,
): TenantLandingTemplate => {
  const resolved = resolveLandingTemplate(template);

  return {
    ...resolved,
    rendering: {
      mode: "structured",
      html: "",
      css: "",
      js: "",
      asset_base_url: "",
    },
  };
};

export const mergeTenantEditableTemplateWithDesign = (
  designTemplate: TenantLandingTemplate,
  editableTemplate: TenantLandingTemplate,
): TenantLandingTemplate => {
  const design = resolveLandingTemplate(designTemplate);
  const editable = resolveLandingTemplate(editableTemplate, design);

  return applyLandingTemplateMeta(
    {
      ...editable,
      rendering: design.rendering,
    },
    {
      ...design.meta,
      ...editable.meta,
      is_custom: true,
    },
  );
};

export const buildTemplateVariantsForBusinessType = (
  businessKey: string,
  businessLabel: string,
  baseTemplate: TenantLandingTemplate,
): TenantLandingTemplateVariant[] => {
  const resolvedBase = resolveLandingTemplate(baseTemplate, FALLBACK_TENANT_LANDING_TEMPLATE);

  return variantSeedsForBusinessType(businessKey).map((seed) => {
    const template = applyLandingTemplateMeta(
      resolveLandingTemplate(seed.overrides ?? {}, resolvedBase),
      {
        business_type: businessKey,
        business_label: businessLabel,
        template_key: seed.key,
        template_label: seed.label,
        template_description: seed.description,
        is_custom: false,
      },
    );

    return {
      key: seed.key,
      label: seed.label,
      description: seed.description,
      template,
    };
  });
};

export const resolveTemplateVariant = (
  businessType: TenantBusinessTypeDefinition,
  templateKey?: string | null,
): TenantLandingTemplateVariant => {
  const templates = businessType.templates?.length
    ? businessType.templates
    : buildTemplateVariantsForBusinessType(
        businessType.key,
        businessType.label,
        businessType.default_template,
      );

  const defaultKey = businessType.default_template_key ?? templates[0]?.key ?? "signature";

  return (
    templates.find((template) => template.key === templateKey)
      ?? templates.find((template) => template.key === defaultKey)
      ?? templates[0]
  );
};

export const resolveBusinessTypeCatalog = (
  catalog: unknown,
): TenantBusinessTypeDefinition[] => {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return FALLBACK_TENANT_BUSINESS_TYPES.map((item) => {
      const templates = item.templates?.length
        ? item.templates
        : buildTemplateVariantsForBusinessType(item.key, item.label, item.default_template);
      const defaultTemplateKey = item.default_template_key ?? templates[0]?.key ?? "signature";
      const defaultTemplate = resolveTemplateVariant({ ...item, templates }, defaultTemplateKey).template;

      return {
        ...item,
        default_template_key: defaultTemplateKey,
        default_template: defaultTemplate,
        templates,
      };
    });
  }

  return catalog.map((item) => {
    const candidate = item as Partial<TenantBusinessTypeDefinition>;
    const businessKey = String(candidate.key ?? "general");
    const businessLabel = String(candidate.label ?? "General Business");
    const baseTemplate = resolveLandingTemplate(candidate.default_template, FALLBACK_TENANT_LANDING_TEMPLATE);
    const templates = Array.isArray(candidate.templates) && candidate.templates.length > 0
      ? candidate.templates.map((variant, index) => {
          const templateCandidate = variant as Partial<TenantLandingTemplateVariant> & {
            default_template?: TenantLandingTemplate;
          };
          const key = String(templateCandidate.key ?? `template-${index + 1}`);
          const label = String(templateCandidate.label ?? `${businessLabel} Template ${index + 1}`);
          const description = String(templateCandidate.description ?? candidate.description ?? "");
          const sourceTemplate = templateCandidate.template ?? templateCandidate.default_template ?? baseTemplate;

          return {
            key,
            label,
            description,
            template: applyLandingTemplateMeta(
              resolveLandingTemplate(sourceTemplate, baseTemplate),
              {
                business_type: businessKey,
                business_label: businessLabel,
                template_key: key,
                template_label: label,
                template_description: description,
                is_custom: false,
              },
            ),
          };
        })
      : buildTemplateVariantsForBusinessType(businessKey, businessLabel, baseTemplate);
    const defaultTemplateKey = String(candidate.default_template_key ?? templates[0]?.key ?? "signature");
    const defaultTemplate = resolveTemplateVariant(
      {
        key: businessKey,
        label: businessLabel,
        description: String(candidate.description ?? ""),
        icon: String(candidate.icon ?? "layout-dashboard"),
        default_template: baseTemplate,
        default_template_key: defaultTemplateKey,
        templates,
      },
      defaultTemplateKey,
    ).template;

    return {
      key: businessKey,
      label: businessLabel,
      description: String(candidate.description ?? ""),
      icon: String(candidate.icon ?? "layout-dashboard"),
      default_template_key: defaultTemplateKey,
      default_template: defaultTemplate,
      templates,
    };
  });
};

export const formatLandingTemplateJson = (template: TenantLandingTemplate): string =>
  JSON.stringify(template, null, 2);

export const parseLandingTemplateJson = (
  content: string,
  fallback: TenantLandingTemplate = FALLBACK_TENANT_LANDING_TEMPLATE,
): TenantLandingTemplate => {
  const parsed = JSON.parse(content);
  return resolveLandingTemplate(parsed, fallback);
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeScriptJson = (value: unknown): string =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");

const sanitizeHref = (value?: string): string => {
  const href = (value ?? "").trim();

  if (!href) {
    return "#";
  }

  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  return "#";
};

const sanitizeRuntimeTemplateHtml = (html: string): string =>
  html
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*\/?\s*(iframe|object|embed|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z0-9_-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s+srcdoc\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, ' $1="#"')
    .replace(/\s+(href|src|xlink:href)\s*=\s*javascript:[^\s>]*/gi, ' $1="#"');

const sanitizeRuntimeTemplateCss = (css: string): string =>
  css
    .replace(/@import\b[^;]*;?/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*(["']?)\s*javascript:[^)]+\)/gi, 'url("#")')
    .replace(/(^|[;{\s])behavior\s*:[^;]*;?/gi, "$1");

const sanitizeRuntimeTemplateJs = (js: string): string =>
  js
    .replace(/\0/g, "")
    .replace(/<\s*\/\s*script/gi, "<\\/script");

const normalizeRuntimeAssetBaseUrl = (value?: string): string => {
  const raw = (value ?? "").trim();

  if (!raw || /^(javascript|data|vbscript):/i.test(raw)) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return `${raw.replace(/\/+$/, "")}/`;
  }

  if (!/^[a-zA-Z0-9_./-]+$/.test(raw)) {
    return "";
  }

  return `/${raw.replace(/^\/+|\/+$/g, "")}/`;
};

const getPathValue = (source: unknown, path: string): unknown => {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, source);
};

const interpolateTemplateCode = (
  source: string,
  template: TenantLandingTemplate,
  brandName: string,
  businessLabel: string,
  options?: { assetBaseUrl?: string; css?: boolean },
): string => {
  const tokenSource = {
    assets: {
      base_url: options?.assetBaseUrl ?? "",
    },
    brand: {
      name: brandName,
    },
    business: {
      label: businessLabel,
    },
    hero: template.hero,
    stats: template.stats,
    highlights: template.highlights,
    spotlight: template.spotlight,
    testimonials: template.testimonials,
    final_cta: template.final_cta,
    theme: template.theme,
  };

  return source.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, token: string) => {
    const value = getPathValue(tokenSource, token);
    const stringValue = value === null || value === undefined ? "" : String(value);

    if (options?.css) {
      return sanitizeRuntimeTemplateCss(stringValue);
    }

    if (token.endsWith("_href")) {
      return escapeHtml(sanitizeHref(stringValue));
    }

    return escapeHtml(stringValue);
  });
};

const buildCustomCodeLandingDocument = (
  template: TenantLandingTemplate,
  brandName: string,
  businessLabel: string,
): string => {
  const isRawPackage = template.rendering.mode === "raw_package";
  const assetBaseUrl = isRawPackage
    ? normalizeRuntimeAssetBaseUrl(template.rendering.asset_base_url)
    : "";
  const html = sanitizeRuntimeTemplateHtml(
    interpolateTemplateCode(template.rendering.html, template, brandName, businessLabel, { assetBaseUrl }),
  );
  const css = sanitizeRuntimeTemplateCss(
    interpolateTemplateCode(template.rendering.css, template, brandName, businessLabel, { assetBaseUrl, css: true }),
  );
  const js = isRawPackage
    ? sanitizeRuntimeTemplateJs(
        interpolateTemplateCode(template.rendering.js, template, brandName, businessLabel, { assetBaseUrl }),
      )
    : "";
  const landingData = isRawPackage
    ? escapeScriptJson({
        assets: {
          base_url: assetBaseUrl,
        },
        brand: {
          name: brandName,
        },
        business: {
          label: businessLabel,
        },
        final_cta: template.final_cta,
        hero: template.hero,
        highlights: template.highlights,
        spotlight: template.spotlight,
        stats: template.stats,
        testimonials: template.testimonials,
        theme: template.theme,
      })
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_top" />
    <title>${escapeHtml(brandName)}</title>
    <style>
      html, body { margin: 0; min-height: 100%; }
      body { background: ${escapeHtml(template.theme.surface || "#020617")}; }
      ${css}
    </style>
  </head>
  <body>
    ${isRawPackage ? `<script>window.HIVE_LANDING_DATA = Object.freeze(${landingData});</script>` : ""}
    ${html}
    ${isRawPackage && js.trim() ? `<script>${js}</script>` : ""}
  </body>
</html>`;
};

type PreviewColorMode = "light" | "dark";

export type TenantLandingPreviewBranding = {
  app_title?: string | null;
  footer_text?: string | null;
  primary_color?: string | null;
  font_family?: string | null;
};

export type TenantLandingPreviewOptions = {
  colorMode?: PreviewColorMode;
  branding?: TenantLandingPreviewBranding | null;
};

const normalizeHexColor = (value: string | null | undefined, fallback: string): string => {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;

  const normalized = raw.length === 4
    ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
    : raw;

  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
};

const hexToRgbChannels = (hex: string) => {
  const normalized = normalizeHexColor(hex, "#0F766E");
  const value = normalized.slice(1);

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const toRgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgbChannels(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
};

const blendHex = (fromHex: string, toHex: string, ratio: number): string => {
  const from = hexToRgbChannels(fromHex);
  const to = hexToRgbChannels(toHex);
  const weight = Math.min(1, Math.max(0, ratio));

  const r = Math.round(from.r + (to.r - from.r) * weight);
  const g = Math.round(from.g + (to.g - from.g) * weight);
  const b = Math.round(from.b + (to.b - from.b) * weight);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
};

const resolvePreviewFontFamily = (fontFamily?: string | null): string => {
  const normalized = (fontFamily ?? "").trim().toLowerCase();

  switch (normalized) {
    case "space grotesk":
      return `"Space Grotesk", "Inter", "Segoe UI", system-ui, sans-serif`;
    case "jetbrains mono":
      return `"JetBrains Mono", "Fira Code", ui-monospace, monospace`;
    case "system ui":
    case "system-ui":
      return `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    default:
      return `"Space Grotesk", "Inter", "Segoe UI", system-ui, sans-serif`;
  }
};

export const buildTenantLandingPreviewHtml = (
  template: TenantLandingTemplate,
  brandName: string,
  businessLabel: string,
  options?: TenantLandingPreviewOptions,
): string => {
  const resolved = resolveLandingTemplate(template);
  const theme = resolved.theme;
  const colorMode = options?.colorMode ?? "dark";
  const isDark = colorMode === "dark";
  const branding = options?.branding ?? null;
  const previewBrandName = branding?.app_title?.trim() || brandName;

  if (
    (resolved.rendering.mode === "custom_code" || resolved.rendering.mode === "raw_package")
    && resolved.rendering.html.trim()
  ) {
    return buildCustomCodeLandingDocument(resolved, previewBrandName, businessLabel);
  }

  const accent = normalizeHexColor(branding?.primary_color ?? theme.accent, "#0F766E");
  const accentSoft = normalizeHexColor(
    theme.accent_soft,
    isDark ? blendHex(accent, "#0F172A", 0.72) : blendHex(accent, "#FFFFFF", 0.84),
  );
  const surface = normalizeHexColor(theme.surface, isDark ? "#101826" : "#F8FAFC");
  const text = normalizeHexColor(theme.text, isDark ? "#E2E8F0" : "#0F172A");
  const muted = normalizeHexColor(theme.muted, isDark ? "#A8B6C8" : "#475569");
  const panel = theme.panel ?? (isDark ? "rgba(10, 18, 32, 0.76)" : "rgba(255,255,255,0.82)");
  const canvas = theme.canvas || (
    isDark
      ? "radial-gradient(circle at 15% 12%, rgba(15,118,110,0.28), transparent 38%), linear-gradient(145deg, #030712 0%, #0B1222 45%, #111A2D 100%)"
      : "radial-gradient(circle at 15% 12%, rgba(15,118,110,0.16), transparent 34%), linear-gradient(145deg, #F8FAFC 0%, #ECFEFF 42%, #EEF2FF 100%)"
  );
  const strongText = isDark ? "#F8FAFC" : "#020617";
  const shellBg = isDark ? "rgba(2, 9, 21, 0.58)" : "rgba(255,255,255,0.68)";
  const shellBorder = isDark ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.08)";
  const heroOverlayStart = isDark ? "rgba(15,23,42,0.28)" : "rgba(255,255,255,0.55)";
  const heroOverlayEnd = isDark ? "rgba(10,20,36,0.16)" : "rgba(255,255,255,0.25)";
  const secondaryButtonBg = isDark ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.78)";
  const footerText = branding?.footer_text?.trim() || `Powered by ${previewBrandName}`;
  const fontFamily = resolvePreviewFontFamily(branding?.font_family);
  const businessLine = `${previewBrandName} • ${businessLabel}`;

  const statsHtml = resolved.stats
    .map((item) => `
      <div class="stat">
        <strong>${escapeHtml(item.value)}</strong>
        <span>${escapeHtml(item.label)}</span>
      </div>
    `)
    .join("");

  const highlightsHtml = resolved.highlights
    .map((item) => `
      <article class="card">
        <span class="eyebrow">${escapeHtml(item.kicker)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>
    `)
    .join("");

  const offersHtml = resolved.spotlight.items
    .map((item) => `
      <article class="offer">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>
    `)
    .join("");

  const testimonialsHtml = resolved.testimonials
    .map((item) => `
      <blockquote class="quote">
        <p>"${escapeHtml(item.quote)}"</p>
        <footer>${escapeHtml(item.author)} <span>${escapeHtml(item.role)}</span></footer>
      </blockquote>
    `)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(previewBrandName)}</title>
    <style>
      :root {
        --accent: ${accent};
        --accent-soft: ${accentSoft};
        --surface: ${surface};
        --canvas: ${canvas};
        --panel: ${panel};
        --text: ${text};
        --muted: ${muted};
        --strong-text: ${strongText};
        --shell-bg: ${shellBg};
        --shell-border: ${shellBorder};
        --hero-overlay-start: ${heroOverlayStart};
        --hero-overlay-end: ${heroOverlayEnd};
        --secondary-btn-bg: ${secondaryButtonBg};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ${fontFamily};
        color: var(--text);
        background: var(--canvas);
      }
      a { color: inherit; text-decoration: none; }
      .page { padding: 28px; min-height: 100vh; }
      .shell {
        border-radius: 32px;
        overflow: hidden;
        background: var(--shell-bg);
        backdrop-filter: blur(22px);
        border: 1px solid var(--shell-border);
        box-shadow: ${isDark ? "0 30px 90px rgba(2,6,23,0.62)" : "0 30px 80px rgba(15,23,42,0.14)"};
      }
      .hero {
        padding: 34px;
        background: linear-gradient(180deg, var(--hero-overlay-start), var(--hero-overlay-end));
      }
      .brand {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 28px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        padding: 8px 12px;
      }
      .brand-name {
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        max-width: 760px;
        font-size: 46px;
        line-height: 1.05;
        letter-spacing: -0.04em;
        color: var(--strong-text);
      }
      .lede {
        max-width: 680px;
        margin: 18px 0 0;
        color: var(--muted);
        line-height: 1.7;
        font-size: 16px;
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        flex-wrap: wrap;
      }
      .btn-primary, .btn-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 12px 18px;
        font-size: 13px;
        font-weight: 800;
      }
      .btn-primary {
        background: var(--accent);
        color: white;
        box-shadow: 0 16px 36px ${toRgba(accent, 0.3)};
      }
      .btn-secondary {
        background: var(--secondary-btn-bg);
        border: 1px solid ${isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.08)"};
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 28px;
      }
      .stat, .card, .offer, .quote, .cta {
        background: var(--panel);
        border: 1px solid ${isDark ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.08)"};
        border-radius: 22px;
        box-shadow: ${isDark ? "0 18px 50px rgba(2,6,23,0.42)" : "0 18px 40px rgba(15,23,42,0.08)"};
      }
      .stat {
        padding: 18px;
      }
      .stat strong {
        display: block;
        font-size: 28px;
        letter-spacing: -0.05em;
        color: var(--strong-text);
      }
      .stat span, .card p, .offer p, .quote p, .quote span, .section-copy {
        color: var(--muted);
      }
      .content {
        padding: 0 34px 34px;
      }
      .section {
        padding-top: 28px;
      }
      .section-head {
        max-width: 660px;
        margin-bottom: 18px;
      }
      .section-head h2 {
        margin: 0;
        font-size: 28px;
        letter-spacing: -0.03em;
        color: var(--strong-text);
      }
      .grid-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }
      .card, .offer, .quote {
        padding: 20px;
      }
      .eyebrow {
        display: inline-block;
        color: var(--accent);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .card h3, .offer h3 {
        margin: 0 0 10px;
        font-size: 18px;
        letter-spacing: -0.03em;
        color: var(--strong-text);
      }
      .quote footer {
        margin-top: 14px;
        font-size: 13px;
        font-weight: 700;
        color: var(--strong-text);
      }
      .quote span {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        font-weight: 500;
      }
      .cta {
        padding: 24px;
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: center;
        margin-top: 28px;
      }
      .cta h2 {
        margin: 0 0 8px;
        font-size: 30px;
        letter-spacing: -0.04em;
        color: var(--strong-text);
      }
      .footer {
        margin-top: 24px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        padding: 12px 4px 0;
        border-top: 1px solid ${isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)"};
        font-size: 12px;
        color: var(--muted);
      }
      @media (max-width: 960px) {
        .grid-3, .stats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 720px) {
        .page { padding: 16px; }
        .hero, .content { padding-left: 18px; padding-right: 18px; }
        .grid-3, .stats {
          grid-template-columns: 1fr;
        }
        .cta {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="shell">
        <section class="hero">
          <div class="brand">
            <div>
              <div class="brand-name">${escapeHtml(previewBrandName)}</div>
              <div class="section-copy">${escapeHtml(businessLine)}</div>
            </div>
            <span class="pill">${escapeHtml(resolved.hero.eyebrow)}</span>
          </div>
          ${resolved.hero.announcement ? `<div class="pill">${escapeHtml(resolved.hero.announcement)}</div>` : ""}
          <h1>${escapeHtml(resolved.hero.title)}</h1>
          <p class="lede">${escapeHtml(resolved.hero.description)}</p>
          <div class="actions">
            <a class="btn-primary" href="${sanitizeHref(resolved.hero.primary_href)}">${escapeHtml(resolved.hero.primary_label)}</a>
            <a class="btn-secondary" href="${sanitizeHref(resolved.hero.secondary_href)}">${escapeHtml(resolved.hero.secondary_label)}</a>
          </div>
          <div class="stats">${statsHtml}</div>
        </section>
        <div class="content">
          <section class="section">
            <div class="grid-3">${highlightsHtml}</div>
          </section>
          <section class="section" id="offers">
            <div class="section-head">
              <span class="eyebrow">What people can do here</span>
              <h2>${escapeHtml(resolved.spotlight.heading)}</h2>
              <p class="section-copy">${escapeHtml(resolved.spotlight.description)}</p>
            </div>
            <div class="grid-3">${offersHtml}</div>
          </section>
          <section class="section">
            <div class="grid-3">${testimonialsHtml}</div>
          </section>
          <section class="cta">
            <div>
              <span class="eyebrow">Final call to action</span>
              <h2>${escapeHtml(resolved.final_cta.title)}</h2>
              <p class="section-copy">${escapeHtml(resolved.final_cta.description)}</p>
            </div>
            <div class="actions">
              <a class="btn-primary" href="${sanitizeHref(resolved.final_cta.primary_href)}">${escapeHtml(resolved.final_cta.primary_label)}</a>
              <a class="btn-secondary" href="${sanitizeHref(resolved.final_cta.secondary_href)}">${escapeHtml(resolved.final_cta.secondary_label)}</a>
            </div>
          </section>
          <footer class="footer">
            <span>${escapeHtml(footerText)}</span>
            <span>Preview mode: ${escapeHtml(colorMode)}</span>
          </footer>
        </div>
      </div>
    </div>
  </body>
</html>`;
};
