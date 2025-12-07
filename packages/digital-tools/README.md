# Digital Tools

Entity types (Nouns) and providers for digital tools usable by both humans and AI agents.

## Categories

All categories use **single-word identifiers** for use as JS/TS variables, components, and functions.

| Category | Description | Providers |
|----------|-------------|-----------|
| `site` | Deployed web presence with type enumeration | Vercel, Netlify, Cloudflare |
| `message` | Email, text, chat, voice, video | SendGrid, Resend, Slack, Twilio, Vapi |
| `productivity` | Calendar, tasks, notes, availability | Google Calendar, Cal.com |
| `project` | Projects, issues, sprints | Linear, Jira |
| `code` | Repositories, PRs, commits | GitHub, GitLab |
| `sales` | Leads, deals, accounts | HubSpot, Salesforce |
| `finance` | Payments, billing, treasury | Stripe |
| `support` | Tickets, conversations, help | Zendesk, Intercom |
| `media` | Images, videos, audio | Cloudinary |
| `marketing` | Campaigns, audiences | Mailchimp, ConvertKit |
| `knowledge` | Wiki, articles, glossary | Notion, Confluence |
| `commerce` | Products, orders, carts | Shopify, Stripe |
| `analytics` | Reports, dashboards, metrics | Mixpanel, Amplitude |
| `storage` | Files, folders, drives | AWS S3, Google Cloud Storage |
| `meeting` | Video conferencing, scheduling, resources | Zoom, Google Meet, Teams, Cal.com |
| `form` | Forms, surveys, quizzes | Typeform, Tally |
| `signature` | E-signatures, documents | DocuSign, DocuSeal |
| `document` | Word processing | Google Docs, Office365 |
| `spreadsheet` | Data tables, formulas | Google Sheets, Excel |
| `presentation` | Slides, decks | Google Slides, PowerPoint |
| `infrastructure` | Config, database, hosting, functions | Firebase, GCP, AWS |
| `experiment` | Analytics, A/B testing, feature flags | LaunchDarkly, Amplitude |
| `advertising` | Google Ads, Meta Ads, campaigns | Google Ads, Meta Ads |
| `video` | YouTube, Twitch, video platforms | YouTube, Twitch |
| `identity` | SSO, directory, secrets, audit | WorkOS, Auth0 |
| `notification` | Push, SMS, email, in-app | OneSignal, Twilio |
| `hr` | Employees, teams, time off | Gusto, Rippling |
| `recruiting` | Jobs, candidates, interviews | Lever, Greenhouse |
| `design` | Figma, Sketch, design systems | Figma, Sketch |
| `shipping` | Shipments, packages, carriers | EasyPost, ShipEngine |
| `automation` | Workflows, triggers, actions | Zapier, n8n, Make |
| `ai` | Models, prompts, agents | OpenAI, Anthropic |

---

## Entity Abstractions

### Site

Deployed web presence with type enumeration.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Site** | Web presence (website, app, api, admin, docs, blog, store, portal, landing, dashboard) | create, deploy, configure, publish, unpublish, archive | created, deployed, configured, published, unpublished, archived |

### Message

Unified communication entities using single-word nouns. The `type` property distinguishes variants.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Message** | Async communication (email, text, chat, direct, voicemail) | send, reply, forward, edit, delete, archive, star, read, label, pin, react, transcribe | sent, delivered, read, failed, bounced, opened, clicked, replied, forwarded, edited, deleted, archived, starred, labeled, pinned, reacted, transcribed |
| **Thread** | Conversation container | archive, delete, read, mute, star, pin, label, move | created, updated, archived, deleted, read, muted, starred, pinned, labeled, moved |
| **Call** | Real-time voice/video (phone, web, video) | initiate, answer, reject, hold, mute, transfer, merge, record, transcribe, end | initiated, ringing, answered, rejected, held, muted, transferred, merged, recorded, transcribed, ended, failed |
| **Channel** | Topic-based space | create, rename, setTopic, archive, delete, join, leave, invite, kick, mute, pin | created, renamed, topicSet, archived, deleted, joined, left, invited, kicked, muted, pinned |
| **Workspace** | Team organization | create, rename, invite, remove, archive, delete, transfer | created, renamed, invited, removed, archived, deleted, transferred |
| **Member** | User membership | invite, remove, promote, demote, activate, deactivate, setStatus | invited, joined, removed, promoted, demoted, activated, deactivated, statusChanged |
| **Contact** | Person entity | create, update, delete, merge, tag, block | created, updated, deleted, merged, tagged, blocked |
| **Attachment** | File attachment | upload, download, preview, delete | uploaded, downloaded, previewed, deleted |
| **Reaction** | Emoji reaction | add, remove | added, removed |

