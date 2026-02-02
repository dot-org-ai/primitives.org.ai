# Digital Tools

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

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

Each entity defines **Properties** (data fields), **Actions** (imperative verbs), and **Events** (past tense state changes).

### Site

Deployed web presence with type enumeration.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Site** | `name`, `type` (website, app, api, admin, docs, blog, store, portal, landing, dashboard), `url`, `status`, `environment` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Site** | create, deploy, configure, publish, unpublish, archive | created, deployed, configured, published, unpublished, archived |

---

### Message

Unified communication entities using single-word nouns. The `type` property distinguishes variants.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Message** | `type` (email, text, chat, direct, voicemail), `from`, `to`, `subject`, `body`, `status`, `threadId`, `read`, `starred` |
| **Thread** | `type`, `subject`, `snippet`, `messageCount`, `participants`, `read`, `archived`, `muted` |
| **Call** | `type` (phone, web, video), `direction`, `from`, `to`, `status`, `duration`, `recordingUrl`, `transcription` |
| **Channel** | `name`, `type` (public, private, shared), `topic`, `description`, `archived`, `memberCount` |
| **Workspace** | `name`, `domain`, `description`, `icon`, `memberCount`, `channelCount` |
| **Member** | `userId`, `name`, `email`, `role`, `status`, `lastActiveAt`, `joinedAt` |
| **Contact** | `name`, `firstName`, `lastName`, `email`, `phone`, `company`, `title`, `tags` |
| **Attachment** | `name`, `type`, `size`, `url`, `thumbnail` |
| **Reaction** | `emoji`, `name`, `count` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Message** | send, reply, forward, edit, delete, archive, star, read, label, pin, react, transcribe | sent, delivered, read, failed, bounced, opened, clicked, replied, forwarded, edited, deleted, archived, starred, labeled, pinned, reacted, transcribed |
| **Thread** | archive, unarchive, delete, read, unread, mute, unmute, star, pin, label, move | created, updated, archived, deleted, read, muted, unmuted, starred, pinned, labeled, moved |
| **Call** | initiate, answer, reject, hold, unhold, mute, unmute, transfer, merge, record, transcribe, end | initiated, ringing, answered, rejected, held, muted, transferred, merged, recorded, transcribed, ended, failed |
| **Channel** | create, rename, setTopic, archive, unarchive, delete, join, leave, invite, kick, mute, unmute, pin, unpin | created, renamed, topicSet, archived, unarchived, deleted, joined, left, invited, kicked, muted, unmuted, pinned, unpinned |
| **Workspace** | create, rename, invite, remove, archive, delete, transfer | created, renamed, invited, removed, archived, deleted, transferred |
| **Member** | invite, remove, promote, demote, activate, deactivate, setStatus | invited, joined, removed, promoted, demoted, activated, deactivated, statusChanged |
| **Contact** | create, update, delete, merge, tag, untag, block, unblock | created, updated, deleted, merged, tagged, blocked, unblocked |
| **Attachment** | upload, download, preview, delete | uploaded, downloaded, previewed, deleted |
| **Reaction** | add, remove | added, removed |

---

### Productivity

Calendar, tasks, note-taking, and availability entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Calendar** | `name`, `description`, `color`, `timezone`, `visibility`, `accessRole`, `primary` |
| **Event** | `title`, `description`, `location`, `startTime`, `endTime`, `allDay`, `recurring`, `recurrenceRule`, `status`, `attendees`, `conferenceData` |
| **Availability** | `name`, `timezone`, `schedule`, `dateOverrides`, `bufferBefore`, `bufferAfter`, `minimumNotice`, `daysInAdvance`, `active` |
| **Task** | `title`, `description`, `status`, `completed`, `dueDate`, `priority`, `assignee`, `tags`, `progress`, `blockedBy` |
| **Checklist** | `title`, `description`, `itemCount`, `completedCount`, `progress`, `template` |
| **Note** | `title`, `content`, `format`, `folder`, `tags`, `pinned`, `archived`, `shared`, `wordCount` |
| **Notebook** | `name`, `description`, `color`, `icon`, `type`, `noteCount`, `shared` |
| **Reminder** | `title`, `description`, `dueDate`, `recurring`, `completed`, `snoozedUntil`, `priority`, `notificationMethod` |
| **Bookmark** | `title`, `url`, `description`, `favicon`, `screenshot`, `folder`, `tags`, `favorited`, `archived` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Calendar** | create, update, delete, share, unshare, subscribe, unsubscribe, export, import, sync, setColor, setTimezone | created, updated, deleted, shared, unshared, subscribed, unsubscribed, exported, imported, synced |
| **Event** | create, update, delete, cancel, reschedule, invite, respond, accept, decline, markTentative, addAttendee, removeAttendee, addReminder, removeReminder, duplicate, move | created, updated, deleted, cancelled, rescheduled, invitationSent, responseReceived, accepted, declined, tentative, attendeeAdded, attendeeRemoved, reminderTriggered, started, ended |
| **Availability** | create, update, delete, activate, deactivate, setDefault, addOverride, removeOverride, blockDate, unblockDate | created, updated, deleted, activated, deactivated, overrideAdded, overrideRemoved, dateBlocked, dateUnblocked |
| **Task** | create, update, delete, complete, uncomplete, start, pause, block, unblock, assign, unassign, setPriority, setDueDate, addSubtask, removeSubtask, addTag, removeTag, move, duplicate, archive | created, updated, deleted, completed, uncompleted, started, paused, blocked, unblocked, assigned, unassigned, priorityChanged, dueDateChanged, overdue, subtaskAdded, subtaskCompleted, commented, archived |
| **Checklist** | create, update, delete, addItem, removeItem, checkItem, uncheckItem, reorderItems, clear, reset, duplicate, convertToTemplate | created, updated, deleted, itemAdded, itemRemoved, itemChecked, itemUnchecked, itemsReordered, cleared, completed, duplicated |
| **Note** | create, update, delete, archive, unarchive, pin, unpin, favorite, unfavorite, lock, unlock, share, unshare, duplicate, export, print, addTag, removeTag, move, merge | created, updated, deleted, archived, unarchived, pinned, unpinned, favorited, unfavorited, locked, unlocked, shared, unshared, duplicated, exported, printed, moved, merged |
| **Notebook** | create, update, delete, rename, share, unshare, move, duplicate, export, import, merge, archive | created, updated, deleted, renamed, shared, unshared, moved, duplicated, exported, imported, merged, archived |
| **Reminder** | create, update, delete, complete, uncomplete, snooze, dismiss, trigger, reschedule, duplicate | created, updated, deleted, completed, uncompleted, snoozed, dismissed, triggered, rescheduled, duplicated |
| **Bookmark** | create, update, delete, visit, favorite, unfavorite, archive, unarchive, addTag, removeTag, move, share, export, import | created, updated, deleted, visited, favorited, unfavorited, archived, unarchived, moved, shared, exported, imported |

---

### Project

