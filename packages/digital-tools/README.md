# Digital Tools

Entity types (Nouns) and providers for digital tools usable by both humans and AI agents.

## Categories

All categories use **single-word identifiers** for use as JS/TS variables, components, and functions.

| Category | Description | Providers |
|----------|-------------|-----------|
| `message` | Email, text, chat, voice, video | SendGrid, Resend, Slack, Twilio, Vapi |
| `productivity` | Calendar, tasks, notes | - |
| `project` | Projects, issues, sprints | Linear |
| `code` | Repositories, PRs, commits | GitHub |
| `sales` | Leads, deals, accounts | HubSpot |
| `finance` | Payments, billing, treasury | Stripe |
| `support` | Tickets, conversations, help | Zendesk |
| `media` | Images, videos, audio | Cloudinary |
| `marketing` | Campaigns, audiences | Mailchimp |
| `knowledge` | Wiki, articles, glossary | Notion |
| `commerce` | Products, orders, carts | Shopify |
| `analytics` | Reports, dashboards, metrics | Mixpanel |
| `storage` | Files, folders, drives | AWS S3 |
| `meeting` | Video conferencing, webinars | Zoom, Google Meet, Teams, Jitsi |
| `form` | Forms, surveys, quizzes | Typeform |
| `calendar` | Events, scheduling | Google Calendar, Cal.com |
| `signature` | E-signatures, documents | DocuSign, DocuSeal |
| `document` | Word processing | Google Docs, Office365 |
| `spreadsheet` | Data tables, formulas | Google Sheets, Excel |
| `presentation` | Slides, decks | Google Slides, PowerPoint |

---

## Entity Abstractions

### Message

Unified communication entities using single-word nouns. The `type` property distinguishes variants.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Message** | Async communication (email, text, chat, direct, voicemail) | send, reply, forward, edit, delete, archive, star, read, label, pin, react, transcribe | sent, delivered, read, failed, bounced, opened, clicked, replied, forwarded, edited, deleted, archived, starred, labeled, pinned, reacted, transcribed |
| **Thread** | Conversation container | archive, delete, read, mute, star, pin, label, move | created, updated, archived, deleted, read, muted, starred, pinned, labeled, moved |
| **Call** | Real-time voice/video (phone, web, video) | initiate, answer, reject, hold, mute, transfer, merge, record, transcribe, end | initiated, ringing, answered, rejected, held, muted, transferred, merged, recorded, transcribed, ended, failed |
| **Channel** | Topic-based space | create, rename, topic, archive, delete, join, leave, invite, kick, mute, pin | created, renamed, topicSet, archived, deleted, joined, left, invited, kicked, muted, pinned |
| **Workspace** | Team organization | create, rename, invite, remove, archive, delete, transfer | created, renamed, invited, removed, archived, deleted, transferred |
| **Member** | User membership | invite, remove, promote, demote, activate, deactivate, status | invited, joined, removed, promoted, demoted, activated, deactivated, statusChanged |
| **Contact** | Person entity | create, update, delete, merge, tag, block | created, updated, deleted, merged, tagged, blocked |
| **Attachment** | File attachment | upload, download, preview, delete | uploaded, downloaded, previewed, deleted |
| **Reaction** | Emoji reaction | add, remove | added, removed |

### Productivity

Calendar, tasks, and note-taking entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Calendar** | Calendar container | create, share, subscribe, export | created, shared, subscribed, exported |
| **Event** | Calendar event | create, update, delete, invite, remind | created, updated, deleted, invited, reminded, started, ended |
| **Task** | Todo item | create, update, complete, assign, prioritize | created, updated, completed, assigned, prioritized |
| **Checklist** | List of tasks | create, addItem, removeItem, complete | created, itemAdded, itemRemoved, completed |
| **Note** | Text note | create, edit, delete, share, tag | created, edited, deleted, shared, tagged |
| **Notebook** | Note container | create, rename, share, archive | created, renamed, shared, archived |
| **Reminder** | Time-based alert | create, snooze, dismiss, reschedule | created, triggered, snoozed, dismissed |
| **Bookmark** | Saved link | create, delete, tag, organize | created, deleted, tagged, organized |