### Productivity

Calendar, tasks, note-taking, and availability entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Calendar** | Calendar container | create, share, subscribe, export | created, shared, subscribed, exported |
| **Event** | Calendar event | create, update, delete, invite, remind | created, updated, deleted, invited, reminded, started, ended |
| **Availability** | Schedulable time windows | create, update, delete, activate, deactivate, setDefault, addOverride, removeOverride, blockDate, unblockDate | created, updated, deleted, activated, deactivated, overrideAdded, overrideRemoved, dateBlocked, dateUnblocked |
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
| **Column** | Board column | create, update, delete, reorder | created, updated, deleted, reordered |
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
| **CodeIssue** | Repository issue | create, update, close, reopen, assign, label | created, updated, closed, reopened, assigned, labeled |
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
| **Stage** | Pipeline stage | create, update, delete, reorder | created, updated, deleted, reordered |
| **Activity** | Sales activity | log, schedule, complete, cancel | logged, scheduled, completed, cancelled |
| **Quote** | Price quote | create, send, accept, reject, expire | created, sent, accepted, rejected, expired |
| **QuoteLineItem** | Quote line | add, update, remove | added, updated, removed |
| **Product** | CRM product | create, update, archive | created, updated, archived |

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
| **InvoiceLineItem** | Invoice line | add, update, remove | added, updated, removed |
| **Subscription** | Recurring billing | create, update, cancel, resume, pause | created, updated, cancelled, resumed, paused |
| **SubscriptionItem** | Subscription line | add, update, remove | added, updated, removed |
| **Balance** | Account balance | retrieve | updated |
| **BalanceTransaction** | Balance change | list, retrieve | created |
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
| **TreasuryTransaction** | Account transaction | list, retrieve | created |
| **InboundTransfer** | Incoming funds | create, cancel | created, succeeded, failed |
| **OutboundTransfer** | Outgoing funds | create, cancel | created, posted, failed |
| **OutboundPayment** | External payment | create, cancel | created, posted, failed |
| **ReceivedCredit** | Received credit | list, retrieve | created |
| **ReceivedDebit** | Received debit | list, retrieve | created |

**Issuing (Cards):**

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **IssuingCard** | Physical/virtual card | create, update, ship, cancel | created, shipped, activated |
| **IssuingCardholder** | Card owner | create, update | created, updated |
| **IssuingAuthorization** | Spend authorization | approve, decline | created, approved, declined |
| **IssuingTransaction** | Card transaction | list, retrieve | created |
| **IssuingDispute** | Transaction dispute | create, submit | created, submitted, won, lost |

**Bank:**

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **BankAccount** | External bank account | create, verify, delete | created, verified, deleted |

**Webhooks:**

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **WebhookEndpoint** | Webhook configuration | create, update, delete, enable, disable | created, updated, deleted, enabled, disabled |
| **Event** | Webhook event | list, retrieve | created |

### Support

Customer support and help desk entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **SupportTicket** | Support request | create, assign, resolve, close, reopen, escalate, merge | created, assigned, resolved, closed, reopened, escalated, merged |
| **TicketComment** | Ticket response | add, edit, delete | added, edited, deleted |
| **Conversation** | Chat thread | start, reply, close, transfer, snooze | started, replied, closed, transferred, snoozed |
| **ConversationMessage** | Chat message | send, edit, delete | sent, edited, deleted |
| **HelpArticle** | Knowledge base article | create, publish, unpublish, archive | created, published, unpublished, archived |
| **HelpCategory** | Article category | create, update, delete | created, updated, deleted |
| **FAQ** | Question/answer | create, update, delete | created, updated, deleted |
| **SatisfactionRating** | Customer rating | submit, update | submitted, updated |