Project management entities for issues, sprints, and boards.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Project** | `name`, `key`, `description`, `status`, `progress`, `health`, `startDate`, `endDate`, `visibility`, `archived` |
| **Issue** | `title`, `identifier`, `description`, `type`, `priority`, `severity`, `status`, `progress`, `dueDate`, `estimate`, `storyPoints` |
| **Sprint** | `name`, `number`, `goal`, `status`, `startDate`, `endDate`, `capacity`, `commitment`, `completed`, `velocity` |
| **Milestone** | `name`, `description`, `version`, `status`, `progress`, `targetDate`, `completedAt` |
| **Board** | `name`, `description`, `type` (kanban, scrum, list), `swimlanes`, `visibility`, `archived` |
| **Column** | `name`, `description`, `color`, `position`, `wipLimit`, `statusCategory` |
| **Epic** | `name`, `identifier`, `description`, `status`, `progress`, `startDate`, `targetDate`, `storyPoints` |
| **Label** | `name`, `description`, `color`, `icon`, `category` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Project** | create, update, delete, archive, restore, duplicate, setStatus, addMember, removeMember, setOwner, setDates, updateProgress, export | created, updated, deleted, archived, restored, duplicated, statusChanged, memberAdded, memberRemoved, ownerChanged, datesChanged, progressUpdated, completed, cancelled |
| **Issue** | create, update, delete, archive, restore, duplicate, assign, unassign, setStatus, setPriority, setType, addLabel, removeLabel, addSubtask, link, unlink, block, unblock, move, comment, estimate, logTime, watch, unwatch | created, updated, deleted, archived, restored, duplicated, assigned, unassigned, statusChanged, priorityChanged, typeChanged, labeled, unlabeled, subtaskAdded, linked, unlinked, blocked, unblocked, moved, commented, estimated, timeLogged, completed, reopened |
| **Sprint** | create, update, delete, start, complete, cancel, addIssue, removeIssue, setGoal, setCapacity, extend | created, updated, deleted, started, completed, cancelled, issueAdded, issueRemoved, goalChanged, capacityChanged, extended |
| **Milestone** | create, update, delete, archive, restore, complete, cancel, addIssue, removeIssue, setTargetDate | created, updated, deleted, archived, restored, completed, cancelled, issueAdded, issueRemoved, targetDateChanged, delayed |
| **Board** | create, update, delete, archive, restore, duplicate, addColumn, removeColumn, reorderColumns, addMember, removeMember, setSwimlanes | created, updated, deleted, archived, restored, duplicated, columnAdded, columnRemoved, columnsReordered, memberAdded, memberRemoved, swimlanesChanged |
| **Column** | create, update, delete, rename, move, setColor, setWipLimit | created, updated, deleted, renamed, moved, colorChanged, wipLimitChanged, wipLimitExceeded |
| **Epic** | create, update, delete, archive, restore, setStatus, addIssue, removeIssue, setDates, addLabel, removeLabel | created, updated, deleted, archived, restored, statusChanged, issueAdded, issueRemoved, datesChanged, labeled, unlabeled, completed, cancelled |
| **Label** | create, update, delete, rename, setColor, merge | created, updated, deleted, renamed, colorChanged, merged, applied, removed |

---

### Code

