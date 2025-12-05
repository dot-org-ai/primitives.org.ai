/**
 * Directory Business Example
 *
 * A complete example of a directory/listing business modeled using primitives.org.ai
 * Think: ProductHunt, Crunchbase, G2, Capterra, Yellow Pages, Yelp for B2B
 *
 * @example TechDirectory - A curated directory of SaaS tools
 * @packageDocumentation
 */

/**
 * NOTE: These examples demonstrate the DESIRED API shape for business-as-code.
 * Some types may not exist yet in the actual package. The examples serve as
 * documentation and specification for the ideal primitives API.
 */

// Use any for flexibility - these examples define the ideal API shape
const Business = (def: any) => def
const Product = (def: any) => def
const Service = (def: any) => def
const Goals = (defs: any[]) => defs
const Vision = (def: any) => def
const kpis = (defs: any[]) => defs
const okrs = (defs: any[]) => defs
const financials = (def: any) => def
const Process = (def: any) => def
const Workflow = (def: any) => def
const createBusinessRole = (def: any) => def

// Re-export Organization type placeholder
export interface Organization {
  id: string
  name: string
  settings?: any
  departments?: any[]
  teams?: any[]
  roles?: any[]
  approvalChains?: any[]
  routingRules?: any[]
}

// $ helper placeholder
const $ = {
  format: (n: number) => `$${n.toLocaleString()}`,
  growth: (current: number, previous: number) => ((current - previous) / previous * 100).toFixed(1),
  margin: (revenue: number, cost: number) => ((revenue - cost) / revenue * 100).toFixed(1),
}

// =============================================================================
// 1. BUSINESS DEFINITION
// =============================================================================

/**
 * TechDirectory - Curated SaaS Tools Directory
 */
export const TechDirectoryBusiness = Business({
  name: 'TechDirectory Inc.',
  mission: 'Help businesses discover and compare the best software tools',
  values: ['Curation Quality', 'User Trust', 'Vendor Fairness', 'Community'],
  industry: 'Media / Information Services',
  founded: new Date('2020-03-15'),
  stage: 'growth',
  structure: {
    departments: [
      {
        name: 'Product & Engineering',
        headcount: 18,
        budget: 2200000,
        teams: [
          { name: 'Platform', headcount: 6, focus: 'Core directory platform' },
          { name: 'Search & Discovery', headcount: 4, focus: 'Search, recommendations' },
          { name: 'Data', headcount: 4, focus: 'Data pipelines, enrichment' },
          { name: 'Growth', headcount: 4, focus: 'Acquisition, engagement' },
        ],
      },
      {
        name: 'Content & Curation',
        headcount: 12,
        budget: 900000,
        teams: [
          { name: 'Editorial', headcount: 4, focus: 'Reviews, guides, comparisons' },
          { name: 'Curation', headcount: 4, focus: 'Listing quality, verification' },
          { name: 'Community', headcount: 4, focus: 'User reviews, Q&A' },
        ],
      },
      {
        name: 'Sales & Partnerships',
        headcount: 10,
        budget: 1200000,
        teams: [
          { name: 'Vendor Sales', headcount: 5, focus: 'Premium listings' },
          { name: 'Partnerships', headcount: 3, focus: 'Affiliate, integrations' },
          { name: 'Account Management', headcount: 2, focus: 'Vendor success' },
        ],
      },
      {
        name: 'Marketing',
        headcount: 6,
        budget: 800000,
        teams: [
          { name: 'SEO & Content', headcount: 3 },
          { name: 'Demand Gen', headcount: 3 },
        ],
      },
    ],
  },
})

// =============================================================================
// 2. VISION & GOALS
// =============================================================================

export const TechDirectoryVision = Vision({
  statement: 'Be the most trusted source for software discovery worldwide',
  timeHorizon: '2027',
  pillars: [
    'Content Quality',
    'User Trust',
    'Vendor Ecosystem',
    'Data Excellence',
  ],
  successIndicators: [
    { name: 'Monthly Visitors', target: 10000000 },
    { name: 'Listed Tools', target: 50000 },
    { name: 'Verified Reviews', target: 500000 },
    { name: 'Vendor NPS', target: 50 },
  ],
})