### Media

Image, video, and audio content entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Image** | Image file | upload, transform, tag, delete | uploaded, transformed, tagged, deleted |
| **Video** | Video file | upload, transcode, trim, delete | uploaded, transcoded, trimmed, deleted |
| **Audio** | Audio file | upload, transcribe, trim, delete | uploaded, transcribed, trimmed, deleted |
| **Screenshot** | Screen capture | capture, annotate, share, delete | captured, annotated, shared, deleted |
| **Album** | Media collection | create, addMedia, removeMedia, share | created, mediaAdded, mediaRemoved, shared |
| **MediaLibrary** | Media container | create, organize, search | created, organized, searched |
| **Transcript** | Audio/video transcript | generate, edit, export | generated, edited, exported |
| **Caption** | Video caption | generate, edit, sync | generated, edited, synced |

### Marketing

Campaign and audience management entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Campaign** | Marketing campaign | create, launch, pause, resume, end | created, launched, paused, resumed, ended |
| **Audience** | Target audience | create, update, segment | created, updated, segmented |
| **EmailTemplate** | Email template | create, edit, test, publish | created, edited, tested, published |
| **LandingPage** | Landing page | create, publish, unpublish, test | created, published, unpublished, tested |
| **FormSubmission** | Marketing form submission | submit, export | submitted, exported |
| **SocialPost** | Social media post | create, schedule, publish, delete | created, scheduled, published, deleted |
| **AdCreative** | Ad creative | create, update, approve | created, updated, approved |
| **UTMLink** | Tracked link | create, shorten, track | created, shortened, clicked |

### Knowledge

Wiki and knowledge management entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **WikiPage** | Wiki page | create, edit, publish, archive, move | created, edited, published, archived, moved |
| **WikiSpace** | Wiki container | create, rename, archive | created, renamed, archived |
| **WikiRevision** | Page revision | create, restore, compare | created, restored, compared |
| **Article** | KB article | create, publish, unpublish, archive | created, published, unpublished, archived |
| **KnowledgeBase** | KB container | create, configure, publish | created, configured, published |
| **Glossary** | Term collection | create, update, delete | created, updated, deleted |
| **GlossaryTerm** | Definition entry | create, update, delete | created, updated, deleted |
| **SearchIndex** | Search index | create, update, rebuild | created, updated, rebuilt |
| **Tag** | Content tag | create, apply, remove | created, applied, removed |
| **Category** | Content category | create, update, delete | created, updated, deleted |

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
| **Review** | Product review | create, publish, hide, respond | created, published, hidden, responded |

### Analytics

Reporting and metrics entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Report** | Data report | create, generate, schedule, export | created, generated, scheduled, exported |
| **Dashboard** | Visual dashboard | create, addWidget, removeWidget, share | created, widgetAdded, widgetRemoved, shared |
| **Widget** | Dashboard component | create, configure, refresh | created, configured, refreshed |
| **Metric** | Tracked metric | define, track, alert | defined, tracked, alerted |
| **Goal** | Target metric | create, track, complete | created, tracked, completed |
| **DataSource** | Data connection | create, connect, sync, disconnect | created, connected, synced, disconnected |
| **Query** | Saved query | create, execute, save, share | created, executed, saved, shared |
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
| **StorageQuota** | Storage limits | check, increase, decrease | checked, increased, decreased |
| **Backup** | Data backup | create, restore, delete, schedule | created, restored, deleted, scheduled |

### Meeting