Software development entities for repositories and version control.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Repository** | `name`, `description`, `visibility`, `defaultBranch`, `language`, `topics`, `archived`, `forksCount`, `starsCount` |
| **Branch** | `name`, `protected`, `isDefault`, `headCommit`, `behindBy`, `aheadBy` |
| **Commit** | `sha`, `message`, `author`, `committer`, `timestamp`, `parents`, `additions`, `deletions` |
| **PullRequest** | `number`, `title`, `description`, `status`, `sourceBranch`, `targetBranch`, `author`, `reviewers`, `merged` |
| **CodeReview** | `state`, `body`, `author`, `submittedAt`, `comments` |
| **CodeIssue** | `number`, `title`, `description`, `state`, `labels`, `assignees`, `milestone` |
| **Release** | `tagName`, `name`, `description`, `draft`, `prerelease`, `publishedAt`, `assets` |
| **Workflow** | `name`, `path`, `state`, `triggers`, `jobs` |
| **WorkflowRun** | `runNumber`, `status`, `conclusion`, `branch`, `commit`, `startedAt`, `completedAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Repository** | create, clone, fork, archive, unarchive, delete, rename, transfer, setVisibility, addTopic, removeTopic | created, cloned, forked, archived, unarchived, deleted, renamed, transferred, visibilityChanged |
| **Branch** | create, checkout, merge, delete, protect, unprotect, rename | created, checkedOut, merged, deleted, protected, unprotected, renamed |
| **Commit** | create, revert, cherryPick, amend | created, reverted, cherryPicked, amended |
| **PullRequest** | create, update, review, approve, requestChanges, merge, close, reopen, assignReviewer, removeReviewer | created, updated, reviewed, approved, changesRequested, merged, closed, reopened, reviewerAssigned, reviewerRemoved |
| **CodeReview** | submit, approve, requestChanges, comment, dismiss | submitted, approved, changesRequested, commented, dismissed |
| **CodeIssue** | create, update, close, reopen, assign, unassign, label, unlabel, setMilestone | created, updated, closed, reopened, assigned, unassigned, labeled, unlabeled, milestoneSet |
| **Release** | create, publish, draft, delete, update, uploadAsset | created, published, drafted, deleted, updated, assetUploaded |
| **Workflow** | create, update, delete, trigger, disable, enable | created, updated, deleted, triggered, disabled, enabled |
| **WorkflowRun** | trigger, cancel, retry, download, delete | triggered, cancelled, retried, completed, failed, downloaded |

---

### Sales

CRM entities for leads, deals, and customer relationships.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Lead** | `firstName`, `lastName`, `email`, `phone`, `company`, `title`, `source`, `status`, `score`, `assignee` |
| **Deal** | `name`, `value`, `currency`, `stage`, `probability`, `expectedCloseDate`, `closedAt`, `status`, `lostReason` |
| **Account** | `name`, `domain`, `industry`, `size`, `type`, `owner`, `annualRevenue`, `status` |
| **Pipeline** | `name`, `description`, `stages`, `default`, `dealCount` |
| **Stage** | `name`, `probability`, `position`, `type`, `dealCount` |
| **Activity** | `type`, `subject`, `description`, `dueDate`, `completedAt`, `outcome` |
| **Quote** | `number`, `name`, `status`, `subtotal`, `discount`, `tax`, `total`, `validUntil`, `acceptedAt` |
| **QuoteLineItem** | `product`, `description`, `quantity`, `unitPrice`, `discount`, `total` |
| **Product** | `name`, `code`, `description`, `price`, `currency`, `category`, `active` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Lead** | create, update, delete, qualify, convert, disqualify, assign, unassign, merge, score | created, updated, deleted, qualified, converted, disqualified, assigned, unassigned, merged, scored |
| **Deal** | create, update, delete, win, lose, advance, setStage, setOwner, addProduct, removeProduct | created, updated, deleted, won, lost, stageChanged, ownerChanged, productAdded, productRemoved |
| **Account** | create, update, delete, merge, archive, unarchive, setOwner | created, updated, deleted, merged, archived, unarchived, ownerChanged |
| **Pipeline** | create, update, delete, addStage, removeStage, reorderStages, setDefault | created, updated, deleted, stageAdded, stageRemoved, stagesReordered, defaultSet |
| **Stage** | create, update, delete, reorder, setProbability | created, updated, deleted, reordered, probabilityChanged |
| **Activity** | log, schedule, complete, cancel, reschedule, assign | logged, scheduled, completed, cancelled, rescheduled, assigned |
| **Quote** | create, update, delete, send, accept, reject, expire, duplicate | created, updated, deleted, sent, accepted, rejected, expired, duplicated |
| **QuoteLineItem** | add, update, remove, reorder | added, updated, removed, reordered |
| **Product** | create, update, delete, archive, unarchive | created, updated, deleted, archived, unarchived |

---

### Finance (Stripe-based)

Comprehensive financial entities based on Stripe's API.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Customer** | `email`, `name`, `phone`, `description`, `metadata`, `balance`, `currency`, `defaultPaymentMethod` |
| **Product** | `name`, `description`, `active`, `images`, `metadata`, `type`, `unitLabel` |
| **Price** | `currency`, `unitAmount`, `recurring`, `type`, `billingScheme`, `active` |
| **PaymentMethod** | `type`, `card`, `billingDetails`, `customer`, `created` |
| **PaymentIntent** | `amount`, `currency`, `status`, `paymentMethod`, `customer`, `metadata` |
| **Charge** | `amount`, `currency`, `status`, `paid`, `refunded`, `customer`, `paymentMethod` |
| **Refund** | `amount`, `currency`, `status`, `reason`, `charge`, `paymentIntent` |
| **Invoice** | `number`, `customer`, `status`, `total`, `amountDue`, `amountPaid`, `dueDate`, `paidAt` |
| **Subscription** | `status`, `customer`, `items`, `currentPeriodStart`, `currentPeriodEnd`, `canceledAt`, `trialEnd` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Customer** | create, update, delete, search | created, updated, deleted |
| **Product** | create, update, archive, unarchive | created, updated, archived |
| **Price** | create, update, archive | created, updated, archived |
| **PaymentMethod** | attach, detach, update, setDefault | attached, detached, updated |
| **PaymentIntent** | create, confirm, cancel, capture | created, succeeded, failed, cancelled |
| **Charge** | create, capture, refund | created, captured, refunded |
| **Refund** | create, update, cancel | created, updated, cancelled |
| **Invoice** | create, send, pay, void, finalize | created, sent, paid, voided, finalized |
| **Subscription** | create, update, cancel, resume, pause | created, updated, cancelled, resumed, paused |

**Connect (Platforms):**

| Entity | Key Properties | Actions | Events |
|--------|----------------|---------|--------|
| **Account** | `type`, `country`, `email`, `capabilities`, `payoutsEnabled`, `chargesEnabled` | create, update, delete, reject | created, updated, deleted |
| **AccountLink** | `url`, `expiresAt`, `type` | create | created |
| **ApplicationFee** | `amount`, `currency`, `account`, `charge` | list, retrieve, refund | created, refunded |

**Treasury (Embedded Banking):**

| Entity | Key Properties | Actions | Events |
|--------|----------------|---------|--------|
| **FinancialAccount** | `balance`, `currency`, `status`, `features` | create, update, close | created, updated, closed |
| **TreasuryTransaction** | `amount`, `currency`, `status`, `flowType` | list, retrieve | created |
| **InboundTransfer** | `amount`, `currency`, `status`, `origin` | create, cancel | created, succeeded, failed |
| **OutboundTransfer** | `amount`, `currency`, `status`, `destination` | create, cancel | created, posted, failed |
| **OutboundPayment** | `amount`, `currency`, `status`, `destination` | create, cancel | created, posted, failed |
| **ReceivedCredit** | `amount`, `currency`, `status`, `network` | list, retrieve | created |
| **ReceivedDebit** | `amount`, `currency`, `status`, `network` | list, retrieve | created |

**Issuing (Cards):**

| Entity | Key Properties | Actions | Events |
|--------|----------------|---------|--------|
| **IssuingCard** | `type`, `status`, `brand`, `last4`, `expMonth`, `expYear`, `spendingControls` | create, update, ship, cancel | created, shipped, activated |
| **IssuingCardholder** | `name`, `email`, `phone`, `status`, `type`, `billingAddress` | create, update | created, updated |
| **IssuingAuthorization** | `amount`, `currency`, `status`, `merchant`, `approved` | approve, decline | created, approved, declined |
| **IssuingTransaction** | `amount`, `currency`, `type`, `merchant`, `authorization` | list, retrieve | created |
| **IssuingDispute** | `amount`, `currency`, `status`, `reason`, `evidence` | create, submit | created, submitted, won, lost |

**Bank & Webhooks:**

| Entity | Key Properties | Actions | Events |
|--------|----------------|---------|--------|
| **BankAccount** | `bankName`, `accountHolderName`, `accountType`, `last4`, `status` | create, verify, delete | created, verified, deleted |
| **WebhookEndpoint** | `url`, `enabledEvents`, `status`, `secret` | create, update, delete, enable, disable | created, updated, deleted, enabled, disabled |
| **Event** | `type`, `data`, `created`, `livemode` | list, retrieve | created |

---

### Support

Customer support and help desk entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **SupportTicket** | `subject`, `description`, `status`, `priority`, `type`, `channel`, `assignee`, `requester`, `tags` |
| **TicketComment** | `body`, `author`, `public`, `attachments`, `createdAt` |
| **Conversation** | `subject`, `status`, `channel`, `assignee`, `participants`, `lastMessageAt` |
| **ConversationMessage** | `body`, `author`, `type`, `attachments`, `createdAt` |
| **HelpArticle** | `title`, `body`, `status`, `category`, `author`, `views`, `helpful`, `notHelpful` |
| **HelpCategory** | `name`, `description`, `slug`, `parent`, `position`, `articleCount` |
| **FAQ** | `question`, `answer`, `category`, `position`, `views` |
| **SatisfactionRating** | `score`, `comment`, `ticket`, `ratedBy`, `createdAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **SupportTicket** | create, update, assign, resolve, close, reopen, escalate, merge, addTag, removeTag | created, updated, assigned, resolved, closed, reopened, escalated, merged, tagged |
| **TicketComment** | add, edit, delete | added, edited, deleted |
| **Conversation** | start, reply, close, reopen, transfer, snooze, unsnooze, assign | started, replied, closed, reopened, transferred, snoozed, unsnoozed, assigned |
| **ConversationMessage** | send, edit, delete | sent, edited, deleted |
| **HelpArticle** | create, update, publish, unpublish, archive, unarchive, translate | created, updated, published, unpublished, archived, unarchived, translated |
| **HelpCategory** | create, update, delete, reorder | created, updated, deleted, reordered |
| **FAQ** | create, update, delete, reorder | created, updated, deleted, reordered |
| **SatisfactionRating** | submit, update | submitted, updated |

---

### Media

Image, video, and audio content entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Image** | `url`, `format`, `width`, `height`, `size`, `alt`, `caption`, `tags`, `metadata` |
| **Video** | `url`, `format`, `duration`, `width`, `height`, `size`, `thumbnail`, `captions` |
| **Audio** | `url`, `format`, `duration`, `size`, `waveform`, `transcript` |
| **Screenshot** | `url`, `format`, `width`, `height`, `annotations`, `capturedAt` |
| **Album** | `name`, `description`, `cover`, `mediaCount`, `visibility`, `createdAt` |
| **MediaLibrary** | `name`, `totalSize`, `mediaCount`, `folders`, `tags` |
| **Transcript** | `text`, `language`, `confidence`, `segments`, `speakers` |
| **Caption** | `text`, `language`, `format`, `startTime`, `endTime` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Image** | upload, transform, tag, untag, delete, optimize, crop, resize | uploaded, transformed, tagged, untagged, deleted, optimized, cropped, resized |
| **Video** | upload, transcode, trim, delete, generateThumbnail, addCaption | uploaded, transcoded, trimmed, deleted, thumbnailGenerated, captionAdded |
| **Audio** | upload, transcode, trim, delete, transcribe | uploaded, transcoded, trimmed, deleted, transcribed |
| **Screenshot** | capture, annotate, share, delete | captured, annotated, shared, deleted |
| **Album** | create, update, delete, addMedia, removeMedia, share, unshare | created, updated, deleted, mediaAdded, mediaRemoved, shared, unshared |
| **MediaLibrary** | create, organize, search, import, export | created, organized, searched, imported, exported |
| **Transcript** | generate, edit, export, translate | generated, edited, exported, translated |
| **Caption** | generate, edit, sync, export | generated, edited, synced, exported |