export const TechDirectoryGoals = Goals([
  {
    name: 'Reach 3M Monthly Visitors',
    category: 'growth',
    status: 'in-progress',
    progress: 70,
    dueDate: new Date('2024-12-31'),
    owner: 'VP Marketing',
  },
  {
    name: 'Launch AI-Powered Recommendations',
    category: 'product',
    status: 'in-progress',
    progress: 45,
    dueDate: new Date('2024-06-30'),
    owner: 'VP Product',
  },
  {
    name: 'Expand to 25K Listed Tools',
    category: 'content',
    status: 'in-progress',
    progress: 60,
    dueDate: new Date('2024-09-30'),
    owner: 'Content Lead',
  },
  {
    name: '1000 Paying Vendors',
    category: 'revenue',
    status: 'in-progress',
    progress: 65,
    dueDate: new Date('2024-12-31'),
    owner: 'VP Sales',
  },
  {
    name: '$5M ARR',
    category: 'financial',
    status: 'in-progress',
    progress: 55,
    dueDate: new Date('2024-12-31'),
    owner: 'CEO',
  },
])

// =============================================================================
// 3. PRODUCTS & SERVICES
// =============================================================================

export const DirectoryPlatform = Product({
  name: 'TechDirectory Platform',
  description: 'The core directory platform for discovering software tools',
  pricingModel: 'freemium',
  features: [
    'Tool search & discovery',
    'Category browsing',
    'Comparison tables',
    'User reviews & ratings',
    'Tool profiles',
    'Alternatives finder',
    'Stack builder',
  ],
  roadmap: [
    { name: 'AI Recommendations', status: 'in-progress', priority: 'high', targetDate: new Date('2024-Q2') },
    { name: 'Integration Directory', status: 'planned', priority: 'medium', targetDate: new Date('2024-Q3') },
    { name: 'Pricing Intelligence', status: 'planned', priority: 'high', targetDate: new Date('2024-Q4') },
  ],
})

/**
 * Vendor Products (B2B Revenue)
 */
export const VendorProducts = {
  basicListing: Product({
    name: 'Basic Listing',
    description: 'Free listing with verified profile',
    pricingModel: 'free',
    features: [
      'Basic profile',
      'Logo & description',
      'Category listing',
      'User reviews',
      'Basic analytics',
    ],
  }),
  premiumListing: Product({
    name: 'Premium Listing',
    description: 'Enhanced visibility and features',
    pricingModel: 'subscription',
    price: 299, // /month
    features: [
      'Everything in Basic',
      'Featured placement',
      'Rich media gallery',
      'Lead capture form',
      'Review response',
      'Competitor insights',
      'Advanced analytics',
    ],
  }),
  sponsoredPlacement: Product({
    name: 'Sponsored Placement',
    description: 'Top visibility in search and categories',
    pricingModel: 'usage-based',
    price: 5, // per click
    features: [
      'Category top placement',
      'Search result boost',
      'Comparison table feature',
      'Homepage showcase',
    ],
  }),
  enterpriseProfile: Product({
    name: 'Enterprise Profile',
    description: 'Full-featured vendor presence',
    pricingModel: 'subscription',
    price: 999, // /month
    features: [
      'Everything in Premium',
      'Dedicated landing page',
      'Case study publishing',
      'Integration showcase',
      'Custom badges',
      'API access',
      'Dedicated support',
    ],
  }),
}

/**
 * Affiliate & Lead Services
 */
export const AffiliateServices = Service({
  name: 'Affiliate Partnerships',
  description: 'Revenue share on qualified leads',
  pricingModel: 'performance-based',
  deliverables: [
    'Click tracking',
    'Conversion attribution',
    'Monthly reporting',
    'Dedicated affiliate link',
  ],
})

// =============================================================================
// 4. ORGANIZATION & ROLES
// =============================================================================