### Project

Project management entities for issues, sprints, and boards.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Project** | Project container | create, archive, rename, addMember | created, archived, renamed, memberAdded |
| **Issue** | Work item/ticket | create, update, assign, close, reopen, comment | created, updated, assigned, closed, reopened, commented |
| **Sprint** | Time-boxed iteration | create, start, complete, extend | created, started, completed, extended |
| **Milestone** | Project checkpoint | create, update, complete, reopen | created, updated, completed, reopened |
| **Board** | Kanban/scrum board | create, addColumn, removeColumn, reorder | created, columnAdded, columnRemoved, reordered |
| **Epic** | Large work item | create, update, close, link | created, updated, closed, linked |
| **Label** | Categorization tag | create, update, delete, apply | created, updated, deleted, applied |

### Code

Software development entities for repositories and version control.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Repository** | Code repository | create, clone, fork, archive, delete | created, cloned, forked, archived, deleted |
| **Branch** | Code branch | create, checkout, merge, delete, protect | created, checkedOut, merged, deleted, protected |
| **Commit** | Code commit | create, revert, cherry-pick | created, reverted, cherryPicked |
| **PullRequest** | Code review request | create, update, review, approve, merge, close | created, updated, reviewed, approved, merged, closed |
| **CodeReview** | PR review | submit, approve, requestChanges, comment | submitted, approved, changesRequested, commented |
| **Release** | Software release | create, publish, draft, delete | created, published, drafted, deleted |
| **Workflow** | CI/CD pipeline | create, trigger, cancel, disable | created, triggered, cancelled, disabled |
| **WorkflowRun** | Pipeline execution | trigger, cancel, retry, download | triggered, cancelled, retried, completed, failed |

### Sales

CRM entities for leads, deals, and customer relationships.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Lead** | Potential customer | create, qualify, convert, disqualify | created, qualified, converted, disqualified |
| **Deal** | Sales opportunity | create, update, win, lose, advance | created, updated, won, lost, stageChanged |
| **Account** | Company/organization | create, update, merge, archive | created, updated, merged, archived |
| **Pipeline** | Sales pipeline | create, addStage, removeStage, reorder | created, stageAdded, stageRemoved, reordered |
| **Activity** | Sales activity | log, schedule, complete, cancel | logged, scheduled, completed, cancelled |
| **Quote** | Price quote | create, send, accept, reject, expire | created, sent, accepted, rejected, expired |

### Finance (Stripe-based)

Comprehensive financial entities based on Stripe's API.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Customer** | Person/business | create, update, delete, search | created, updated, deleted |
| **Product** | Sellable item | create, update, archive, unarchive | created, updated, archived |
| **Price** | Product price | create, update, archive | created, updated, archived |
| **PaymentMethod** | Payment instrument | attach, detach, update, setDefault | attached, detached, updated |
| **PaymentIntent** | Payment attempt | create, confirm, cancel, capture | created, succeeded, failed, cancelled |
| **Charge** | Completed payment | create, capture, refund | created, captured, refunded |
| **Refund** | Payment reversal | create, update, cancel | created, updated, cancelled |
| **Invoice** | Bill for payment | create, send, pay, void, finalize | created, sent, paid, voided, finalized |
| **Subscription** | Recurring billing | create, update, cancel, resume, pause | created, updated, cancelled, resumed, paused |
| **Balance** | Account balance | retrieve | updated |
| **Transfer** | Fund transfer | create, reverse | created, reversed |
| **Payout** | External payout | create, cancel, reverse | created, paid, failed, cancelled |

**Connect (Platforms):**

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Account** | Connected account | create, update, delete, reject | created, updated, deleted |
| **AccountLink** | Onboarding link | create | created |
| **ApplicationFee** | Platform fee | list, retrieve, refund | created, refunded |

**Treasury (Embedded Banking):**

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **FinancialAccount** | Bank-like account | create, update, close | created, updated, closed |
| **InboundTransfer** | Incoming funds | create, cancel | created, succeeded, failed |
| **OutboundTransfer** | Outgoing funds | create, cancel | created, posted, failed |
| **OutboundPayment** | External payment | create, cancel | created, posted, failed |