---

### Marketing

Campaign and audience management entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Campaign** | `name`, `type`, `status`, `channel`, `budget`, `startDate`, `endDate`, `goals`, `metrics` |
| **Audience** | `name`, `description`, `size`, `criteria`, `type`, `source`, `lastUpdated` |
| **EmailTemplate** | `name`, `subject`, `body`, `format`, `category`, `variables`, `preview` |
| **LandingPage** | `name`, `url`, `status`, `template`, `title`, `description`, `conversionGoal` |
| **FormSubmission** | `form`, `data`, `source`, `submittedAt`, `processed` |
| **SocialPost** | `content`, `media`, `platform`, `status`, `scheduledAt`, `publishedAt`, `engagement` |
| **AdCreative** | `name`, `type`, `headline`, `body`, `media`, `callToAction`, `status` |
| **UTMLink** | `url`, `source`, `medium`, `campaign`, `term`, `content`, `shortUrl`, `clicks` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Campaign** | create, update, launch, pause, resume, end, duplicate, archive | created, updated, launched, paused, resumed, ended, duplicated, archived |
| **Audience** | create, update, delete, segment, sync, export | created, updated, deleted, segmented, synced, exported |
| **EmailTemplate** | create, edit, delete, test, publish, unpublish, duplicate | created, edited, deleted, tested, published, unpublished, duplicated |
| **LandingPage** | create, update, publish, unpublish, test, duplicate, delete | created, updated, published, unpublished, tested, duplicated, deleted |
| **FormSubmission** | submit, export, delete | submitted, exported, deleted |
| **SocialPost** | create, schedule, publish, delete, edit | created, scheduled, published, deleted, edited |
| **AdCreative** | create, update, delete, approve, reject, duplicate | created, updated, deleted, approved, rejected, duplicated |
| **UTMLink** | create, update, delete, shorten | created, updated, deleted, shortened, clicked |

---

### Knowledge

Wiki and knowledge management entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **WikiPage** | `title`, `content`, `slug`, `parent`, `author`, `status`, `version`, `lastEditedAt` |
| **WikiSpace** | `name`, `key`, `description`, `icon`, `visibility`, `pageCount` |
| **WikiRevision** | `content`, `author`, `message`, `version`, `createdAt` |
| **Article** | `title`, `body`, `slug`, `status`, `author`, `category`, `tags`, `views` |
| **KnowledgeBase** | `name`, `description`, `url`, `theme`, `articleCount`, `categoryCount` |
| **Glossary** | `name`, `description`, `termCount` |
| **GlossaryTerm** | `term`, `definition`, `aliases`, `category` |
| **SearchIndex** | `name`, `documents`, `lastIndexedAt`, `status` |
| **Tag** | `name`, `slug`, `color`, `usageCount` |
| **Category** | `name`, `slug`, `description`, `parent`, `position`, `articleCount` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **WikiPage** | create, update, publish, unpublish, archive, move, delete, restore, addComment | created, updated, published, unpublished, archived, moved, deleted, restored, commented |
| **WikiSpace** | create, update, delete, archive, rename | created, updated, deleted, archived, renamed |
| **WikiRevision** | create, restore, compare | created, restored, compared |
| **Article** | create, update, publish, unpublish, archive, delete, translate | created, updated, published, unpublished, archived, deleted, translated |
| **KnowledgeBase** | create, update, delete, configure, publish | created, updated, deleted, configured, published |
| **Glossary** | create, update, delete | created, updated, deleted |
| **GlossaryTerm** | create, update, delete | created, updated, deleted |
| **SearchIndex** | create, update, delete, rebuild, optimize | created, updated, deleted, rebuilt, optimized |
| **Tag** | create, update, delete, apply, remove, merge | created, updated, deleted, applied, removed, merged |
| **Category** | create, update, delete, reorder, move | created, updated, deleted, reordered, moved |

---

### Commerce

E-commerce entities for products, orders, and customers.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Product** | `name`, `description`, `sku`, `price`, `compareAtPrice`, `images`, `category`, `status`, `inventory` |
| **ProductVariant** | `name`, `sku`, `price`, `options`, `inventory`, `weight`, `dimensions` |
| **Order** | `number`, `status`, `customer`, `items`, `subtotal`, `tax`, `shipping`, `total`, `shippingAddress` |
| **OrderItem** | `product`, `variant`, `quantity`, `price`, `total` |
| **Cart** | `items`, `subtotal`, `currency`, `customer`, `expiresAt` |
| **Customer** | `email`, `firstName`, `lastName`, `phone`, `addresses`, `orders`, `totalSpent` |
| **Inventory** | `product`, `variant`, `location`, `quantity`, `reserved`, `available` |
| **Discount** | `code`, `type`, `value`, `minPurchase`, `maxUses`, `usageCount`, `startsAt`, `endsAt` |
| **Review** | `product`, `rating`, `title`, `body`, `author`, `verified`, `status` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Product** | create, update, delete, publish, unpublish, archive, duplicate | created, updated, deleted, published, unpublished, archived, duplicated |
| **ProductVariant** | create, update, delete | created, updated, deleted |
| **Order** | create, update, fulfill, cancel, refund, archive | created, updated, fulfilled, cancelled, refunded, archived |
| **OrderItem** | add, update, remove | added, updated, removed |
| **Cart** | create, addItem, updateItem, removeItem, checkout, abandon | created, itemAdded, itemUpdated, itemRemoved, checkedOut, abandoned |
| **Customer** | create, update, delete, merge | created, updated, deleted, merged |
| **Inventory** | update, reserve, release, transfer, adjust | updated, reserved, released, transferred, adjusted |
| **Discount** | create, update, delete, apply, expire | created, updated, deleted, applied, expired |
| **Review** | create, update, delete, publish, hide, respond | created, updated, deleted, published, hidden, responded |

---

### Analytics