export const TechDirectoryOrg: Organization = {
  id: 'techdirectory',
  name: 'TechDirectory Inc.',
  settings: {
    timezone: 'America/New_York',
    currency: 'USD',
    fiscalYearStart: 1,
  },
  departments: [
    {
      id: 'content',
      name: 'Content & Curation',
      permissions: {
        listings: ['read', 'write', 'publish', 'feature'],
        reviews: ['read', 'write', 'moderate'],
        content: ['read', 'write', 'publish'],
      },
      teams: [
        {
          id: 'editorial',
          name: 'Editorial',
          positions: [
            { id: 'editor-chief', title: 'Editor in Chief', roleId: 'content-lead', reportsTo: 'ceo' },
            { id: 'senior-editor', title: 'Senior Editor', roleId: 'editor', reportsTo: 'editor-chief' },
          ],
        },
        {
          id: 'curation',
          name: 'Curation',
          positions: [
            { id: 'curation-lead', title: 'Curation Lead', roleId: 'curator', reportsTo: 'editor-chief' },
            { id: 'curator-1', title: 'Curator', roleId: 'curator', reportsTo: 'curation-lead' },
          ],
        },
      ],
    },
    {
      id: 'sales',
      name: 'Sales & Partnerships',
      permissions: {
        vendors: ['read', 'write', 'manage'],
        deals: ['read', 'write', 'negotiate'],
        partnerships: ['read', 'write', 'manage'],
      },
    },
    {
      id: 'engineering',
      name: 'Engineering',
      permissions: {
        code: ['read', 'write', 'deploy'],
        data: ['read', 'write', 'manage'],
        infrastructure: ['read', 'write'],
      },
    },
  ],
  roles: [
    createBusinessRole({
      id: 'content-lead',
      name: 'Content Lead',
      type: 'manager',
      level: 6,
      permissions: {
        listings: ['read', 'write', 'publish', 'feature', 'delete'],
        reviews: ['read', 'write', 'moderate', 'delete'],
        content: ['read', 'write', 'publish'],
      },
      canHandle: ['content-strategy', 'editorial-review', 'quality-control'],
      canApprove: ['listing-publish', 'feature-decision', 'content-removal'],
    }),
    createBusinessRole({
      id: 'editor',
      name: 'Editor',
      type: 'support',
      level: 4,
      permissions: {
        listings: ['read', 'write', 'publish'],
        reviews: ['read', 'write', 'moderate'],
        content: ['read', 'write'],
      },
      canHandle: ['listing-review', 'content-editing', 'comparison-writing'],
    }),
    createBusinessRole({
      id: 'curator',
      name: 'Curator',
      type: 'support',
      level: 3,
      permissions: {
        listings: ['read', 'write'],
        reviews: ['read', 'moderate'],
      },
      canHandle: ['listing-verification', 'data-enrichment', 'categorization'],
    }),
    createBusinessRole({
      id: 'community-mod',
      name: 'Community Moderator',
      type: 'support',
      level: 2,
      workerType: 'hybrid', // AI + human
      permissions: {
        reviews: ['read', 'moderate'],
        comments: ['read', 'moderate'],
      },
      canHandle: ['review-moderation', 'spam-detection', 'community-response'],
    }),
    createBusinessRole({
      id: 'vendor-success',
      name: 'Vendor Success Manager',
      type: 'support',
      level: 4,
      permissions: {
        vendors: ['read', 'write'],
        listings: ['read'],
        analytics: ['read'],
      },
      canHandle: ['vendor-onboarding', 'listing-optimization', 'renewal-management'],
    }),
    createBusinessRole({
      id: 'data-enrichment-bot',
      name: 'Data Enrichment Bot',
      type: 'agent',
      level: 1,
      workerType: 'ai',
      permissions: {
        listings: ['read', 'write'],
        data: ['read', 'write'],
      },
      canHandle: ['data-scraping', 'profile-enrichment', 'pricing-updates'],
    }),
  ],
  routingRules: [
    {
      id: 'new-listing-review',
      taskType: 'listing-review',
      priority: 1,
      assignTo: { roleId: 'curator' },
    },
    {
      id: 'review-moderation',
      taskType: 'review-moderation',
      priority: 1,
      assignTo: { roleId: 'community-mod' },
    },
    {
      id: 'vendor-inquiry',
      taskType: 'vendor-inquiry',
      priority: 2,
      assignTo: { roleId: 'vendor-success' },
    },
  ],
}