**Issuing (Cards):**

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **IssuingCard** | Physical/virtual card | create, update, ship, cancel | created, shipped, activated |
| **IssuingCardholder** | Card owner | create, update | created, updated |
| **IssuingAuthorization** | Spend authorization | approve, decline | created, approved, declined |
| **IssuingTransaction** | Card transaction | list, retrieve | created |

### Support

Customer support and help desk entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **SupportTicket** | Support request | create, assign, resolve, close, reopen | created, assigned, resolved, closed, reopened |
| **TicketComment** | Ticket response | add, edit, delete | added, edited, deleted |
| **Conversation** | Chat thread | start, reply, close, transfer | started, replied, closed, transferred |
| **HelpArticle** | Knowledge base article | create, publish, unpublish, archive | created, published, unpublished, archived |
| **FAQ** | Question/answer | create, update, delete | created, updated, deleted |

### Media

Image, video, and audio content entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Image** | Image file | upload, transform, tag, delete | uploaded, transformed, tagged, deleted |
| **Video** | Video file | upload, transcode, trim, delete | uploaded, transcoded, trimmed, deleted |
| **Audio** | Audio file | upload, transcribe, trim, delete | uploaded, transcribed, trimmed, deleted |
| **Album** | Media collection | create, addMedia, removeMedia, share | created, mediaAdded, mediaRemoved, shared |
| **Transcript** | Audio/video transcript | generate, edit, export | generated, edited, exported |

### Knowledge

Wiki and knowledge management entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **WikiPage** | Wiki page | create, edit, publish, archive, move | created, edited, published, archived, moved |
| **WikiSpace** | Wiki container | create, rename, archive | created, renamed, archived |
| **Article** | KB article | create, publish, unpublish, archive | created, published, unpublished, archived |
| **KnowledgeBase** | KB container | create, configure, publish | created, configured, published |
| **Glossary** | Term definitions | create, addTerm, updateTerm | created, termAdded, termUpdated |
| **Tag** | Content tag | create, apply, remove | created, applied, removed |

### Commerce

E-commerce entities for products, orders, and customers.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Product** | Sellable product | create, update, publish, archive | created, updated, published, archived |
| **ProductVariant** | Product variation | create, update, delete | created, updated, deleted |
| **Order** | Customer order | create, fulfill, cancel, refund | created, fulfilled, cancelled, refunded |
| **OrderItem** | Order line item | add, update, remove | added, updated, removed |
| **Cart** | Shopping cart | create, addItem, removeItem, checkout | created, itemAdded, itemRemoved, checkedOut |
| **Customer** | Shop customer | create, update, merge | created, updated, merged |
| **Inventory** | Stock levels | update, reserve, release | updated, reserved, released |
| **Discount** | Price discount | create, apply, expire | created, applied, expired |

### Analytics

Reporting and metrics entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Report** | Data report | create, generate, schedule, export | created, generated, scheduled, exported |
| **Dashboard** | Visual dashboard | create, addWidget, removeWidget, share | created, widgetAdded, widgetRemoved, shared |
| **Widget** | Dashboard component | create, configure, refresh | created, configured, refreshed |
| **Metric** | Tracked metric | define, track, alert | defined, tracked, alerted |
| **Goal** | Target metric | create, track, complete | created, tracked, completed |
| **Alert** | Threshold alert | create, trigger, acknowledge | created, triggered, acknowledged |

### Storage

File and cloud storage entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **File** | Stored file | upload, download, move, copy, delete | uploaded, downloaded, moved, copied, deleted |
| **Folder** | File container | create, rename, move, delete | created, renamed, moved, deleted |
| **Drive** | Storage volume | mount, unmount, sync | mounted, unmounted, synced |
| **SharedLink** | Sharing link | create, revoke, update | created, revoked, updated |
| **FileVersion** | File version | create, restore, delete | created, restored, deleted |

### Meeting