Video conferencing, webinar, and scheduling entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Meeting** | Video meeting | schedule, start, end, join, leave, record | scheduled, started, ended, joined, left, recorded |
| **MeetingParticipant** | Meeting attendee | invite, admit, remove, mute | invited, admitted, removed, muted |
| **MeetingRecording** | Meeting recording | start, stop, download, delete | started, stopped, downloaded, deleted |
| **Webinar** | Large broadcast | create, start, end, register | created, started, ended, registered |
| **WebinarRegistrant** | Webinar signup | register, confirm, cancel | registered, confirmed, cancelled |
| **MeetingRoom** | Virtual room | create, configure, delete | created, configured, deleted |
| **BreakoutRoom** | Sub-meeting room | create, open, close, assign | created, opened, closed, assigned |
| **MeetingPoll** | In-meeting poll | create, launch, end | created, launched, ended |
| **MeetingChat** | Meeting chat | send, delete, export | sent, deleted, exported |
| **MeetingType** | Meeting configuration | create, update, delete, setDefault | created, updated, deleted, defaultSet |
| **Resource** | Bookable resource (room, equipment) | create, update, delete, setAvailability | created, updated, deleted, availabilitySet |
| **Reservation** | Resource reservation | create, confirm, cancel, reschedule | created, confirmed, cancelled, rescheduled |
| **Waitlist** | Reservation waitlist | join, leave, notify, promote | joined, left, notified, promoted |

### Form

Forms, surveys, and quiz entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Form** | Data form | create, publish, close, duplicate | created, published, closed, duplicated |
| **FormField** | Form input | create, update, delete, reorder | created, updated, deleted, reordered |
| **FormResponse** | Form submission | submit, update, delete | submitted, updated, deleted |
| **Survey** | Survey form | create, publish, close, analyze | created, published, closed, analyzed |
| **SurveyQuestion** | Survey question | create, update, delete, reorder | created, updated, deleted, reordered |
| **SurveyResponse** | Survey submission | submit, update, analyze | submitted, updated, analyzed |
| **Quiz** | Quiz form | create, publish, grade, close | created, published, graded, closed |
| **QuizQuestion** | Quiz question | create, update, delete, reorder | created, updated, deleted, reordered |
| **QuizResult** | Quiz score | submit, grade, review | submitted, graded, reviewed |

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

### Infrastructure

Cloud infrastructure entities (Firebase, GCP, AWS).

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Config** | Configuration settings | create, update, delete, deploy | created, updated, deleted, deployed |
| **ConfigVersion** | Config version | create, rollback, compare | created, rolledBack, compared |
| **Database** | Database instance | create, update, delete, backup, restore | created, updated, deleted, backedUp, restored |
| **Collection** | Database collection | create, update, delete, index | created, updated, deleted, indexed |
| **Index** | Database index | create, delete, rebuild | created, deleted, rebuilt |
| **Hosting** | Web hosting | deploy, rollback, configure | deployed, rolledBack, configured |
| **Deployment** | Deployment instance | create, promote, rollback, delete | created, promoted, rolledBack, deleted |
| **Function** | Serverless function | create, deploy, invoke, delete | created, deployed, invoked, deleted |
| **FunctionLog** | Function log entry | list, stream, filter | created |
| **Identity** | User identity | create, update, delete, disable | created, updated, deleted, disabled |
| **Bucket** | Storage bucket | create, update, delete, setPolicy | created, updated, deleted, policySet |
| **StorageObject** | Bucket object | upload, download, delete, copy | uploaded, downloaded, deleted, copied |

### Experiment

Analytics, A/B testing, and feature flag entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Session** | User session | create, update, end | created, updated, ended |
| **AnalyticsEvent** | Tracked event | track, aggregate | tracked, aggregated |
| **Pageview** | Page view | track, aggregate | tracked, aggregated |
| **Segment** | User segment | create, update, delete | created, updated, deleted |
| **FeatureFlag** | Feature toggle | create, enable, disable, update | created, enabled, disabled, updated |
| **Experiment** | A/B test | create, start, stop, analyze | created, started, stopped, analyzed |
| **ExperimentResult** | Test results | calculate, export | calculated, exported |
| **Funnel** | Conversion funnel | create, update, analyze | created, updated, analyzed |
| **FunnelStep** | Funnel step | create, update, delete | created, updated, deleted |
| **Cohort** | User cohort | create, update, analyze | created, updated, analyzed |

### Advertising