// =============================================================================
// 5. KPIs & METRICS
// =============================================================================

export const TechDirectoryKPIs = kpis([
  // Traffic & Engagement
  {
    name: 'Monthly Unique Visitors',
    category: 'operational',
    target: 3000000,
    current: 2100000,
    frequency: 'monthly',
    owner: 'VP Marketing',
  },
  {
    name: 'Pages per Session',
    category: 'operational',
    target: 4.5,
    current: 3.8,
    frequency: 'weekly',
    owner: 'VP Product',
  },
  {
    name: 'Time on Site',
    category: 'operational',
    target: 5,
    current: 4.2,
    unit: 'minutes',
    frequency: 'weekly',
    owner: 'VP Product',
  },
  {
    name: 'Bounce Rate',
    category: 'operational',
    target: 40,
    current: 48,
    unit: '%',
    frequency: 'weekly',
    owner: 'VP Marketing',
  },
  // Content Metrics
  {
    name: 'Listed Tools',
    category: 'content',
    target: 25000,
    current: 15000,
    frequency: 'monthly',
    owner: 'Content Lead',
  },
  {
    name: 'Verified Reviews',
    category: 'content',
    target: 200000,
    current: 125000,
    frequency: 'monthly',
    owner: 'Community Lead',
  },
  {
    name: 'Data Completeness Score',
    category: 'content',
    target: 90,
    current: 78,
    unit: '%',
    frequency: 'monthly',
    owner: 'Data Lead',
  },
  // Revenue Metrics
  {
    name: 'Paying Vendors',
    category: 'financial',
    target: 1000,
    current: 650,
    frequency: 'monthly',
    owner: 'VP Sales',
  },
  {
    name: 'MRR',
    category: 'financial',
    target: 400000,
    current: 275000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'CEO',
  },
  {
    name: 'Affiliate Revenue',
    category: 'financial',
    target: 80000,
    current: 55000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'Partnerships Lead',
  },
  {
    name: 'Vendor Churn Rate',
    category: 'customer',
    target: 3,
    current: 4.5,
    unit: '%',
    frequency: 'monthly',
    owner: 'VP Sales',
  },
  // SEO Metrics
  {
    name: 'Organic Traffic Share',
    category: 'marketing',
    target: 70,
    current: 62,
    unit: '%',
    frequency: 'monthly',
    owner: 'SEO Lead',
  },
  {
    name: 'Ranking Keywords',
    category: 'marketing',
    target: 50000,
    current: 32000,
    frequency: 'monthly',
    owner: 'SEO Lead',
  },
])

// =============================================================================
// 6. OKRs
// =============================================================================

export const TechDirectoryOKRs = okrs([
  {
    objective: 'Become the Go-To Resource for Software Discovery',
    owner: 'CEO',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Reach 2.5M monthly visitors',
        metric: 'Monthly Visitors',
        targetValue: 2500000,
        currentValue: 2100000,
      },
      {
        description: 'Achieve 4+ pages per session',
        metric: 'Pages per Session',
        targetValue: 4,
        currentValue: 3.8,
      },
      {
        description: 'Grow to 20K listed tools',
        metric: 'Listed Tools',
        targetValue: 20000,
        currentValue: 15000,
      },
    ],
  },
  {
    objective: 'Build Trust Through Quality Content',
    owner: 'Content Lead',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Achieve 85% data completeness',
        metric: 'Data Completeness',
        targetValue: 85,
        currentValue: 78,
        unit: '%',
      },
      {
        description: 'Publish 100 in-depth comparisons',
        metric: 'Comparisons Published',
        targetValue: 100,
        currentValue: 45,
      },
      {
        description: 'Verify 50K new reviews',
        metric: 'Verified Reviews',
        targetValue: 50000,
        currentValue: 28000,
      },
    ],
  },
  {
    objective: 'Scale Vendor Revenue',
    owner: 'VP Sales',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Reach 800 paying vendors',
        metric: 'Paying Vendors',
        targetValue: 800,
        currentValue: 650,
      },
      {
        description: 'Achieve $350K MRR',
        metric: 'MRR',
        targetValue: 350000,
        currentValue: 275000,
        unit: 'USD',
      },
      {
        description: 'Reduce vendor churn to 3%',
        metric: 'Vendor Churn',
        targetValue: 3,
        currentValue: 4.5,
        unit: '%',
      },
    ],
  },
  {
    objective: 'Dominate Organic Search',
    owner: 'VP Marketing',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Rank for 40K keywords',
        metric: 'Ranking Keywords',
        targetValue: 40000,
        currentValue: 32000,
      },
      {
        description: 'Achieve 65% organic traffic share',
        metric: 'Organic Traffic',
        targetValue: 65,
        currentValue: 62,
        unit: '%',
      },
      {
        description: 'Top 3 ranking for 500 key terms',
        metric: 'Top 3 Rankings',
        targetValue: 500,
        currentValue: 320,
      },
    ],
  },
])