Reporting and metrics entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Report** | `name`, `description`, `type`, `dateRange`, `filters`, `dimensions`, `metrics`, `schedule` |
| **Dashboard** | `name`, `description`, `widgets`, `layout`, `shared`, `refreshInterval` |
| **Widget** | `name`, `type`, `dataSource`, `query`, `visualization`, `position`, `size` |
| **Metric** | `name`, `description`, `formula`, `unit`, `aggregation`, `currentValue`, `trend` |
| **Goal** | `name`, `metric`, `target`, `currentValue`, `progress`, `dueDate`, `status` |
| **DataSource** | `name`, `type`, `connectionString`, `credentials`, `status`, `lastSyncAt` |
| **Query** | `name`, `sql`, `dataSource`, `parameters`, `cached`, `lastRunAt` |
| **Alert** | `name`, `metric`, `condition`, `threshold`, `channels`, `enabled`, `lastTriggeredAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Report** | create, update, delete, generate, schedule, export, share | created, updated, deleted, generated, scheduled, exported, shared |
| **Dashboard** | create, update, delete, addWidget, removeWidget, share, duplicate | created, updated, deleted, widgetAdded, widgetRemoved, shared, duplicated |
| **Widget** | create, update, delete, configure, refresh, move, resize | created, updated, deleted, configured, refreshed, moved, resized |
| **Metric** | create, update, delete, define, track | created, updated, deleted, defined, tracked, alerted |
| **Goal** | create, update, delete, track, complete | created, updated, deleted, tracked, completed, missed |
| **DataSource** | create, update, delete, connect, disconnect, sync, test | created, updated, deleted, connected, disconnected, synced, tested |
| **Query** | create, update, delete, execute, save, share | created, updated, deleted, executed, saved, shared |
| **Alert** | create, update, delete, enable, disable, trigger, acknowledge | created, updated, deleted, enabled, disabled, triggered, acknowledged |

---

### Storage

File and cloud storage entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **File** | `name`, `path`, `size`, `mimeType`, `extension`, `url`, `metadata`, `createdAt`, `updatedAt` |
| **Folder** | `name`, `path`, `parent`, `fileCount`, `size`, `createdAt` |
| **Drive** | `name`, `type`, `capacity`, `used`, `available`, `mounted`, `path` |
| **SharedLink** | `url`, `file`, `permissions`, `password`, `expiresAt`, `downloads` |
| **FileVersion** | `version`, `size`, `author`, `comment`, `createdAt` |
| **StorageQuota** | `used`, `limit`, `available`, `percentUsed` |
| **Backup** | `name`, `source`, `destination`, `size`, `status`, `completedAt`, `schedule` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **File** | upload, download, move, copy, rename, delete, restore, share | uploaded, downloaded, moved, copied, renamed, deleted, restored, shared |
| **Folder** | create, rename, move, copy, delete | created, renamed, moved, copied, deleted |
| **Drive** | mount, unmount, sync, format | mounted, unmounted, synced, formatted |
| **SharedLink** | create, update, revoke | created, updated, revoked, accessed |
| **FileVersion** | create, restore, delete | created, restored, deleted |
| **StorageQuota** | check, increase, decrease | checked, increased, decreased, exceeded |
| **Backup** | create, restore, delete, schedule | created, restored, deleted, scheduled, completed, failed |

---

### Meeting

Video conferencing, webinar, and scheduling entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Meeting** | `title`, `description`, `type`, `startTime`, `endTime`, `duration`, `host`, `joinUrl`, `status`, `recording` |
| **MeetingParticipant** | `user`, `role`, `joinedAt`, `leftAt`, `muted`, `videoOn` |
| **MeetingRecording** | `url`, `duration`, `size`, `format`, `transcript`, `createdAt` |
| **Webinar** | `title`, `description`, `startTime`, `duration`, `host`, `panelists`, `capacity`, `registrationRequired` |
| **WebinarRegistrant** | `email`, `firstName`, `lastName`, `status`, `registeredAt`, `attendedAt` |
| **MeetingRoom** | `name`, `capacity`, `equipment`, `location`, `status` |
| **BreakoutRoom** | `name`, `participants`, `duration`, `status` |
| **MeetingPoll** | `question`, `options`, `anonymous`, `status`, `results` |
| **MeetingChat** | `sender`, `message`, `timestamp`, `type` |
| **MeetingType** | `name`, `duration`, `description`, `settings`, `default` |
| **Resource** | `name`, `type`, `location`, `capacity`, `amenities`, `availability` |
| **Reservation** | `resource`, `startTime`, `endTime`, `organizer`, `status`, `attendees` |
| **Waitlist** | `resource`, `user`, `requestedAt`, `position`, `notifiedAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Meeting** | schedule, start, end, join, leave, record, cancel, reschedule | scheduled, started, ended, joined, left, recorded, cancelled, rescheduled |
| **MeetingParticipant** | invite, admit, remove, mute, unmute, promote, demote | invited, admitted, removed, muted, unmuted, promoted, demoted |
| **MeetingRecording** | start, stop, pause, resume, download, delete, share | started, stopped, paused, resumed, downloaded, deleted, shared |
| **Webinar** | create, update, start, end, delete, register | created, updated, started, ended, deleted, registered |
| **WebinarRegistrant** | register, confirm, cancel, attend | registered, confirmed, cancelled, attended |
| **MeetingRoom** | create, update, delete, configure | created, updated, deleted, configured |
| **BreakoutRoom** | create, open, close, assign, broadcast | created, opened, closed, assigned, broadcasted |
| **MeetingPoll** | create, launch, end, share | created, launched, ended, shared |
| **MeetingChat** | send, delete, export | sent, deleted, exported |
| **MeetingType** | create, update, delete, setDefault | created, updated, deleted, defaultSet |
| **Resource** | create, update, delete, setAvailability | created, updated, deleted, availabilitySet |
| **Reservation** | create, confirm, cancel, reschedule, checkIn, checkOut | created, confirmed, cancelled, rescheduled, checkedIn, checkedOut |
| **Waitlist** | join, leave, notify, promote | joined, left, notified, promoted |

---

### Form

Forms, surveys, and quiz entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Form** | `name`, `description`, `fields`, `status`, `submissions`, `settings`, `theme` |
| **FormField** | `type`, `label`, `required`, `placeholder`, `options`, `validation`, `position` |
| **FormResponse** | `form`, `data`, `submittedAt`, `submitter`, `completed` |
| **Survey** | `name`, `description`, `questions`, `status`, `responses`, `analytics` |
| **SurveyQuestion** | `type`, `text`, `required`, `options`, `logic`, `position` |
| **SurveyResponse** | `survey`, `answers`, `submittedAt`, `completed`, `duration` |
| **Quiz** | `name`, `description`, `questions`, `passingScore`, `timeLimit`, `shuffleQuestions` |
| **QuizQuestion** | `type`, `text`, `options`, `correctAnswer`, `points`, `explanation` |
| **QuizResult** | `quiz`, `user`, `score`, `passed`, `answers`, `completedAt`, `duration` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Form** | create, update, delete, publish, close, duplicate | created, updated, deleted, published, closed, duplicated |
| **FormField** | create, update, delete, reorder | created, updated, deleted, reordered |
| **FormResponse** | submit, update, delete, export | submitted, updated, deleted, exported |
| **Survey** | create, update, delete, publish, close, analyze | created, updated, deleted, published, closed, analyzed |
| **SurveyQuestion** | create, update, delete, reorder | created, updated, deleted, reordered |
| **SurveyResponse** | submit, update, delete, analyze | submitted, updated, deleted, analyzed |
| **Quiz** | create, update, delete, publish, close, grade | created, updated, deleted, published, closed, graded |
| **QuizQuestion** | create, update, delete, reorder | created, updated, deleted, reordered |
| **QuizResult** | submit, grade, review, retake | submitted, graded, reviewed, retaken |

---

### Signature

E-signature workflow entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **SignatureDocument** | `name`, `status`, `file`, `signers`, `template`, `expiresAt`, `completedAt` |
| **SignatureRequest** | `document`, `signer`, `status`, `sentAt`, `viewedAt`, `signedAt`, `declinedAt` |
| **Signer** | `name`, `email`, `role`, `order`, `status`, `signedAt` |
| **SignatureField** | `type`, `signer`, `page`, `x`, `y`, `width`, `height`, `required`, `value` |
| **Signature** | `type`, `data`, `timestamp`, `ipAddress`, `verified` |
| **SignatureTemplate** | `name`, `description`, `document`, `fields`, `signerRoles` |
| **AuditTrail** | `document`, `events`, `actors`, `timestamps`, `ipAddresses` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **SignatureDocument** | create, send, void, download, delete, remind | created, sent, voided, completed, downloaded, deleted |
| **SignatureRequest** | send, resend, remind, cancel | sent, resent, viewed, signed, declined, reminded, cancelled |
| **Signer** | create, update, delete, invite, verify | created, updated, deleted, invitationSent, verified |
| **SignatureField** | create, update, delete, move, resize, setValue | created, updated, deleted, moved, resized, completed |
| **Signature** | create, validate, verify | created, validated, verified |
| **SignatureTemplate** | create, update, delete, use, share, duplicate | created, updated, deleted, used, shared, duplicated |
| **AuditTrail** | view, export, verify | created, viewed, exported, verified |