Digital advertising entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Ad** | Advertisement | create, update, pause, resume, delete | created, updated, paused, resumed, deleted |
| **AdGroup** | Ad group | create, update, pause, resume | created, updated, paused, resumed |
| **AdCampaign** | Ad campaign | create, launch, pause, resume, end | created, launched, paused, resumed, ended |
| **Keyword** | Target keyword | create, update, pause, delete | created, updated, paused, deleted |
| **NegativeKeyword** | Excluded keyword | create, delete | created, deleted |
| **Conversion** | Conversion event | track, attribute | tracked, attributed |
| **Budget** | Ad budget | create, update, pause | created, updated, paused |
| **AdAudience** | Target audience | create, update, delete | created, updated, deleted |

### Video

Video platform entities (YouTube, Twitch).

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **VideoChannel** | Video channel | create, update, customize | created, updated, customized |
| **StreamingVideo** | Video content | upload, publish, unpublish, delete | uploaded, published, unpublished, deleted |
| **Playlist** | Video playlist | create, update, delete, addVideo, removeVideo | created, updated, deleted, videoAdded, videoRemoved |
| **PlaylistItem** | Playlist entry | add, remove, reorder | added, removed, reordered |
| **LiveStream** | Live broadcast | create, start, end, configure | created, started, ended, configured |
| **ChatMessage** | Live chat message | send, delete, pin | sent, deleted, pinned |
| **VideoComment** | Video comment | create, reply, delete, pin | created, replied, deleted, pinned |
| **ChannelSubscription** | Channel subscription | subscribe, unsubscribe | subscribed, unsubscribed |

### Identity

Identity, SSO, directory, and secrets management entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Vault** | Secrets vault | create, update, delete, seal, unseal | created, updated, deleted, sealed, unsealed |
| **VaultSecret** | Stored secret | create, update, delete, rotate | created, updated, deleted, rotated |
| **SecretVersion** | Secret version | create, access, delete | created, accessed, deleted |
| **VaultPolicy** | Access policy | create, update, delete, attach | created, updated, deleted, attached |
| **SSOConnection** | SSO connection | create, update, delete, test | created, updated, deleted, tested |
| **Directory** | User directory | create, sync, update | created, synced, updated |
| **DirectoryUser** | Directory user | create, update, suspend, delete | created, updated, suspended, deleted |
| **DirectoryGroup** | Directory group | create, update, delete, addMember, removeMember | created, updated, deleted, memberAdded, memberRemoved |
| **AuditLog** | Audit log entry | create, export, search | created, exported, searched |
| **Organization** | Organization | create, update, delete | created, updated, deleted |
| **OrganizationMember** | Org member | invite, remove, updateRole | invited, removed, roleUpdated |

### Notification

Push, SMS, email, and in-app notification entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Notification** | Generic notification | create, send, schedule, cancel | created, sent, scheduled, cancelled |
| **NotificationTemplate** | Notification template | create, update, delete, test | created, updated, deleted, tested |
| **NotificationCampaign** | Notification campaign | create, launch, pause, end | created, launched, paused, ended |
| **SMS** | SMS message | send, schedule, cancel | sent, delivered, failed, scheduled, cancelled |
| **SMSConversation** | SMS thread | create, reply, close | created, replied, closed |
| **PushNotification** | Push notification | send, schedule, cancel | sent, delivered, opened, dismissed |
| **Device** | User device | register, update, unregister | registered, updated, unregistered |
| **NotificationPreference** | User preferences | update, reset | updated, reset |
| **InAppNotification** | In-app notification | create, mark read, archive, delete | created, read, archived, deleted |

### HR

Human resources entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Employee** | Employee record | create, update, terminate, rehire | created, updated, terminated, rehired |
| **Team** | Team/department | create, update, delete, addMember, removeMember | created, updated, deleted, memberAdded, memberRemoved |
| **TimeOff** | Time off request | request, approve, deny, cancel | requested, approved, denied, cancelled |
| **PerformanceReview** | Performance review | create, submit, approve, complete | created, submitted, approved, completed |
| **Benefit** | Employee benefit | enroll, update, cancel | enrolled, updated, cancelled |
| **Payroll** | Payroll run | create, process, approve, distribute | created, processed, approved, distributed |

### Recruiting