// =============================================================================
// 7. PROCESSES
// =============================================================================

export const ListingSubmissionProcess = Process({
  name: 'Listing Submission',
  description: 'Process for new tool listings',
  owner: 'Content Lead',
  steps: [
    {
      order: 1,
      name: 'Submission',
      description: 'Vendor submits listing request',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 2,
      name: 'Initial Validation',
      description: 'Automated validation of submission data',
      automationLevel: 'automated',
      duration: '5 minutes',
    },
    {
      order: 3,
      name: 'Data Enrichment',
      description: 'AI enriches profile with public data',
      automationLevel: 'automated',
      duration: '30 minutes',
    },
    {
      order: 4,
      name: 'Human Review',
      description: 'Curator reviews and verifies listing',
      automationLevel: 'manual',
      duration: '1 day',
      owner: 'Curator',
    },
    {
      order: 5,
      name: 'Categorization',
      description: 'Assign categories and tags',
      automationLevel: 'semi-automated',
      duration: '15 minutes',
      owner: 'Curator',
    },
    {
      order: 6,
      name: 'Publication',
      description: 'Publish listing to directory',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 7,
      name: 'Notification',
      description: 'Notify vendor of publication',
      automationLevel: 'automated',
      duration: 'instant',
    },
  ],
  metrics: [
    { name: 'Time to Publish', target: 48, unit: 'hours' },
    { name: 'Approval Rate', target: 85, unit: '%' },
    { name: 'Data Quality Score', target: 90, unit: '%' },
  ],
})

export const ReviewModerationProcess = Process({
  name: 'Review Moderation',
  description: 'Moderate user reviews for quality and authenticity',
  owner: 'Community Lead',
  steps: [
    {
      order: 1,
      name: 'Submission',
      description: 'User submits review',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 2,
      name: 'Spam Check',
      description: 'AI filters obvious spam',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 3,
      name: 'Sentiment Analysis',
      description: 'Analyze review sentiment and flag outliers',
      automationLevel: 'automated',
      duration: '1 minute',
    },
    {
      order: 4,
      name: 'Verification',
      description: 'Verify reviewer identity and usage',
      automationLevel: 'semi-automated',
      duration: '5 minutes',
    },
    {
      order: 5,
      name: 'Human Review',
      description: 'Moderator reviews flagged reviews',
      automationLevel: 'manual',
      duration: '30 minutes',
      owner: 'Community Moderator',
    },
    {
      order: 6,
      name: 'Publication',
      description: 'Publish approved review',
      automationLevel: 'automated',
      duration: 'instant',
    },
  ],
  metrics: [
    { name: 'Auto-Approval Rate', target: 80, unit: '%' },
    { name: 'Moderation Time', target: 2, unit: 'hours' },
    { name: 'Fake Review Detection', target: 99, unit: '%' },
  ],
})