---

### Document

Word processing entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Document** | `title`, `content`, `format`, `owner`, `collaborators`, `status`, `lastEditedAt`, `version` |
| **DocumentVersion** | `version`, `content`, `author`, `message`, `createdAt` |
| **DocumentComment** | `content`, `author`, `position`, `resolved`, `replies`, `createdAt` |
| **DocumentCollaborator** | `user`, `permission`, `addedAt`, `lastAccessedAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Document** | create, update, delete, save, export, share, duplicate, restore, lock, unlock | created, updated, deleted, saved, exported, shared, duplicated, restored, locked, unlocked |
| **DocumentVersion** | create, restore, compare, delete | created, restored, compared, deleted |
| **DocumentComment** | create, update, delete, reply, resolve, reopen | created, updated, deleted, replied, resolved, reopened |
| **DocumentCollaborator** | invite, remove, updatePermissions | invited, removed, permissionsUpdated |

---

### Spreadsheet

Spreadsheet and data table entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Spreadsheet** | `name`, `sheets`, `owner`, `collaborators`, `lastEditedAt` |
| **Sheet** | `name`, `index`, `rows`, `columns`, `frozen`, `hidden` |
| **Cell** | `row`, `column`, `value`, `formula`, `format`, `comment` |
| **Range** | `sheet`, `startRow`, `startColumn`, `endRow`, `endColumn`, `values` |
| **Chart** | `type`, `title`, `dataRange`, `options`, `position`, `size` |
| **PivotTable** | `name`, `sourceRange`, `rows`, `columns`, `values`, `filters` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Spreadsheet** | create, open, save, export, share, duplicate, delete | created, opened, saved, exported, shared, duplicated, deleted |
| **Sheet** | create, rename, delete, duplicate, hide, show, move | created, renamed, deleted, duplicated, hidden, shown, moved |
| **Cell** | setValue, setFormula, format, clear, merge, unmerge | valueChanged, formulaSet, formatted, cleared, merged, unmerged |
| **Range** | select, setValue, format, sort, filter, copy, paste | selected, valuesChanged, formatted, sorted, filtered, copied, pasted |
| **Chart** | create, update, delete, export, move, resize | created, updated, deleted, exported, moved, resized |
| **PivotTable** | create, update, delete, refresh, addField, removeField, filter | created, updated, deleted, refreshed, fieldAdded, fieldRemoved, filtered |

---

### Presentation

Slide presentation entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Presentation** | `name`, `slides`, `theme`, `owner`, `collaborators`, `lastEditedAt` |
| **Slide** | `index`, `layout`, `elements`, `notes`, `animations`, `transition` |
| **SlideElement** | `type`, `content`, `position`, `size`, `style`, `animation` |
| **SpeakerNotes** | `slide`, `content`, `format` |
| **Animation** | `element`, `type`, `trigger`, `duration`, `delay`, `order` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Presentation** | create, open, save, export, present, share, duplicate, delete | created, opened, saved, exported, presented, shared, duplicated, deleted |
| **Slide** | create, duplicate, delete, move, setLayout, setTransition | created, duplicated, deleted, moved, layoutSet, transitionSet |
| **SlideElement** | create, update, delete, move, resize, animate, lock, unlock | created, updated, deleted, moved, resized, animated, locked, unlocked |
| **SpeakerNotes** | create, update, delete | created, updated, deleted |
| **Animation** | create, update, delete, reorder | created, updated, deleted, reordered |

---

### Infrastructure

Cloud infrastructure entities (Firebase, GCP, AWS).

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Config** | `name`, `environment`, `values`, `version`, `deployedAt` |
| **ConfigVersion** | `version`, `values`, `author`, `message`, `createdAt` |
| **Database** | `name`, `type`, `status`, `region`, `size`, `connections` |
| **Collection** | `name`, `database`, `documentCount`, `size`, `indexes` |
| **Index** | `name`, `collection`, `fields`, `unique`, `status` |
| **Hosting** | `domain`, `ssl`, `status`, `deployments`, `currentVersion` |
| **Deployment** | `version`, `status`, `environment`, `startedAt`, `completedAt` |
| **Function** | `name`, `runtime`, `trigger`, `memory`, `timeout`, `status` |
| **FunctionLog** | `function`, `level`, `message`, `timestamp`, `executionId` |
| **Identity** | `uid`, `email`, `displayName`, `provider`, `disabled`, `lastSignInAt` |
| **Bucket** | `name`, `region`, `size`, `objects`, `versioning`, `lifecycle` |
| **StorageObject** | `name`, `bucket`, `size`, `contentType`, `metadata`, `url` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Config** | create, update, delete, deploy, rollback | created, updated, deleted, deployed, rolledBack |
| **ConfigVersion** | create, restore, compare | created, restored, compared |
| **Database** | create, update, delete, backup, restore, scale | created, updated, deleted, backedUp, restored, scaled |
| **Collection** | create, update, delete, index | created, updated, deleted, indexed |
| **Index** | create, delete, rebuild | created, deleted, rebuilt |
| **Hosting** | deploy, rollback, configure, setDomain | deployed, rolledBack, configured, domainSet |
| **Deployment** | create, promote, rollback, delete | created, promoted, rolledBack, deleted |
| **Function** | create, deploy, invoke, delete, update | created, deployed, invoked, deleted, updated |
| **FunctionLog** | list, stream, filter, export | created |
| **Identity** | create, update, delete, disable, enable, sendVerification | created, updated, deleted, disabled, enabled, verificationSent |
| **Bucket** | create, update, delete, setPolicy, setCors | created, updated, deleted, policySet, corsSet |
| **StorageObject** | upload, download, delete, copy, move | uploaded, downloaded, deleted, copied, moved |

---

### Experiment

Analytics, A/B testing, and feature flag entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Session** | `id`, `userId`, `startedAt`, `endedAt`, `duration`, `device`, `location`, `events` |
| **AnalyticsEvent** | `name`, `properties`, `userId`, `sessionId`, `timestamp` |
| **Pageview** | `path`, `title`, `referrer`, `duration`, `userId`, `sessionId`, `timestamp` |
| **Segment** | `name`, `description`, `criteria`, `userCount`, `dynamic` |
| **FeatureFlag** | `key`, `name`, `description`, `enabled`, `targeting`, `defaultValue`, `variants` |
| **Experiment** | `name`, `hypothesis`, `status`, `variants`, `metrics`, `traffic`, `startedAt`, `endedAt` |
| **ExperimentResult** | `experiment`, `variant`, `metric`, `value`, `confidence`, `significant` |
| **Funnel** | `name`, `steps`, `conversionRate`, `dropoffRate` |
| **FunnelStep** | `name`, `event`, `order`, `conversionRate`, `dropoffRate` |
| **Cohort** | `name`, `criteria`, `userCount`, `createdAt`, `behavior` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Session** | create, update, end | created, updated, ended |
| **AnalyticsEvent** | track, aggregate | tracked, aggregated |
| **Pageview** | track, aggregate | tracked, aggregated |
| **Segment** | create, update, delete, sync | created, updated, deleted, synced |
| **FeatureFlag** | create, update, delete, enable, disable, target | created, updated, deleted, enabled, disabled, targeted |
| **Experiment** | create, update, start, stop, analyze, archive | created, updated, started, stopped, analyzed, archived |
| **ExperimentResult** | calculate, export | calculated, exported |
| **Funnel** | create, update, delete, analyze | created, updated, deleted, analyzed |
| **FunnelStep** | create, update, delete | created, updated, deleted |
| **Cohort** | create, update, delete, analyze, export | created, updated, deleted, analyzed, exported |

---

### Advertising

Digital advertising entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Ad** | `name`, `headline`, `description`, `displayUrl`, `finalUrl`, `status`, `type` |
| **AdGroup** | `name`, `status`, `campaign`, `defaultBid`, `ads`, `keywords` |
| **AdCampaign** | `name`, `status`, `budget`, `startDate`, `endDate`, `objective`, `targeting` |
| **Keyword** | `text`, `matchType`, `bid`, `qualityScore`, `status` |
| **NegativeKeyword** | `text`, `matchType`, `level` |
| **Conversion** | `name`, `category`, `value`, `count`, `source`, `timestamp` |
| **Budget** | `amount`, `currency`, `period`, `spent`, `remaining` |
| **AdAudience** | `name`, `type`, `size`, `criteria`, `source` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Ad** | create, update, delete, pause, resume, approve, reject | created, updated, deleted, paused, resumed, approved, rejected |
| **AdGroup** | create, update, delete, pause, resume | created, updated, deleted, paused, resumed |
| **AdCampaign** | create, update, delete, launch, pause, resume, end | created, updated, deleted, launched, paused, resumed, ended |
| **Keyword** | create, update, delete, pause | created, updated, deleted, paused |
| **NegativeKeyword** | create, delete | created, deleted |
| **Conversion** | track, attribute, export | tracked, attributed, exported |
| **Budget** | create, update, pause, resume | created, updated, paused, resumed |
| **AdAudience** | create, update, delete, sync | created, updated, deleted, synced |

---

### Video

Video platform entities (YouTube, Twitch).

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **VideoChannel** | `name`, `handle`, `description`, `subscriberCount`, `videoCount`, `verified` |
| **StreamingVideo** | `title`, `description`, `url`, `duration`, `thumbnail`, `status`, `views`, `likes` |
| **Playlist** | `title`, `description`, `privacy`, `itemCount`, `thumbnail` |
| **PlaylistItem** | `video`, `position`, `addedAt` |
| **LiveStream** | `title`, `description`, `status`, `scheduledAt`, `startedAt`, `viewers`, `chatEnabled` |
| **ChatMessage** | `content`, `author`, `timestamp`, `type`, `highlighted` |
| **VideoComment** | `content`, `author`, `likes`, `replies`, `timestamp`, `pinned` |
| **ChannelSubscription** | `channel`, `subscriber`, `subscribedAt`, `notifications` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **VideoChannel** | create, update, customize, delete, verify | created, updated, customized, deleted, verified |
| **StreamingVideo** | upload, update, publish, unpublish, delete, monetize | uploaded, updated, published, unpublished, deleted, monetized |
| **Playlist** | create, update, delete, addVideo, removeVideo, reorder | created, updated, deleted, videoAdded, videoRemoved, reordered |
| **PlaylistItem** | add, remove, reorder | added, removed, reordered |
| **LiveStream** | create, update, start, end, configure, delete | created, updated, started, ended, configured, deleted |
| **ChatMessage** | send, delete, pin, timeout, ban | sent, deleted, pinned, timedOut, banned |
| **VideoComment** | create, update, delete, reply, pin, heart | created, updated, deleted, replied, pinned, hearted |
| **ChannelSubscription** | subscribe, unsubscribe, setNotifications | subscribed, unsubscribed, notificationsSet |

---

### Identity

Identity, SSO, directory, and secrets management entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Vault** | `name`, `status`, `sealed`, `version`, `policies` |
| **VaultSecret** | `path`, `version`, `metadata`, `createdAt`, `expiresAt` |
| **SecretVersion** | `version`, `createdAt`, `deletedAt`, `destroyed` |
| **VaultPolicy** | `name`, `rules`, `paths` |
| **SSOConnection** | `name`, `type`, `domain`, `status`, `idpUrl`, `certificate` |
| **Directory** | `name`, `type`, `domain`, `status`, `userCount`, `groupCount` |
| **DirectoryUser** | `email`, `firstName`, `lastName`, `status`, `groups`, `lastSyncAt` |
| **DirectoryGroup** | `name`, `description`, `members`, `type` |
| **AuditLog** | `action`, `actor`, `target`, `timestamp`, `ipAddress`, `details` |
| **Organization** | `name`, `slug`, `plan`, `memberCount`, `createdAt` |
| **OrganizationMember** | `user`, `role`, `invitedAt`, `joinedAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Vault** | create, update, delete, seal, unseal | created, updated, deleted, sealed, unsealed |
| **VaultSecret** | create, update, delete, rotate | created, updated, deleted, rotated, accessed |
| **SecretVersion** | create, access, delete, destroy | created, accessed, deleted, destroyed |
| **VaultPolicy** | create, update, delete, attach, detach | created, updated, deleted, attached, detached |
| **SSOConnection** | create, update, delete, test, enable, disable | created, updated, deleted, tested, enabled, disabled |
| **Directory** | create, update, delete, sync | created, updated, deleted, synced |
| **DirectoryUser** | create, update, delete, suspend, unsuspend | created, updated, deleted, suspended, unsuspended |
| **DirectoryGroup** | create, update, delete, addMember, removeMember | created, updated, deleted, memberAdded, memberRemoved |
| **AuditLog** | create, export, search | created, exported, searched |
| **Organization** | create, update, delete | created, updated, deleted |
| **OrganizationMember** | invite, remove, updateRole | invited, joined, removed, roleUpdated |