Video conferencing and webinar entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Meeting** | Video meeting | create, start, end, join, leave | created, started, ended, joined, left |
| **MeetingParticipant** | Meeting attendee | invite, admit, remove, mute | invited, admitted, removed, muted |
| **MeetingRecording** | Meeting recording | start, stop, download, delete | started, stopped, downloaded, deleted |
| **Webinar** | Large broadcast | create, start, end, register | created, started, ended, registered |
| **BreakoutRoom** | Sub-meeting room | create, open, close, assign | created, opened, closed, assigned |
| **MeetingPoll** | In-meeting poll | create, launch, end | created, launched, ended |

### Form

Forms, surveys, and quiz entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Form** | Data form | create, publish, close, duplicate | created, published, closed, duplicated |
| **FormField** | Form input | create, update, delete, reorder | created, updated, deleted, reordered |
| **FormResponse** | Form submission | submit, update, delete | submitted, updated, deleted |
| **Survey** | Survey form | create, publish, close, analyze | created, published, closed, analyzed |
| **Quiz** | Quiz form | create, publish, grade, close | created, published, graded, closed |

### Signature

E-signature workflow entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **SignatureDocument** | Document for signing | create, send, void, download | created, sent, voided, completed |
| **SignatureRequest** | Signing request | send, resend, remind, cancel | sent, resent, viewed, signed, declined |
| **Signer** | Person signing | create, invite, verify | created, invitationSent, verified |
| **SignatureField** | Input field | create, move, resize, setValue | created, moved, resized, completed |
| **Signature** | Actual signature | create, validate, verify | created, validated, verified |
| **SignatureTemplate** | Reusable template | create, edit, use, share | created, edited, used, shared |
| **AuditTrail** | Compliance log | view, export, verify | created, exported, verified |

### Document

Word processing entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Document** | Text document | create, edit, save, export, share | created, edited, saved, exported, shared |
| **DocumentVersion** | Version history | create, restore, compare | created, restored, compared |
| **DocumentComment** | Inline comment | create, reply, resolve, delete | created, replied, resolved, deleted |
| **DocumentCollaborator** | Shared access | invite, revoke, updatePermissions | invited, revoked, permissionsUpdated |

### Spreadsheet

Spreadsheet and data table entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Spreadsheet** | Workbook | create, open, save, export, share | created, opened, saved, exported, shared |
| **Sheet** | Worksheet | create, rename, delete, duplicate | created, renamed, deleted, duplicated |
| **Cell** | Individual cell | setValue, setFormula, format, clear | valueChanged, formulaSet, formatted, cleared |
| **Range** | Cell range | select, setValue, format, sort | selected, valuesChanged, formatted, sorted |
| **Chart** | Data chart | create, update, delete, export | created, updated, deleted, exported |
| **PivotTable** | Data pivot | create, refresh, addField, filter | created, refreshed, fieldAdded, filtered |

### Presentation

Slide presentation entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Presentation** | Slide deck | create, open, save, present, export | created, opened, saved, presented, exported |
| **Slide** | Individual slide | create, duplicate, delete, move | created, duplicated, deleted, moved |
| **SlideElement** | Slide content | create, edit, move, resize, delete | created, edited, moved, resized, deleted |
| **SpeakerNotes** | Presenter notes | create, edit, delete | created, edited, deleted |
| **Animation** | Slide animation | create, edit, delete, reorder | created, edited, deleted, reordered |

---

## Usage

```typescript
import { AllEntities, EntityCategories } from 'digital-tools'

// Access all entities by category
const messageEntities = AllEntities.message
const financeEntities = AllEntities.finance

// List all categories
console.log(EntityCategories)
// ['message', 'productivity', 'project', 'code', 'sales', ...]
```

## Providers

```typescript
import {
  registerAllProviders,
  createProvider,
  getProvider
} from 'digital-tools'

// Register all built-in providers
registerAllProviders()

// Create a provider instance
const stripe = await createProvider('finance.stripe', {
  apiKey: process.env.STRIPE_API_KEY
})

// Use the provider
const customer = await stripe.createCustomer({
  email: 'user@example.com'
})
```

## License

MIT