export const VendorOnboardingProcess = Process({
  name: 'Vendor Onboarding',
  description: 'Onboard new paying vendors',
  owner: 'VP Sales',
  steps: [
    {
      order: 1,
      name: 'Welcome',
      description: 'Send welcome email with credentials',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 2,
      name: 'Kickoff Call',
      description: 'Introduction call with vendor',
      automationLevel: 'manual',
      duration: '30 minutes',
      owner: 'Vendor Success Manager',
    },
    {
      order: 3,
      name: 'Profile Setup',
      description: 'Help vendor complete premium profile',
      automationLevel: 'semi-automated',
      duration: '1 week',
      owner: 'Vendor Success Manager',
    },
    {
      order: 4,
      name: 'Badge Assignment',
      description: 'Assign verified badges',
      automationLevel: 'semi-automated',
      duration: '1 day',
    },
    {
      order: 5,
      name: 'Training',
      description: 'Train on analytics and lead management',
      automationLevel: 'manual',
      duration: '1 hour',
      owner: 'Vendor Success Manager',
    },
    {
      order: 6,
      name: 'Go Live',
      description: 'Activate premium features',
      automationLevel: 'automated',
      duration: 'instant',
    },
  ],
  metrics: [
    { name: 'Time to Value', target: 7, unit: 'days' },
    { name: 'Profile Completion Rate', target: 95, unit: '%' },
    { name: 'Vendor CSAT', target: 90, unit: '%' },
  ],
})

// =============================================================================
// 8. WORKFLOWS
// =============================================================================

export const NewListingWorkflow = Workflow({
  name: 'New Listing Processing',
  description: 'Automated processing of new listing submissions',
  trigger: { type: 'event', event: 'listing.submitted' },
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Validate Submission',
      config: {
        checks: ['url_valid', 'name_unique', 'description_length', 'category_valid'],
      },
    },
    {
      order: 2,
      type: 'condition',
      name: 'Check Validation',
      condition: 'validation.passed == true',
    },
    {
      order: 3,
      type: 'api',
      name: 'Enrich Data',
      config: {
        sources: ['clearbit', 'linkedin', 'crunchbase'],
        fields: ['logo', 'employees', 'funding', 'social'],
      },
    },
    {
      order: 4,
      type: 'compute',
      name: 'Auto-Categorize',
      config: {
        model: 'category-classifier',
        confidence_threshold: 0.8,
      },
    },
    {
      order: 5,
      type: 'condition',
      name: 'Check Auto-Approval',
      condition: 'enrichment.score >= 80 && categorization.confidence >= 0.9',
    },
    {
      order: 6,
      type: 'task',
      name: 'Queue for Review',
      config: {
        type: 'listing-review',
        assignTo: 'curator',
        priority: 'normal',
      },
    },
  ],
})

export const ReviewVerificationWorkflow = Workflow({
  name: 'Review Verification',
  description: 'Verify authenticity of user reviews',
  trigger: { type: 'event', event: 'review.submitted' },
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Spam Detection',
      config: {
        model: 'spam-classifier',
        checks: ['content', 'user_history', 'ip_reputation'],
      },
    },
    {
      order: 2,
      type: 'condition',
      name: 'Check Spam',
      condition: 'spam.score < 0.3',
    },
    {
      order: 3,
      type: 'compute',
      name: 'Verify User',
      config: {
        checks: ['email_verified', 'linked_profile', 'usage_signals'],
      },
    },
    {
      order: 4,
      type: 'compute',
      name: 'Analyze Content',
      config: {
        checks: ['sentiment', 'specificity', 'helpful_vote_prediction'],
      },
    },
    {
      order: 5,
      type: 'condition',
      name: 'Check Auto-Approve',
      condition: 'verification.score >= 70 && content.score >= 60',
    },
    {
      order: 6,
      type: 'api',
      name: 'Publish Review',
      config: { action: 'publish', notify_vendor: true },
    },
    {
      order: 7,
      type: 'task',
      name: 'Queue Manual Review',
      config: {
        type: 'review-moderation',
        assignTo: 'community-mod',
        reason: 'auto_approval_failed',
      },
    },
  ],
})