---

### Notification

Push, SMS, email, and in-app notification entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Notification** | `title`, `body`, `type`, `channel`, `status`, `sentAt`, `readAt` |
| **NotificationTemplate** | `name`, `channel`, `subject`, `body`, `variables` |
| **NotificationCampaign** | `name`, `template`, `audience`, `status`, `scheduledAt`, `sentCount` |
| **SMS** | `to`, `from`, `body`, `status`, `segments`, `sentAt`, `deliveredAt` |
| **SMSConversation** | `participants`, `lastMessageAt`, `status`, `messageCount` |
| **PushNotification** | `title`, `body`, `data`, `badge`, `sound`, `status`, `sentAt` |
| **Device** | `token`, `platform`, `model`, `osVersion`, `appVersion`, `pushEnabled` |
| **NotificationPreference** | `channel`, `enabled`, `frequency`, `quietHours` |
| **InAppNotification** | `title`, `body`, `type`, `read`, `actionUrl`, `createdAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Notification** | create, send, schedule, cancel, markRead | created, sent, scheduled, cancelled, read |
| **NotificationTemplate** | create, update, delete, test | created, updated, deleted, tested |
| **NotificationCampaign** | create, update, launch, pause, resume, end | created, updated, launched, paused, resumed, ended |
| **SMS** | send, schedule, cancel | sent, delivered, failed, scheduled, cancelled |
| **SMSConversation** | create, reply, close | created, replied, closed |
| **PushNotification** | send, schedule, cancel | sent, delivered, opened, dismissed, scheduled, cancelled |
| **Device** | register, update, unregister | registered, updated, unregistered |
| **NotificationPreference** | update, reset | updated, reset |
| **InAppNotification** | create, markRead, archive, delete | created, read, archived, deleted |

---

### HR

Human resources entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Employee** | `firstName`, `lastName`, `email`, `status`, `type`, `title`, `department`, `startDate`, `salary` |
| **Team** | `name`, `description`, `type`, `status`, `lead`, `members` |
| **TimeOff** | `type`, `status`, `startDate`, `endDate`, `hours`, `reason` |
| **PerformanceReview** | `type`, `status`, `periodStart`, `periodEnd`, `overallRating`, `goals` |
| **Benefit** | `type`, `plan`, `status`, `coverageLevel`, `effectiveDate` |
| **Payroll** | `payPeriodStart`, `payPeriodEnd`, `payDate`, `status`, `grossPay`, `netPay` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Employee** | create, update, onboard, offboard, terminate, promote, transfer, updateCompensation | created, updated, onboarded, offboarded, terminated, promoted, transferred, compensationUpdated |
| **Team** | create, update, delete, archive, addMember, removeMember, setLead | created, updated, deleted, archived, memberAdded, memberRemoved, leadChanged |
| **TimeOff** | request, approve, deny, cancel, modify | requested, approved, denied, cancelled, modified |
| **PerformanceReview** | create, submitSelfAssessment, submitManagerReview, complete, acknowledge, reopen | created, selfAssessmentSubmitted, managerReviewSubmitted, completed, acknowledged, reopened |
| **Benefit** | enroll, update, cancel, renew | enrolled, updated, cancelled, renewed, expired |
| **Payroll** | create, process, approve, cancel | created, processed, approved, paid, cancelled |

---

### Recruiting

Recruiting and applicant tracking entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Job** | `title`, `description`, `department`, `location`, `workType`, `status`, `salaryMin`, `salaryMax` |
| **Candidate** | `firstName`, `lastName`, `email`, `phone`, `resumeUrl`, `source`, `currentTitle` |
| **Application** | `status`, `stage`, `rating`, `appliedAt`, `rejectionReason` |
| **Interview** | `type`, `status`, `scheduledAt`, `duration`, `feedback`, `rating`, `recommendation` |
| **Offer** | `status`, `title`, `salary`, `bonus`, `equity`, `startDate`, `expiresAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Job** | create, update, publish, pause, close, reopen, duplicate | created, updated, published, paused, closed, reopened, filled |
| **Candidate** | create, update, merge, archive, addTag, removeTag | created, updated, merged, archived, tagAdded, tagRemoved |
| **Application** | submit, review, advance, reject, withdraw, restore | submitted, reviewed, advanced, rejected, withdrawn, restored, hired |
| **Interview** | schedule, confirm, reschedule, cancel, complete, submitFeedback | scheduled, confirmed, rescheduled, cancelled, started, completed, feedbackSubmitted |
| **Offer** | create, update, submitForApproval, approve, send, accept, decline, rescind, negotiate | created, updated, submittedForApproval, approved, sent, accepted, declined, rescinded, negotiated, expired |

