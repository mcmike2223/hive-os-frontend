/**
 * Dynamic Tenant Data Binding Engine
 *
 * Safely interpolates scalar tenant placeholders {{tenant.property}}
 * and repeating {{#each collection}} ... {{/each}} blocks across
 * template HTML, CSS, and builder previews.
 */

export interface TenantDataPayload {
  id?: string;
  name?: string;
  domain?: string;
  primary_domain?: string;
  fallback_domain?: string;
  website?: string;
  logo?: string;
  tagline?: string;
  description?: string;
  primary_color?: string;
  secondary_color?: string;
  email?: string;
  phone?: string;
  address?: string;
  business_type?: string;
  social?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

export interface DynamicCollectionsPayload {
  courses?: Array<Record<string, unknown>>;
  products?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
  menu_items?: Array<Record<string, unknown>>;
  rooms?: Array<Record<string, unknown>>;
  instructors?: Array<Record<string, unknown>>;
  testimonials?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  gallery?: Array<Record<string, unknown>>;
  faqs?: Array<Record<string, unknown>>;
  statistics?: Array<Record<string, unknown>>;
  team_members?: Array<Record<string, unknown>>;
  [key: string]: Array<Record<string, unknown>> | undefined;
}

const DEFAULT_COLLECTIONS: DynamicCollectionsPayload = {
  courses: [
    {
      title: "Enterprise Full-Stack Architecture",
      description: "Master scalable web systems, distributed microservices, and modern cloud deployment frameworks.",
      category: "Engineering",
      level: "Advanced",
      rating: "4.9",
      duration: "12 Weeks",
      lessons: "48 Lessons",
    },
    {
      title: "Corporate Financial Accounting & IFRS",
      description: "Comprehensive corporate ledger management, tax reconciliation, and financial audit compliance.",
      category: "Finance",
      level: "Intermediate",
      rating: "4.8",
      duration: "8 Weeks",
      lessons: "32 Lessons",
    },
    {
      title: "Executive Agile & Operations Leadership",
      description: "Strategic operations, cross-functional risk mitigation, and high-velocity team leadership.",
      category: "Leadership",
      level: "All Levels",
      rating: "5.0",
      duration: "6 Weeks",
      lessons: "24 Lessons",
    },
  ],
  products: [
    {
      name: "High-Tolerance CNC Components",
      description: "Sub-micron aerospace grade aluminum components with robotic laser inspection.",
      price: "$240.00",
      category: "Industrial",
    },
    {
      name: "Automated Robotic Actuator Units",
      description: "High-cycle industrial automation servos and high-speed stepper modules.",
      price: "$850.00",
      category: "Robotics",
    },
    {
      name: "Aseptic Bottled Mineral Water (1L)",
      description: "9-stage micro-purified spring mineral water in eco-friendly packaging.",
      price: "$1.50",
      category: "Beverage",
    },
  ],
  services: [
    {
      name: "Automated Financial Ledger & ERP",
      description: "Multi-currency general ledger with automated journal entries and audit trails.",
      category: "Finance",
    },
    {
      name: "Cross-Border Corporate M&A Advisory",
      description: "Transaction structuring, risk appraisal, and due diligence execution.",
      category: "Advisory",
    },
    {
      name: "Specialist Cardiovascular Health",
      description: "Advanced echocardiogram diagnostics, stress testing, and preventive cardiology.",
      category: "Clinical",
    },
  ],
  menu_items: [
    {
      name: "Wood-Fired Dry Aged Ribeye",
      description: "45-day aged prime cut, black truffle jus, roasted heirloom vegetables.",
      price: "$48.00",
      category: "Mains",
    },
    {
      name: "Pan-Seared Chilean Sea Bass",
      description: "Saffron broth, crispy leeks, braised baby fennel, citrus emulsion.",
      price: "$42.00",
      category: "Mains",
    },
    {
      name: "Smoked Mezcal Old Fashioned",
      description: "Artisanal mezcal, charred orange peel, organic agave, aromatic bitters.",
      price: "$18.00",
      category: "Cocktails",
    },
  ],
  rooms: [
    {
      name: "Oceanfront Presidential Suite",
      description: "Private infinity plunge pool, panoramic terrace, king master bedroom, and 24/7 dedicated butler.",
      price_per_night: "$650 / night",
      capacity: "2-4 Guests",
      amenities: "Infinity Pool • Ocean View • Private Butler",
    },
    {
      name: "Executive Garden Villa",
      description: "Secluded tropical garden sanctuary with open-air rainfall shower and hydrotherapy tub.",
      price_per_night: "$480 / night",
      capacity: "2 Guests",
      amenities: "Private Garden • Rainfall Spa • King Suite",
    },
  ],
  instructors: [
    {
      name: "Dr. Elena Rostova",
      role: "Principal Cloud Architect",
      description: "Former Tech Fellow with 15+ years architecting enterprise distributed software.",
    },
    {
      name: "Marcus Vance, CFA",
      role: "Corporate Finance Director",
      description: "Advisor to Fortune 500 capital allocations and international transactions.",
    },
  ],
  events: [
    {
      title: "Neon Horizon: Resident DJ Showcase",
      date: "Friday • 10:00 PM",
      description: "Deep tech-house and melodic techno featuring international guest headliners.",
      dj: "DJ Vance & Guest Artists",
    },
    {
      title: "Velvet Saturdays: Ultra VIP Night",
      date: "Saturday • 9:30 PM",
      description: "Signature mixology specials, champagne sparkler presentations, and resident live musicians.",
      dj: "Resident Sound Curators",
    },
  ],
};

/**
 * Escapes unsafe characters for HTML entity safety
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Flattens an object to dot-notation keys
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else if (value !== undefined && value !== null) {
      result[fullKey] = String(value);
    }
  }

  return result;
}

/**
 * Bind tenant scalar values and repeating collections into HTML/CSS content.
 */
export function bindTenantData(
  templateContent: string,
  tenant: TenantDataPayload = {},
  collections: DynamicCollectionsPayload = {},
  assetBaseUrl = ''
): string {
  if (!templateContent) return '';

  let content = templateContent;

  // 1. Normalize and replace asset base URL
  const normalizedAssetBase = assetBaseUrl ? `${assetBaseUrl.replace(/\/+$/, '')}/` : '';
  content = content.replace(/\{\{(assets\.base_url|asset_base_url|assets_base_url|assets\.baseUrl|assetBaseUrl)\}\}/g, normalizedAssetBase);

  // 2. Process repeatable {{#each collection}} ... {{/each}} blocks
  const eachRegex = /\{\{#each\s+([a-zA-Z0-9_\-\.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  content = content.replace(eachRegex, (_match, rawCollectionName: string, itemTemplate: string) => {
    const collectionName = rawCollectionName.trim();
    let items = collections[collectionName];

    if (!Array.isArray(items) || items.length === 0) {
      items = DEFAULT_COLLECTIONS[collectionName];
    }

    if (!Array.isArray(items) || items.length === 0) {
      return '';
    }

    return items
      .map((item, index) => {
        let rendered = itemTemplate;
        rendered = rendered.replace(/\{\{(@index|@key)\}\}/g, String(index));
        rendered = rendered.replace(/\{\{@iteration\}\}/g, String(index + 1));

        for (const [field, val] of Object.entries(item)) {
          if (val !== undefined && val !== null) {
            const escapedVal = escapeHtml(String(val));
            const fieldRegex = new RegExp(`\\{\\{(?:this\\.|item\\.)?${field}\\}\\}`, 'g');
            rendered = rendered.replace(fieldRegex, escapedVal);
          }
        }

        // Clean any leftover unresolved placeholders in this item block
        rendered = rendered.replace(/\{\{[a-zA-Z0-9_\-\.]+\}\}/g, '');
        return rendered;
      })
      .join('\n');
  });

  // 3. Process scalar {{tenant.property}} placeholders
  const flatTenant = flattenObject(tenant as Record<string, unknown>, 'tenant');
  for (const [key, val] of Object.entries(flatTenant)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(placeholder, escapeHtml(val));
  }

  return content;
}