export const VendorEngagementWorkflow = Workflow({
  name: 'Vendor Engagement',
  description: 'Engage free vendors for conversion',
  trigger: { type: 'schedule', cron: '0 10 * * 1' }, // Weekly Monday 10am
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Identify High-Value Free Vendors',
      config: {
        criteria: {
          profile_views: '> 1000',
          review_count: '> 10',
          days_since_signup: '> 30',
          has_premium: false,
        },
      },
    },
    {
      order: 2,
      type: 'notification',
      name: 'Send Upgrade Email',
      config: {
        template: 'vendor_upgrade_offer',
        channel: 'email',
        personalize: ['profile_views', 'competitor_comparison'],
      },
    },
    {
      order: 3,
      type: 'wait',
      name: 'Wait 3 Days',
      duration: '3 days',
    },
    {
      order: 4,
      type: 'condition',
      name: 'Check Not Converted',
      condition: 'vendor.plan == "free"',
    },
    {
      order: 5,
      type: 'task',
      name: 'Assign Sales Outreach',
      config: {
        type: 'vendor-outreach',
        assignTo: 'vendor-sales',
        data: ['vendor.id', 'engagement_score'],
      },
    },
  ],
})

// =============================================================================
// 9. FINANCIALS
// =============================================================================

export const TechDirectoryFinancials = financials({
  revenue: 3960000, // ARR
  cogs: 594000, // 15% (mostly hosting/data)
  operatingExpenses: 2800000,
  depreciation: 50000,
  interestExpense: 0,
  otherIncome: 30000,
  taxes: 100000,
})

export const DirectoryMetrics = {
  mrr: 275000,
  arr: 3300000,
  affiliateRevenue: 660000, // yearly
  totalRevenue: 3960000,
  visitors: {
    monthly: 2100000,
    organic: 1302000, // 62%
    pagesPerSession: 3.8,
    bounceRate: 48,
  },
  content: {
    listedTools: 15000,
    verifiedReviews: 125000,
    comparisons: 450,
    guides: 200,
  },
  vendors: {
    total: 15000,
    paying: 650,
    premium: 450,
    enterprise: 50,
    sponsored: 150,
    conversionRate: 4.3, // %
  },
  arpu: 423, // MRR / paying vendors
  vendorChurn: 4.5, // %
  cac: 1200,
  ltv: 9500, // 22 months avg
}

// =============================================================================
// 10. UTILITY FUNCTIONS
// =============================================================================

export function getBusinessSummary() {
  return {
    company: TechDirectoryBusiness,
    vision: TechDirectoryVision,
    goals: TechDirectoryGoals,
    products: { platform: DirectoryPlatform, vendor: VendorProducts },
    kpis: TechDirectoryKPIs,
    okrs: TechDirectoryOKRs,
    financials: TechDirectoryFinancials,
    metrics: DirectoryMetrics,
  }
}

export function getTrafficMetrics() {
  return {
    visitors: DirectoryMetrics.visitors.monthly.toLocaleString(),
    organic: `${((DirectoryMetrics.visitors.organic / DirectoryMetrics.visitors.monthly) * 100).toFixed(0)}%`,
    pagesPerSession: DirectoryMetrics.visitors.pagesPerSession,
    bounceRate: `${DirectoryMetrics.visitors.bounceRate}%`,
  }
}

export function getVendorMetrics() {
  return {
    total: DirectoryMetrics.vendors.total.toLocaleString(),
    paying: DirectoryMetrics.vendors.paying,
    conversionRate: `${DirectoryMetrics.vendors.conversionRate}%`,
    mrr: $.format(DirectoryMetrics.mrr),
    arpu: $.format(DirectoryMetrics.arpu),
  }
}

export default {
  business: TechDirectoryBusiness,
  vision: TechDirectoryVision,
  goals: TechDirectoryGoals,
  products: { platform: DirectoryPlatform, vendor: VendorProducts },
  services: { affiliate: AffiliateServices },
  organization: TechDirectoryOrg,
  kpis: TechDirectoryKPIs,
  okrs: TechDirectoryOKRs,
  processes: {
    listingSubmission: ListingSubmissionProcess,
    reviewModeration: ReviewModerationProcess,
    vendorOnboarding: VendorOnboardingProcess,
  },
  workflows: {
    newListing: NewListingWorkflow,
    reviewVerification: ReviewVerificationWorkflow,
    vendorEngagement: VendorEngagementWorkflow,
  },
  financials: TechDirectoryFinancials,
  metrics: DirectoryMetrics,
}
