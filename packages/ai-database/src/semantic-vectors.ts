/**
 * Semantic Word Vectors Configuration
 *
 * This file contains the semantic word vectors used for deterministic
 * mock embeddings in tests. Words in similar semantic domains have
 * similar vectors, enabling meaningful similarity calculations.
 *
 * Vector dimensions represent:
 * - [0]: AI/ML domain strength
 * - [1]: Programming/Code domain strength
 * - [2]: DevOps/Infrastructure domain strength
 * - [3]: Other domain (food, business, etc.) strength
 *
 * To add new vectors:
 * 1. Identify the semantic domain the word belongs to
 * 2. Set high values (0.7-0.95) for the primary domain dimension
 * 3. Set lower values (0.05-0.3) for other dimensions
 * 4. Ensure related words have similar vectors for meaningful similarity
 *
 * @packageDocumentation
 */

/**
 * Semantic vectors for deterministic mock embeddings.
 *
 * Each word maps to a 4-dimensional vector representing its semantic "position"
 * across different domains. Similar words have similar vectors.
 */
export const SEMANTIC_VECTORS: Record<string, number[]> = {
  // ===========================================================================
  // AI/ML Domain - High in dimension 0
  // ===========================================================================
  machine: [0.9, 0.1, 0.05, 0.02],
  learning: [0.85, 0.15, 0.08, 0.03],
  artificial: [0.88, 0.12, 0.06, 0.04],
  intelligence: [0.87, 0.13, 0.07, 0.05],
  neural: [0.82, 0.18, 0.09, 0.06],
  network: [0.75, 0.2, 0.15, 0.1],
  deep: [0.8, 0.17, 0.1, 0.08],
  ai: [0.92, 0.08, 0.04, 0.02],
  ml: [0.88, 0.12, 0.06, 0.03],
  models: [0.86, 0.14, 0.08, 0.04],

  // Research/Academic domain (similar to AI/ML)
  researcher: [0.82, 0.2, 0.1, 0.08],
  phd: [0.8, 0.18, 0.12, 0.1],
  research: [0.85, 0.15, 0.1, 0.07],
  professor: [0.78, 0.22, 0.12, 0.1],
  academic: [0.75, 0.2, 0.15, 0.12],

  // Data science domain
  data: [0.75, 0.3, 0.15, 0.55],
  science: [0.78, 0.25, 0.12, 0.5],
  scientist: [0.8, 0.28, 0.1, 0.52],
  background: [0.72, 0.32, 0.14, 0.48],

  // ===========================================================================
  // Programming Domain - High in dimension 1
  // ===========================================================================
  programming: [0.15, 0.85, 0.1, 0.05],
  code: [0.12, 0.88, 0.12, 0.06],
  software: [0.18, 0.82, 0.15, 0.08],
  development: [0.2, 0.8, 0.18, 0.1],
  typescript: [0.1, 0.9, 0.08, 0.04],
  javascript: [0.12, 0.88, 0.1, 0.05],
  python: [0.25, 0.75, 0.12, 0.06],
  react: [0.08, 0.85, 0.2, 0.1],
  vue: [0.06, 0.84, 0.18, 0.08],
  frontend: [0.05, 0.8, 0.25, 0.12],
  programs: [0.14, 0.86, 0.1, 0.04],
  program: [0.14, 0.86, 0.1, 0.04],
  write: [0.12, 0.84, 0.08, 0.05],
  develop: [0.18, 0.82, 0.12, 0.08],
  utility: [0.1, 0.8, 0.15, 0.1],
  specialized: [0.15, 0.78, 0.12, 0.08],

  // Tech professional domain
  developer: [0.2, 0.85, 0.15, 0.1],
  engineer: [0.25, 0.82, 0.18, 0.12],
  engineers: [0.27, 0.8, 0.2, 0.14],
  builds: [0.18, 0.78, 0.16, 0.08],
  writes: [0.15, 0.75, 0.12, 0.06],
  professional: [0.22, 0.72, 0.2, 0.15],
  applications: [0.2, 0.78, 0.18, 0.1],
  tech: [0.25, 0.8, 0.2, 0.12],
  technology: [0.28, 0.78, 0.22, 0.14],
  electronics: [0.3, 0.75, 0.25, 0.15],
  device: [0.25, 0.82, 0.2, 0.1],

  // Web development technologies
  web: [0.1, 0.86, 0.12, 0.06],
  technologies: [0.12, 0.84, 0.14, 0.08],
  node: [0.1, 0.88, 0.1, 0.04],
  js: [0.12, 0.86, 0.12, 0.06],
  backend: [0.15, 0.82, 0.18, 0.1],

  // Testing
  testing: [0.1, 0.78, 0.08, 0.15],
  test: [0.08, 0.8, 0.06, 0.12],
  unit: [0.06, 0.82, 0.05, 0.1],
  integration: [0.12, 0.75, 0.1, 0.18],

  // State management
  state: [0.08, 0.82, 0.2, 0.08],
  management: [0.15, 0.75, 0.25, 0.12],
  hooks: [0.06, 0.88, 0.15, 0.05],
  usestate: [0.05, 0.9, 0.12, 0.04],
  useeffect: [0.04, 0.88, 0.1, 0.03],

  // Database domain
  database: [0.1, 0.7, 0.08, 0.6],
  query: [0.12, 0.65, 0.1, 0.7],
  sql: [0.08, 0.6, 0.05, 0.75],
  index: [0.1, 0.58, 0.08, 0.72],
  optimization: [0.15, 0.55, 0.12, 0.68],
  performance: [0.18, 0.5, 0.15, 0.65],

  // GraphQL/API
  graphql: [0.1, 0.75, 0.15, 0.55],
  rest: [0.12, 0.68, 0.18, 0.48],
  queries: [0.14, 0.65, 0.12, 0.6],

  // ===========================================================================
  // DevOps/Infrastructure Domain - High in dimension 2
  // ===========================================================================
  kubernetes: [0.05, 0.6, 0.8, 0.15],
  docker: [0.08, 0.55, 0.82, 0.12],
  container: [0.06, 0.5, 0.85, 0.1],
  deployment: [0.1, 0.45, 0.78, 0.18],
  devops: [0.12, 0.48, 0.75, 0.2],
  cloud: [0.1, 0.55, 0.85, 0.15],
  expertise: [0.15, 0.5, 0.8, 0.18],

  // Location/Venue domain
  conference: [0.2, 0.25, 0.85, 0.2],
  center: [0.18, 0.22, 0.88, 0.18],
  downtown: [0.15, 0.2, 0.9, 0.15],
  hub: [0.85, 0.15, 0.2, 0.15],
  main: [0.12, 0.12, 0.15, 0.1],
  st: [0.1, 0.1, 0.12, 0.08],
  '123': [0.08, 0.08, 0.1, 0.05],

  // ===========================================================================
  // Food Domain - High in dimension 3
  // ===========================================================================
  cooking: [0.05, 0.08, 0.05, 0.95],
  recipe: [0.06, 0.07, 0.04, 0.93],
  food: [0.04, 0.06, 0.04, 0.96],
  pasta: [0.03, 0.05, 0.03, 0.97],
  pizza: [0.03, 0.06, 0.04, 0.96],
  italian: [0.04, 0.07, 0.04, 0.94],
  garden: [0.05, 0.04, 0.03, 0.92],
  flowers: [0.04, 0.03, 0.03, 0.91],
  chef: [0.05, 0.1, 0.05, 0.95],
  restaurant: [0.06, 0.08, 0.04, 0.93],
  kitchen: [0.05, 0.09, 0.05, 0.94],
  antonio: [0.05, 0.08, 0.04, 0.92],

  // ===========================================================================
  // Business/Enterprise Domain
  // ===========================================================================
  enterprise: [0.7, 0.3, 0.8, 0.6],
  large: [0.65, 0.25, 0.75, 0.55],
  corporations: [0.68, 0.28, 0.78, 0.58],
  companies: [0.6, 0.4, 0.7, 0.5],
  company: [0.62, 0.38, 0.72, 0.52],
  thousands: [0.7, 0.2, 0.7, 0.5],
  employees: [0.55, 0.35, 0.65, 0.45],
  big: [0.68, 0.3, 0.75, 0.58],
  small: [0.3, 0.6, 0.3, 0.4],
  business: [0.5, 0.5, 0.6, 0.5],
  owners: [0.4, 0.5, 0.5, 0.45],
  consumer: [0.35, 0.55, 0.35, 0.35],
  individual: [0.32, 0.58, 0.32, 0.32],
  b2c: [0.3, 0.6, 0.3, 0.35],

  // Management/Operations domain
  operations: [0.6, 0.15, 0.85, 0.55],
  coordinate: [0.55, 0.12, 0.82, 0.5],
  plan: [0.52, 0.18, 0.78, 0.48],
  direct: [0.58, 0.14, 0.8, 0.52],
  formulate: [0.5, 0.2, 0.75, 0.45],
  policies: [0.48, 0.15, 0.78, 0.5],
  direction: [0.55, 0.18, 0.76, 0.48],
  organizations: [0.6, 0.2, 0.8, 0.55],
  sector: [0.58, 0.22, 0.75, 0.52],
  determine: [0.52, 0.16, 0.72, 0.46],

  // Marketing domain
  marketing: [0.4, 0.45, 0.55, 0.4],
  manager: [0.38, 0.48, 0.52, 0.38],
  strategy: [0.42, 0.5, 0.5, 0.35],
  charge: [0.35, 0.42, 0.55, 0.42],

  // Project management
  project: [0.35, 0.55, 0.45, 0.35],
  soft: [0.3, 0.52, 0.48, 0.4],
  skills: [0.32, 0.58, 0.42, 0.32],

  // ===========================================================================
  // Security Domain
  // ===========================================================================
  security: [0.3, 0.6, 0.4, 0.7],
  auth: [0.28, 0.58, 0.38, 0.72],
  authentication: [0.32, 0.55, 0.42, 0.75],
  identity: [0.35, 0.52, 0.45, 0.68],
  oauth: [0.3, 0.62, 0.4, 0.7],

  // ===========================================================================
  // CRM Domain
  // ===========================================================================
  crm: [0.45, 0.4, 0.7, 0.55],
  sales: [0.42, 0.38, 0.68, 0.52],
  salesforce: [0.48, 0.42, 0.72, 0.58],
  provider: [0.5, 0.45, 0.65, 0.5],

  // ===========================================================================
  // Support Domain
  // ===========================================================================
  support: [0.2, 0.45, 0.3, 0.55],
  specialist: [0.22, 0.48, 0.32, 0.52],
  technical: [0.25, 0.65, 0.35, 0.4],
  issues: [0.18, 0.42, 0.28, 0.48],

  // ===========================================================================
  // Product Categories - Electronics vs Apparel
  // ===========================================================================
  electronic: [0.32, 0.76, 0.24, 0.14],
  audio: [0.3, 0.74, 0.22, 0.12],
  devices: [0.28, 0.78, 0.2, 0.1],
  apparel: [0.08, 0.12, 0.15, 0.92],
  fashion: [0.1, 0.14, 0.12, 0.9],
  clothing: [0.06, 0.1, 0.14, 0.94],
  furniture: [0.1, 0.15, 0.2, 0.85],
  home: [0.12, 0.18, 0.22, 0.8],
  living: [0.1, 0.15, 0.2, 0.82],
  goods: [0.3, 0.5, 0.35, 0.4],
  leaders: [0.4, 0.5, 0.6, 0.4],
  senior: [0.35, 0.55, 0.55, 0.35],

  // ===========================================================================
  // Mobile Device Categories
  // ===========================================================================
  // iOS/iPhone/smartphone cluster
  ios: [0.9, 0.7, 0.15, 0.05],
  iphone: [0.88, 0.72, 0.16, 0.06],
  smartphone: [0.85, 0.68, 0.18, 0.08],
  mobile: [0.82, 0.65, 0.2, 0.1],
  apple: [0.5, 0.6, 0.3, 0.2],

  // MacBook/laptop cluster - distinctly different direction from smartphone
  macbook: [0.15, 0.55, 0.85, 0.25],
  laptop: [0.12, 0.52, 0.88, 0.28],
  computer: [0.15, 0.7, 0.5, 0.2],
  macos: [0.18, 0.58, 0.82, 0.22],

  // Samsung/Android cluster
  samsung: [0.78, 0.62, 0.22, 0.14],
  galaxy: [0.76, 0.6, 0.24, 0.16],
  android: [0.8, 0.64, 0.2, 0.12],

  // Audio accessories
  wireless: [0.28, 0.72, 0.24, 0.14],
  bluetooth: [0.26, 0.74, 0.22, 0.12],
  headphones: [0.3, 0.76, 0.2, 0.1],

  // ===========================================================================
  // Demographics - Age Groups
  // ===========================================================================
  young: [0.65, 0.35, 0.45, 0.15],
  professionals: [0.68, 0.38, 0.42, 0.12],
  working: [0.62, 0.32, 0.48, 0.18],
  adults: [0.58, 0.3, 0.5, 0.22],
  early: [0.64, 0.34, 0.46, 0.16],
  careers: [0.7, 0.4, 0.4, 0.1],
  career: [0.7, 0.4, 0.4, 0.1],
  urban: [0.6, 0.36, 0.44, 0.2],
  college: [0.66, 0.38, 0.42, 0.14],
  educated: [0.68, 0.4, 0.4, 0.12],
  ages: [0.5, 0.3, 0.4, 0.3],
  citizens: [0.15, 0.55, 0.35, 0.75],
  retired: [0.12, 0.5, 0.38, 0.8],

  // ===========================================================================
  // Content Types - Tutorial, Video, Documentation, Course
  // ===========================================================================
  // Tutorial cluster - strong in dim 0 (learning/educational)
  tutorial: [0.95, 0.1, 0.08, 0.02],
  step: [0.92, 0.08, 0.05, 0.02],
  steps: [0.92, 0.08, 0.05, 0.02],
  guide: [0.88, 0.1, 0.08, 0.04],
  walkthrough: [0.9, 0.08, 0.06, 0.02],
  getting: [0.92, 0.08, 0.05, 0.02],
  started: [0.9, 0.06, 0.04, 0.02],
  components: [0.88, 0.15, 0.06, 0.03],

  // Video cluster - strong in dim 1 (media/visual)
  video: [0.05, 0.95, 0.08, 0.04],
  watch: [0.04, 0.9, 0.06, 0.03],
  film: [0.03, 0.88, 0.05, 0.02],
  movie: [0.02, 0.85, 0.04, 0.02],
  introduction: [0.08, 0.9, 0.08, 0.05],
  intro: [0.06, 0.88, 0.06, 0.04],
  duration: [0.02, 0.82, 0.04, 0.02],
  hours: [0.02, 0.8, 0.03, 0.02],
  fundamentals: [0.08, 0.92, 0.06, 0.04],
  concepts: [0.1, 0.85, 0.08, 0.05],
  mp4: [0.01, 0.98, 0.02, 0.01],
  homepage: [0.04, 0.88, 0.06, 0.03],

  // Documentation cluster - strong in dim 2 (reference/formal)
  documentation: [0.06, 0.1, 0.95, 0.04],
  api: [0.05, 0.08, 0.92, 0.03],
  reference: [0.04, 0.08, 0.92, 0.03],
  pages: [0.03, 0.06, 0.9, 0.02],
  manual: [0.02, 0.05, 0.88, 0.02],

  // Course cluster - strong in dim 3 (comprehensive/structured)
  course: [0.15, 0.2, 0.1, 0.92],
  bootcamp: [0.12, 0.18, 0.08, 0.9],
  modules: [0.1, 0.15, 0.06, 0.88],
  curriculum: [0.08, 0.12, 0.05, 0.85],
  comprehensive: [0.06, 0.1, 0.04, 0.82],
  full: [0.1, 0.15, 0.08, 0.85],
  stack: [0.12, 0.18, 0.1, 0.82],

  // Image cluster - strong in dim 1+2 (visual media)
  image: [0.05, 0.45, 0.85, 0.08],
  photo: [0.04, 0.42, 0.88, 0.06],
  picture: [0.03, 0.4, 0.9, 0.05],
  src: [0.06, 0.48, 0.82, 0.08],
  alt: [0.05, 0.45, 0.8, 0.06],

  // Document cluster
  document: [0.08, 0.1, 0.78, 0.15],
  file: [0.06, 0.12, 0.75, 0.12],
  path: [0.05, 0.15, 0.72, 0.1],
  format: [0.04, 0.18, 0.7, 0.08],

  // ===========================================================================
  // Abstract/Concept Domain
  // ===========================================================================
  related: [0.5, 0.5, 0.5, 0.5],
  concept: [0.55, 0.45, 0.55, 0.45],
  similar: [0.52, 0.48, 0.52, 0.48],
  different: [0.48, 0.52, 0.48, 0.52],
  words: [0.45, 0.55, 0.45, 0.55],
  semantically: [0.6, 0.4, 0.6, 0.4],

  // Exact match domain
  exact: [0.1, 0.1, 0.1, 0.9],
  match: [0.15, 0.15, 0.1, 0.85],
  title: [0.1, 0.2, 0.1, 0.8],
  contains: [0.12, 0.18, 0.12, 0.78],
  search: [0.08, 0.22, 0.08, 0.82],
  terms: [0.05, 0.25, 0.05, 0.85],
}

/**
 * Default vector for words not found in SEMANTIC_VECTORS.
 * Low values in all dimensions indicate a "neutral" or unknown word.
 */
export const DEFAULT_VECTOR: number[] = [0.1, 0.1, 0.1, 0.1]

/**
 * Number of base dimensions in semantic vectors.
 * Used for aggregation before expansion to full embedding dimensions.
 */
export const BASE_VECTOR_DIMENSIONS = 4