Recruiting and applicant tracking entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Job** | Job posting | create, publish, unpublish, close, reopen | created, published, unpublished, closed, reopened |
| **Candidate** | Job candidate | create, update, archive, merge | created, updated, archived, merged |
| **Application** | Job application | submit, review, advance, reject, withdraw | submitted, reviewed, advanced, rejected, withdrawn |
| **Interview** | Interview session | schedule, reschedule, cancel, complete, feedback | scheduled, rescheduled, cancelled, completed, feedbackSubmitted |
| **Offer** | Job offer | create, send, accept, reject, withdraw, negotiate | created, sent, accepted, rejected, withdrawn, negotiated |

### Design

Design tool entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **DesignFile** | Design file | create, update, rename, duplicate, delete, share, export, version | created, updated, renamed, duplicated, deleted, shared, exported, versioned |
| **Component** | Design component | create, update, publish, unpublish, deprecate, delete | created, updated, published, unpublished, deprecated, deleted |
| **DesignSystem** | Design system | create, update, publish, deprecate | created, updated, published, versionReleased, deprecated |
| **Style** | Design style | create, update, delete, publish | created, updated, deleted, published |
| **Prototype** | Interactive prototype | create, update, share, present | created, updated, shared, presented, viewed |
| **DesignComment** | Design comment | create, update, delete, resolve, reopen, reply | created, updated, deleted, resolved, reopened, replied |

### Shipping

Shipping and logistics entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Shipment** | Package shipment | create, update, ship, cancel, track, requestReturn | created, shipped, inTransit, outForDelivery, delivered, failed, returned, cancelled |
| **Package** | Individual package | create, update, weigh, measure | created, updated, weighed, measured |
| **TrackingEvent** | Tracking scan | create | created |
| **Carrier** | Shipping carrier | create, update, activate, deactivate, getRates | created, updated, activated, deactivated |
| **Rate** | Shipping rate | get, select | retrieved, selected |

### Automation

Workflow automation entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **AutomationWorkflow** | Automated workflow | create, update, activate, pause, archive, duplicate, run, test | created, updated, activated, paused, archived, duplicated, runStarted, runCompleted, runFailed |
| **Trigger** | Workflow trigger | create, update, activate, deactivate, test | created, updated, activated, deactivated, fired |
| **Action** | Workflow action | create, update, delete, test, reorder | created, updated, deleted, executed, failed |
| **AutomationRun** | Workflow execution | start, cancel, retry, resume | started, stepCompleted, stepFailed, completed, failed, cancelled, retried |
| **StepResult** | Step execution result | - | started, completed, failed |
| **Integration** | Connected integration | connect, disconnect, refresh, test | connected, disconnected, refreshed, expired, error |

### AI

AI and machine learning entities.

| Entity | Description | Actions | Events |
|--------|-------------|---------|--------|
| **Model** | AI/ML model | create, update, activate, deactivate, test | created, updated, activated, deactivated, deprecated |
| **Prompt** | Prompt template | create, update, publish, unpublish, duplicate, version, test | created, updated, published, unpublished, versioned |
| **Completion** | AI completion | create, cancel, retry | started, streamed, completed, failed, cancelled |
| **AIConversation** | AI conversation | create, update, archive, delete, fork | created, updated, messageAdded, archived, deleted |
| **Agent** | AI agent | create, update, activate, pause, archive, duplicate, invoke | created, updated, activated, paused, archived, invoked |
| **Embedding** | Vector embedding | create, delete, search | created, deleted |
| **FineTune** | Fine-tuning job | create, cancel | created, started, progressed, succeeded, failed, cancelled |

---

## Usage

```typescript
import { AllEntities, EntityCategories } from 'digital-tools'

// Access all entities by category
const messageEntities = AllEntities.message
const financeEntities = AllEntities.finance
const aiEntities = AllEntities.ai

// List all categories
console.log(EntityCategories)
// ['site', 'message', 'productivity', 'project', 'code', 'sales', 'finance', ...]

// 32 total categories:
// site, message, productivity, project, code, sales, finance, support, media,
// marketing, knowledge, commerce, analytics, storage, meeting, form, signature,
// document, spreadsheet, presentation, infrastructure, experiment, advertising,
// video, identity, notification, hr, recruiting, design, shipping, automation, ai
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