---

### Design

Design tool entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **DesignFile** | `name`, `key`, `type`, `version`, `thumbnailUrl`, `pageCount`, `componentCount` |
| **Component** | `name`, `key`, `description`, `category`, `properties`, `status`, `isPublished` |
| **DesignSystem** | `name`, `description`, `version`, `componentCount`, `styleCount`, `status` |
| **Style** | `name`, `key`, `type`, `value`, `category` |
| **Prototype** | `name`, `description`, `startingFrame`, `device`, `previewUrl` |
| **DesignComment** | `message`, `x`, `y`, `frameId`, `status`, `resolvedAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **DesignFile** | create, update, rename, duplicate, delete, share, export, version | created, updated, renamed, duplicated, deleted, shared, exported, versioned |
| **Component** | create, update, publish, unpublish, deprecate, delete | created, updated, published, unpublished, deprecated, deleted |
| **DesignSystem** | create, update, publish, deprecate | created, updated, published, versionReleased, deprecated |
| **Style** | create, update, delete, publish | created, updated, deleted, published |
| **Prototype** | create, update, share, present | created, updated, shared, presented, viewed |
| **DesignComment** | create, update, delete, resolve, reopen, reply | created, updated, deleted, resolved, reopened, replied |

---

### Shipping

Shipping and logistics entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Shipment** | `trackingNumber`, `status`, `carrier`, `service`, `originAddress`, `destinationAddress`, `estimatedDelivery` |
| **Package** | `trackingNumber`, `weight`, `dimensions`, `packageType`, `contents`, `declaredValue` |
| **TrackingEvent** | `status`, `message`, `location`, `timestamp`, `signedBy` |
| **Carrier** | `name`, `code`, `isActive`, `services`, `accountNumber` |
| **Rate** | `carrier`, `service`, `rate`, `currency`, `deliveryDays`, `guaranteed` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Shipment** | create, update, ship, cancel, track, requestReturn | created, shipped, inTransit, outForDelivery, delivered, failed, returned, cancelled |
| **Package** | create, update, weigh, measure | created, updated, weighed, measured |
| **TrackingEvent** | create | created |
| **Carrier** | create, update, activate, deactivate, getRates | created, updated, activated, deactivated |
| **Rate** | get, select | retrieved, selected |

---

### Automation

Workflow automation entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **AutomationWorkflow** | `name`, `description`, `status`, `triggerType`, `isActive`, `runCount`, `lastRunAt` |
| **Trigger** | `type`, `config`, `schedule`, `webhookUrl`, `eventType`, `filters`, `isActive` |
| **Action** | `name`, `type`, `app`, `operation`, `config`, `order`, `continueOnError` |
| **AutomationRun** | `status`, `startedAt`, `completedAt`, `duration`, `triggerData`, `output`, `error` |
| **StepResult** | `status`, `stepNumber`, `actionType`, `startedAt`, `completedAt`, `input`, `output`, `error` |
| **Integration** | `name`, `app`, `status`, `authType`, `accountName`, `expiresAt` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **AutomationWorkflow** | create, update, activate, pause, archive, duplicate, run, test | created, updated, activated, paused, archived, duplicated, runStarted, runCompleted, runFailed |
| **Trigger** | create, update, activate, deactivate, test | created, updated, activated, deactivated, fired |
| **Action** | create, update, delete, test, reorder | created, updated, deleted, executed, failed |
| **AutomationRun** | start, cancel, retry, resume | started, stepCompleted, stepFailed, completed, failed, cancelled, retried |
| **StepResult** | — | started, completed, failed |
| **Integration** | connect, disconnect, refresh, test | connected, disconnected, refreshed, expired, error |

---

### AI

AI and machine learning entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Model** | `name`, `provider`, `modelId`, `type`, `contextWindow`, `maxOutputTokens`, `supportsTools`, `status` |
| **Prompt** | `name`, `template`, `systemPrompt`, `variables`, `defaultModel`, `temperature`, `version` |
| **Completion** | `input`, `output`, `modelId`, `inputTokens`, `outputTokens`, `cost`, `latency`, `status` |
| **AIConversation** | `title`, `systemPrompt`, `modelId`, `messageCount`, `totalTokens`, `lastMessageAt` |
| **Agent** | `name`, `description`, `systemPrompt`, `modelId`, `tools`, `maxIterations`, `status` |
| **Embedding** | `text`, `vector`, `dimensions`, `sourceType`, `modelId`, `namespace` |
| **FineTune** | `name`, `baseModel`, `fineTunedModel`, `status`, `trainingFile`, `epochs` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Model** | create, update, activate, deactivate, test | created, updated, activated, deactivated, deprecated |
| **Prompt** | create, update, publish, unpublish, duplicate, version, test | created, updated, published, unpublished, versioned |
| **Completion** | create, cancel, retry | started, streamed, completed, failed, cancelled |
| **AIConversation** | create, update, archive, delete, fork | created, updated, messageAdded, archived, deleted |
| **Agent** | create, update, activate, pause, archive, duplicate, invoke | created, updated, activated, paused, archived, invoked |
| **Embedding** | create, delete, search | created, deleted |
| **FineTune** | create, cancel | created, started, progressed, succeeded, failed, cancelled |

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
