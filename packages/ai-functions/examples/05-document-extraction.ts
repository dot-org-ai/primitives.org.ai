/**
 * Data Extraction from Documents Example
 *
 * This example demonstrates extracting structured data from various document types
 * using ai-functions. It shows how to:
 * - Extract entities from unstructured text
 * - Parse specific document formats (invoices, resumes, contracts)
 * - Handle tables and structured sections
 * - Validate extracted data
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/05-document-extraction.ts
 * ```
 */

import { ai, extract, list, is, configure, schema } from '../src/index.js'

// ============================================================================
// Sample Documents
// ============================================================================

const sampleInvoice = `
INVOICE #INV-2024-0042

Bill To:                           Ship To:
Acme Corporation                   Acme Corporation
123 Business Lane                  456 Warehouse Rd
San Francisco, CA 94102            Oakland, CA 94612

Invoice Date: January 15, 2024
Due Date: February 14, 2024
Payment Terms: Net 30

| Item                    | Qty | Unit Price | Total      |
|------------------------|-----|------------|------------|
| Widget Pro (WP-100)    | 50  | $29.99     | $1,499.50  |
| Widget Basic (WB-50)   | 100 | $14.99     | $1,499.00  |
| Premium Support (1yr)  | 1   | $999.00    | $999.00    |
| Shipping & Handling    | -   | -          | $45.00     |

                                    Subtotal: $4,042.50
                                    Tax (8.5%): $343.61
                                    TOTAL DUE: $4,386.11

Payment Methods: Check, Wire Transfer, ACH
Bank: First National Bank
Account: 1234567890
Routing: 021000021
`

const sampleResume = `
SARAH CHEN
Software Engineer | AI/ML Specialist
san.chen@email.com | (555) 123-4567 | linkedin.com/in/sarahchen | github.com/schen

SUMMARY
Experienced software engineer with 6+ years building ML systems at scale.
Passionate about NLP and computer vision applications.

EXPERIENCE

Senior Machine Learning Engineer | TechCorp Inc. | Jan 2021 - Present
- Led team of 5 engineers building recommendation system serving 10M users
- Reduced model inference latency by 40% through optimization
- Implemented A/B testing framework for ML experiments
- Technologies: Python, TensorFlow, Kubernetes, AWS SageMaker

Software Engineer | StartupAI | June 2018 - Dec 2020
- Built NLP pipeline processing 1M documents daily
- Developed real-time fraud detection system (99.2% accuracy)
- Created data labeling tools that reduced annotation time by 60%

EDUCATION

M.S. Computer Science | Stanford University | 2018
- Focus: Machine Learning, Natural Language Processing
- GPA: 3.9/4.0

B.S. Computer Science | UC Berkeley | 2016
- Summa Cum Laude
- Dean's List all semesters

SKILLS

Languages: Python, TypeScript, Go, SQL
ML/AI: TensorFlow, PyTorch, scikit-learn, Hugging Face
Cloud: AWS, GCP, Kubernetes, Docker
Other: Git, CI/CD, Agile/Scrum

CERTIFICATIONS
- AWS Certified Machine Learning Specialty (2023)
- Google Professional ML Engineer (2022)
`

const sampleContract = `
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of March 1, 2024
("Effective Date") by and between:

Provider: CloudServices LLC
Address: 789 Tech Blvd, Austin, TX 78701
Contact: contracts@cloudservices.com

Client: RetailCo Inc.
Address: 321 Commerce St, Dallas, TX 75201
Contact: legal@retailco.com

1. SERVICES
Provider agrees to provide cloud hosting services including:
- Dedicated server instances (4x 32-core, 128GB RAM)
- 99.9% uptime SLA
- 24/7 technical support
- Daily automated backups

2. TERM
Initial term: 24 months
Auto-renewal: Yes, 12-month periods unless cancelled with 60 days notice

3. FEES
Monthly fee: $8,500
Annual total: $102,000
Payment due: Net 15 from invoice date

4. TERMINATION
Either party may terminate with 60 days written notice.
Early termination fee: 3 months of fees.

5. CONFIDENTIALITY
Both parties agree to maintain confidentiality of proprietary information.
Duration: 3 years after termination.

Signed:
_____________________          _____________________
CloudServices LLC              RetailCo Inc.
Date: March 1, 2024           Date: March 1, 2024
`

// ============================================================================
// Extraction Schemas
// ============================================================================

interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  billTo: {
    company: string
    address: string
  }
  shipTo: {
    company: string
    address: string
  }
  lineItems: {
    description: string
    quantity: number
    unitPrice: number
    total: number
  }[]
  subtotal: number
  tax: number
  total: number
  paymentTerms: string
}

interface ResumeData {
  name: string
  title: string
  contact: {
    email: string
    phone: string
    linkedin?: string
    github?: string
  }
  summary: string
  experience: {
    title: string
    company: string
    period: string
    highlights: string[]
  }[]
  education: {
    degree: string
    school: string
    year: string
    details?: string
  }[]
  skills: {
    category: string
    items: string[]
  }[]
  certifications: string[]
}

interface ContractData {
  type: string
  effectiveDate: string
  parties: {
    role: string
    name: string
    address: string
    contact: string
  }[]
  term: {
    duration: string
    autoRenewal: boolean
    cancellationNotice: string
  }
  financials: {
    monthlyFee: number
    annualTotal: number
    paymentTerms: string
  }
  keyTerms: string[]
}

// ============================================================================
// Extractors
// ============================================================================

async function extractInvoice(document: string): Promise<InvoiceData> {
  console.log('\n--- Extracting Invoice Data ---')

  const data = await ai`Extract all data from this invoice:

${document}

Provide a complete extraction with:
- invoiceNumber: the invoice number/ID
- invoiceDate: invoice date
- dueDate: payment due date
- billTo: { company, address }
- shipTo: { company, address }
- lineItems: array of { description, quantity (number), unitPrice (number), total (number) }
- subtotal: number
- tax: number
- total: number
- paymentTerms: payment terms`

  return data as unknown as InvoiceData
}

async function extractResume(document: string): Promise<ResumeData> {
  console.log('\n--- Extracting Resume Data ---')

  const data = await ai`Extract all data from this resume:

${document}

Provide a complete extraction with:
- name: candidate name
- title: current/desired title
- contact: { email, phone, linkedin, github }
- summary: professional summary
- experience: array of { title, company, period, highlights: array of achievements }
- education: array of { degree, school, year, details }
- skills: array of { category, items: array of skills }
- certifications: array of certification names`

  return data as unknown as ResumeData
}

async function extractContract(document: string): Promise<ContractData> {
  console.log('\n--- Extracting Contract Data ---')

  const data = await ai`Extract all data from this contract:

${document}

Provide a complete extraction with:
- type: type of agreement
- effectiveDate: when the contract starts
- parties: array of { role (provider/client), name, address, contact }
- term: { duration, autoRenewal: boolean, cancellationNotice }
- financials: { monthlyFee: number, annualTotal: number, paymentTerms }
- keyTerms: array of important contract terms/obligations`

  return data as unknown as ContractData
}

// ============================================================================
// Entity Extraction
// ============================================================================

async function extractEntities(text: string): Promise<void> {
  console.log('\n--- Entity Extraction ---')

  // Extract different entity types
  const emails = await extract`all email addresses from: ${text}`
  console.log('Emails:', emails)

  const phones = await extract`all phone numbers from: ${text}`
  console.log('Phones:', phones)

  const dates = await extract`all dates and time periods from: ${text}`
  console.log('Dates:', dates)

  const amounts = await extract`all monetary amounts and numbers from: ${text}`
  console.log('Amounts:', amounts)

  const companies = await extract`all company/organization names from: ${text}`
  console.log('Companies:', companies)
}

// ============================================================================
// Validation
// ============================================================================

async function validateExtraction(
  original: string,
  extracted: unknown,
  docType: string
): Promise<{ valid: boolean; issues: string[] }> {
  console.log(`\n--- Validating ${docType} Extraction ---`)

  const { valid, issues } = await ai`Validate this extraction against the original document:

Original Document:
${original.substring(0, 1000)}...

Extracted Data:
${JSON.stringify(extracted, null, 2)}

Check for:
- Missing important information
- Incorrect values or parsing errors
- Data type issues (strings vs numbers)

Provide:
- valid: boolean (true if extraction is accurate and complete)
- issues: array of any problems found (empty if valid)`

  const validationResult = {
    valid: valid as boolean,
    issues: issues as string[],
  }

  console.log(`Valid: ${validationResult.valid}`)
  if (validationResult.issues.length > 0) {
    console.log('Issues:', validationResult.issues)
  }

  return validationResult
}

// ============================================================================
// Format Display
// ============================================================================

function displayInvoice(data: InvoiceData): void {
  console.log(`
Invoice: ${data.invoiceNumber}
Date: ${data.invoiceDate} | Due: ${data.dueDate}

Bill To: ${data.billTo?.company}
         ${data.billTo?.address}

Items:`)
  for (const item of data.lineItems || []) {
    console.log(`  - ${item.description}: ${item.quantity} x $${item.unitPrice} = $${item.total}`)
  }
  console.log(`
Subtotal: $${data.subtotal}
Tax: $${data.tax}
TOTAL: $${data.total}`)
}

function displayResume(data: ResumeData): void {
  console.log(`
Candidate: ${data.name}
Title: ${data.title}
Contact: ${data.contact?.email} | ${data.contact?.phone}

Summary: ${data.summary?.substring(0, 100)}...

Experience:`)
  for (const exp of data.experience || []) {
    console.log(`  ${exp.title} @ ${exp.company} (${exp.period})`)
  }
  console.log(`
Education:`)
  for (const edu of data.education || []) {
    console.log(`  ${edu.degree} - ${edu.school} (${edu.year})`)
  }
  console.log(`
Skills: ${(data.skills || [])
    .flatMap((s) => s.items)
    .slice(0, 10)
    .join(', ')}...
Certifications: ${(data.certifications || []).length}`)
}

function displayContract(data: ContractData): void {
  console.log(`
Contract Type: ${data.type}
Effective: ${data.effectiveDate}

Parties:`)
  for (const party of data.parties || []) {
    console.log(`  ${party.role}: ${party.name}`)
  }
  console.log(`
Term: ${data.term?.duration}
Auto-Renewal: ${data.term?.autoRenewal}

Financials:
  Monthly: $${data.financials?.monthlyFee}
  Annual: $${data.financials?.annualTotal}

Key Terms: ${(data.keyTerms || []).length} extracted`)
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Document Data Extraction Example ===\n')

  // Configure the AI provider
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Extract and display invoice
  const invoiceData = await extractInvoice(sampleInvoice)
  displayInvoice(invoiceData)
  await validateExtraction(sampleInvoice, invoiceData, 'Invoice')

  // Extract and display resume
  const resumeData = await extractResume(sampleResume)
  displayResume(resumeData)
  await validateExtraction(sampleResume, resumeData, 'Resume')

  // Extract and display contract
  const contractData = await extractContract(sampleContract)
  displayContract(contractData)
  await validateExtraction(sampleContract, contractData, 'Contract')

  // General entity extraction demo
  await extractEntities(sampleResume)
}

main()
  .then(() => {
    console.log('\n=== Example Complete ===\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nError:', error.message)
    process.exit(1)
  })
