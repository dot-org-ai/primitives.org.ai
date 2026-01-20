/**
 * Tests for Entity Type Definitions
 *
 * Covers all entity types (Nouns) defined for digital tools.
 */

import { describe, it, expect } from 'vitest'
import {
  // Email
  Email,
  EmailThread,

  // Spreadsheet
  Spreadsheet,
  Sheet,
  Cell,

  // Document
  Document,

  // Presentation
  Presentation,
  Slide,

  // Phone
  PhoneCall,
  Voicemail,

  // Team Messaging
  Workspace,
  Channel,
  Message,
  Thread,
  DirectMessage,
  Member,
  Reaction,

  // Supporting
  Attachment,
  Contact,
  Comment,
  Revision,

  // Collections
  DigitalToolEntities,
  DigitalToolCategories,
} from '../src/entities.js'

describe('Email Entities', () => {
  describe('Email', () => {
    it('has correct noun definition', () => {
      expect(Email.singular).toBe('email')
      expect(Email.plural).toBe('emails')
      expect(Email.description).toBeDefined()
    })

    it('has required properties', () => {
      expect(Email.properties).toHaveProperty('messageId')
      expect(Email.properties).toHaveProperty('from')
      expect(Email.properties).toHaveProperty('to')
      expect(Email.properties).toHaveProperty('subject')
      expect(Email.properties).toHaveProperty('body')
      expect(Email.properties).toHaveProperty('status')
    })

    it('has optional addressing properties', () => {
      expect(Email.properties.cc?.optional).toBe(true)
      expect(Email.properties.bcc?.optional).toBe(true)
      expect(Email.properties.replyTo?.optional).toBe(true)
    })

    it('has threading properties', () => {
      expect(Email.properties).toHaveProperty('inReplyTo')
      expect(Email.properties).toHaveProperty('references')
      expect(Email.properties).toHaveProperty('threadId')
    })

    it('defines relationships', () => {
      expect(Email.relationships).toHaveProperty('attachments')
      expect(Email.relationships).toHaveProperty('sender')
      expect(Email.relationships).toHaveProperty('recipients')
      expect(Email.relationships).toHaveProperty('thread')
    })

    it('has standard email actions', () => {
      expect(Email.actions).toContain('compose')
      expect(Email.actions).toContain('send')
      expect(Email.actions).toContain('reply')
      expect(Email.actions).toContain('replyAll')
      expect(Email.actions).toContain('forward')
      expect(Email.actions).toContain('archive')
      expect(Email.actions).toContain('delete')
    })

    it('has email events', () => {
      expect(Email.events).toContain('sent')
      expect(Email.events).toContain('delivered')
      expect(Email.events).toContain('opened')
      expect(Email.events).toContain('bounced')
    })
  })

  describe('EmailThread', () => {
    it('has correct noun definition', () => {
      expect(EmailThread.singular).toBe('email thread')
      expect(EmailThread.plural).toBe('email threads')
    })

    it('has thread-specific properties', () => {
      expect(EmailThread.properties).toHaveProperty('subject')
      expect(EmailThread.properties).toHaveProperty('messageCount')
      expect(EmailThread.properties).toHaveProperty('participants')
      expect(EmailThread.properties).toHaveProperty('lastMessageAt')
    })

    it('has backref relationship to emails', () => {
      expect(EmailThread.relationships?.emails?.backref).toBe('thread')
    })
  })
})

describe('Spreadsheet Entities', () => {
  describe('Spreadsheet', () => {
    it('has correct noun definition', () => {
      expect(Spreadsheet.singular).toBe('spreadsheet')
      expect(Spreadsheet.plural).toBe('spreadsheets')
    })

    it('has core properties', () => {
      expect(Spreadsheet.properties).toHaveProperty('name')
      expect(Spreadsheet.properties).toHaveProperty('format')
      expect(Spreadsheet.properties).toHaveProperty('sheetCount')
    })

    it('has format examples', () => {
      expect(Spreadsheet.properties.format?.examples).toContain('xlsx')
      expect(Spreadsheet.properties.format?.examples).toContain('csv')
      expect(Spreadsheet.properties.format?.examples).toContain('gsheet')
    })

    it('has sheet management actions', () => {
      expect(Spreadsheet.actions).toContain('create')
      expect(Spreadsheet.actions).toContain('addSheet')
      expect(Spreadsheet.actions).toContain('removeSheet')
      expect(Spreadsheet.actions).toContain('export')
    })
  })

  describe('Sheet', () => {
    it('has correct noun definition', () => {
      expect(Sheet.singular).toBe('sheet')
      expect(Sheet.plural).toBe('sheets')
    })

    it('has positional properties', () => {
      expect(Sheet.properties).toHaveProperty('name')
      expect(Sheet.properties).toHaveProperty('index')
      expect(Sheet.properties).toHaveProperty('rowCount')
      expect(Sheet.properties).toHaveProperty('columnCount')
    })

    it('has frozen row/column properties', () => {
      expect(Sheet.properties.frozenRows?.optional).toBe(true)
      expect(Sheet.properties.frozenColumns?.optional).toBe(true)
    })

    it('has backref to spreadsheet', () => {
      expect(Sheet.relationships?.spreadsheet?.backref).toBe('sheets')
    })
  })

  describe('Cell', () => {
    it('has correct noun definition', () => {
      expect(Cell.singular).toBe('cell')
      expect(Cell.plural).toBe('cells')
    })

    it('has cell addressing properties', () => {
      expect(Cell.properties).toHaveProperty('address')
      expect(Cell.properties).toHaveProperty('row')
      expect(Cell.properties).toHaveProperty('column')
    })

    it('has value and formula properties', () => {
      expect(Cell.properties).toHaveProperty('value')
      expect(Cell.properties).toHaveProperty('formula')
      expect(Cell.properties).toHaveProperty('displayValue')
    })

    it('has data type examples', () => {
      expect(Cell.properties.dataType?.examples).toContain('string')
      expect(Cell.properties.dataType?.examples).toContain('number')
      expect(Cell.properties.dataType?.examples).toContain('formula')
    })
  })
})

describe('Document Entity', () => {
  it('has correct noun definition', () => {
    expect(Document.singular).toBe('document')
    expect(Document.plural).toBe('documents')
  })

  it('has content properties', () => {
    expect(Document.properties).toHaveProperty('title')
    expect(Document.properties).toHaveProperty('content')
    expect(Document.properties).toHaveProperty('format')
  })

  it('has statistics properties', () => {
    expect(Document.properties.wordCount?.optional).toBe(true)
    expect(Document.properties.characterCount?.optional).toBe(true)
    expect(Document.properties.pageCount?.optional).toBe(true)
  })

  it('has collaboration relationships', () => {
    expect(Document.relationships).toHaveProperty('owner')
    expect(Document.relationships).toHaveProperty('collaborators')
    expect(Document.relationships).toHaveProperty('comments')
    expect(Document.relationships).toHaveProperty('revisions')
  })

  it('has document workflow actions', () => {
    expect(Document.actions).toContain('create')
    expect(Document.actions).toContain('edit')
    expect(Document.actions).toContain('comment')
    expect(Document.actions).toContain('suggest')
    expect(Document.actions).toContain('accept')
    expect(Document.actions).toContain('reject')
  })
})

describe('Presentation Entities', () => {
  describe('Presentation', () => {
    it('has correct noun definition', () => {
      expect(Presentation.singular).toBe('presentation')
      expect(Presentation.plural).toBe('presentations')
    })

    it('has presentation-specific properties', () => {
      expect(Presentation.properties).toHaveProperty('slideCount')
      expect(Presentation.properties).toHaveProperty('aspectRatio')
      expect(Presentation.properties).toHaveProperty('theme')
    })

    it('has aspect ratio examples', () => {
      expect(Presentation.properties.aspectRatio?.examples).toContain('16:9')
      expect(Presentation.properties.aspectRatio?.examples).toContain('4:3')
    })

    it('has presentation actions', () => {
      expect(Presentation.actions).toContain('present')
      expect(Presentation.actions).toContain('addSlide')
      expect(Presentation.actions).toContain('reorderSlides')
      expect(Presentation.actions).toContain('applyTheme')
    })
  })

  describe('Slide', () => {
    it('has correct noun definition', () => {
      expect(Slide.singular).toBe('slide')
      expect(Slide.plural).toBe('slides')
    })

    it('has slide-specific properties', () => {
      expect(Slide.properties).toHaveProperty('index')
      expect(Slide.properties).toHaveProperty('layout')
      expect(Slide.properties).toHaveProperty('notes')
    })

    it('has layout examples', () => {
      expect(Slide.properties.layout?.examples).toContain('title')
      expect(Slide.properties.layout?.examples).toContain('titleAndContent')
      expect(Slide.properties.layout?.examples).toContain('blank')
    })
  })
})

describe('Phone Entities', () => {
  describe('PhoneCall', () => {
    it('has correct noun definition', () => {
      expect(PhoneCall.singular).toBe('phone call')
      expect(PhoneCall.plural).toBe('phone calls')
    })

    it('has call routing properties', () => {
      expect(PhoneCall.properties).toHaveProperty('from')
      expect(PhoneCall.properties).toHaveProperty('to')
      expect(PhoneCall.properties).toHaveProperty('direction')
    })

    it('has call status tracking', () => {
      expect(PhoneCall.properties).toHaveProperty('status')
      expect(PhoneCall.properties.status?.examples).toContain('ringing')
      expect(PhoneCall.properties.status?.examples).toContain('in-progress')
      expect(PhoneCall.properties.status?.examples).toContain('completed')
    })

    it('has timing properties', () => {
      expect(PhoneCall.properties).toHaveProperty('startedAt')
      expect(PhoneCall.properties).toHaveProperty('answeredAt')
      expect(PhoneCall.properties).toHaveProperty('endedAt')
      expect(PhoneCall.properties).toHaveProperty('duration')
    })

    it('has recording properties', () => {
      expect(PhoneCall.properties).toHaveProperty('recorded')
      expect(PhoneCall.properties).toHaveProperty('recordingUrl')
      expect(PhoneCall.properties).toHaveProperty('transcription')
    })

    it('has telephony actions', () => {
      expect(PhoneCall.actions).toContain('dial')
      expect(PhoneCall.actions).toContain('answer')
      expect(PhoneCall.actions).toContain('hangup')
      expect(PhoneCall.actions).toContain('hold')
      expect(PhoneCall.actions).toContain('transfer')
    })
  })

  describe('Voicemail', () => {
    it('has correct noun definition', () => {
      expect(Voicemail.singular).toBe('voicemail')
      expect(Voicemail.plural).toBe('voicemails')
    })

    it('has voicemail properties', () => {
      expect(Voicemail.properties).toHaveProperty('from')
      expect(Voicemail.properties).toHaveProperty('duration')
      expect(Voicemail.properties).toHaveProperty('audioUrl')
      expect(Voicemail.properties).toHaveProperty('transcription')
      expect(Voicemail.properties).toHaveProperty('read')
    })
  })
})

describe('Team Messaging Entities', () => {
  describe('Workspace', () => {
    it('has correct noun definition', () => {
      expect(Workspace.singular).toBe('workspace')
      expect(Workspace.plural).toBe('workspaces')
    })

    it('has workspace properties', () => {
      expect(Workspace.properties).toHaveProperty('name')
      expect(Workspace.properties).toHaveProperty('visibility')
      expect(Workspace.properties).toHaveProperty('memberCount')
    })

    it('has visibility options', () => {
      expect(Workspace.properties.visibility?.examples).toContain('public')
      expect(Workspace.properties.visibility?.examples).toContain('private')
    })

    it('has workspace relationships', () => {
      expect(Workspace.relationships).toHaveProperty('channels')
      expect(Workspace.relationships).toHaveProperty('members')
    })
  })

  describe('Channel', () => {
    it('has correct noun definition', () => {
      expect(Channel.singular).toBe('channel')
      expect(Channel.plural).toBe('channels')
    })

    it('has channel properties', () => {
      expect(Channel.properties).toHaveProperty('name')
      expect(Channel.properties).toHaveProperty('topic')
      expect(Channel.properties).toHaveProperty('visibility')
      expect(Channel.properties).toHaveProperty('archived')
    })

    it('has backref to workspace', () => {
      expect(Channel.relationships?.workspace?.backref).toBe('channels')
    })

    it('has channel actions', () => {
      expect(Channel.actions).toContain('join')
      expect(Channel.actions).toContain('leave')
      expect(Channel.actions).toContain('archive')
      expect(Channel.actions).toContain('mute')
    })
  })

  describe('Message', () => {
    it('has correct noun definition', () => {
      expect(Message.singular).toBe('message')
      expect(Message.plural).toBe('messages')
    })

    it('has message content properties', () => {
      expect(Message.properties).toHaveProperty('text')
      expect(Message.properties).toHaveProperty('richText')
    })

    it('has threading properties', () => {
      expect(Message.properties).toHaveProperty('threadId')
      expect(Message.properties).toHaveProperty('replyCount')
    })

    it('has editing properties', () => {
      expect(Message.properties).toHaveProperty('edited')
      expect(Message.properties).toHaveProperty('editedAt')
    })

    it('has message relationships', () => {
      expect(Message.relationships).toHaveProperty('channel')
      expect(Message.relationships).toHaveProperty('sender')
      expect(Message.relationships).toHaveProperty('reactions')
    })

    it('has message actions', () => {
      expect(Message.actions).toContain('send')
      expect(Message.actions).toContain('edit')
      expect(Message.actions).toContain('react')
      expect(Message.actions).toContain('reply')
      expect(Message.actions).toContain('pin')
    })
  })

  describe('Thread', () => {
    it('has correct noun definition', () => {
      expect(Thread.singular).toBe('thread')
      expect(Thread.plural).toBe('threads')
    })

    it('has thread statistics', () => {
      expect(Thread.properties).toHaveProperty('replyCount')
      expect(Thread.properties).toHaveProperty('participantCount')
      expect(Thread.properties).toHaveProperty('lastReplyAt')
    })
  })

  describe('DirectMessage', () => {
    it('has correct noun definition', () => {
      expect(DirectMessage.singular).toBe('direct message')
      expect(DirectMessage.plural).toBe('direct messages')
    })

    it('has DM properties', () => {
      expect(DirectMessage.properties).toHaveProperty('isGroup')
      expect(DirectMessage.properties).toHaveProperty('lastMessageAt')
      expect(DirectMessage.properties).toHaveProperty('unreadCount')
    })
  })

  describe('Member', () => {
    it('has correct noun definition', () => {
      expect(Member.singular).toBe('member')
      expect(Member.plural).toBe('members')
    })

    it('has member profile properties', () => {
      expect(Member.properties).toHaveProperty('displayName')
      expect(Member.properties).toHaveProperty('username')
      expect(Member.properties).toHaveProperty('avatar')
      expect(Member.properties).toHaveProperty('title')
    })

    it('has presence properties', () => {
      expect(Member.properties).toHaveProperty('status')
      expect(Member.properties).toHaveProperty('presence')
      expect(Member.properties.presence?.examples).toContain('online')
      expect(Member.properties.presence?.examples).toContain('away')
      expect(Member.properties.presence?.examples).toContain('dnd')
    })

    it('has role property with examples', () => {
      expect(Member.properties.role?.examples).toContain('owner')
      expect(Member.properties.role?.examples).toContain('admin')
      expect(Member.properties.role?.examples).toContain('member')
    })
  })

  describe('Reaction', () => {
    it('has correct noun definition', () => {
      expect(Reaction.singular).toBe('reaction')
      expect(Reaction.plural).toBe('reactions')
    })

    it('has reaction properties', () => {
      expect(Reaction.properties).toHaveProperty('emoji')
      expect(Reaction.properties).toHaveProperty('count')
    })

    it('has backref to message', () => {
      expect(Reaction.relationships?.message?.backref).toBe('reactions')
    })
  })
})

describe('Supporting Entities', () => {
  describe('Attachment', () => {
    it('has correct noun definition', () => {
      expect(Attachment.singular).toBe('attachment')
      expect(Attachment.plural).toBe('attachments')
    })

    it('has file properties', () => {
      expect(Attachment.properties).toHaveProperty('filename')
      expect(Attachment.properties).toHaveProperty('mimeType')
      expect(Attachment.properties).toHaveProperty('size')
      expect(Attachment.properties).toHaveProperty('url')
    })

    it('has file actions', () => {
      expect(Attachment.actions).toContain('upload')
      expect(Attachment.actions).toContain('download')
      expect(Attachment.actions).toContain('preview')
    })
  })

  describe('Contact', () => {
    it('has correct noun definition', () => {
      expect(Contact.singular).toBe('contact')
      expect(Contact.plural).toBe('contacts')
    })

    it('has contact information properties', () => {
      expect(Contact.properties).toHaveProperty('name')
      expect(Contact.properties).toHaveProperty('email')
      expect(Contact.properties).toHaveProperty('phone')
      expect(Contact.properties).toHaveProperty('company')
    })
  })

  describe('Comment', () => {
    it('has correct noun definition', () => {
      expect(Comment.singular).toBe('comment')
      expect(Comment.plural).toBe('comments')
    })

    it('has comment properties', () => {
      expect(Comment.properties).toHaveProperty('text')
      expect(Comment.properties).toHaveProperty('anchor')
      expect(Comment.properties).toHaveProperty('resolved')
    })

    it('has backref to document', () => {
      expect(Comment.relationships?.document?.backref).toBe('comments')
    })
  })

  describe('Revision', () => {
    it('has correct noun definition', () => {
      expect(Revision.singular).toBe('revision')
      expect(Revision.plural).toBe('revisions')
    })

    it('has version properties', () => {
      expect(Revision.properties).toHaveProperty('version')
      expect(Revision.properties).toHaveProperty('label')
      expect(Revision.properties).toHaveProperty('changes')
    })

    it('has backref to document', () => {
      expect(Revision.relationships?.document?.backref).toBe('revisions')
    })
  })
})

describe('Entity Collections', () => {
  describe('DigitalToolEntities', () => {
    it('contains all entity types', () => {
      expect(DigitalToolEntities).toHaveProperty('Email')
      expect(DigitalToolEntities).toHaveProperty('EmailThread')
      expect(DigitalToolEntities).toHaveProperty('Spreadsheet')
      expect(DigitalToolEntities).toHaveProperty('Sheet')
      expect(DigitalToolEntities).toHaveProperty('Cell')
      expect(DigitalToolEntities).toHaveProperty('Document')
      expect(DigitalToolEntities).toHaveProperty('Presentation')
      expect(DigitalToolEntities).toHaveProperty('Slide')
      expect(DigitalToolEntities).toHaveProperty('PhoneCall')
      expect(DigitalToolEntities).toHaveProperty('Voicemail')
      expect(DigitalToolEntities).toHaveProperty('Workspace')
      expect(DigitalToolEntities).toHaveProperty('Channel')
      expect(DigitalToolEntities).toHaveProperty('Message')
      expect(DigitalToolEntities).toHaveProperty('Thread')
      expect(DigitalToolEntities).toHaveProperty('DirectMessage')
      expect(DigitalToolEntities).toHaveProperty('Member')
      expect(DigitalToolEntities).toHaveProperty('Reaction')
      expect(DigitalToolEntities).toHaveProperty('Attachment')
      expect(DigitalToolEntities).toHaveProperty('Contact')
      expect(DigitalToolEntities).toHaveProperty('Comment')
      expect(DigitalToolEntities).toHaveProperty('Revision')
    })

    it('has 21 entity types', () => {
      expect(Object.keys(DigitalToolEntities)).toHaveLength(21)
    })
  })

  describe('DigitalToolCategories', () => {
    it('organizes entities by category', () => {
      expect(DigitalToolCategories.email).toContain('Email')
      expect(DigitalToolCategories.email).toContain('EmailThread')

      expect(DigitalToolCategories.spreadsheet).toContain('Spreadsheet')
      expect(DigitalToolCategories.spreadsheet).toContain('Sheet')
      expect(DigitalToolCategories.spreadsheet).toContain('Cell')

      expect(DigitalToolCategories.document).toContain('Document')

      expect(DigitalToolCategories.presentation).toContain('Presentation')
      expect(DigitalToolCategories.presentation).toContain('Slide')

      expect(DigitalToolCategories.phone).toContain('PhoneCall')
      expect(DigitalToolCategories.phone).toContain('Voicemail')

      expect(DigitalToolCategories.messaging).toContain('Workspace')
      expect(DigitalToolCategories.messaging).toContain('Channel')
      expect(DigitalToolCategories.messaging).toContain('Message')

      expect(DigitalToolCategories.shared).toContain('Attachment')
      expect(DigitalToolCategories.shared).toContain('Contact')
    })

    it('has 7 categories', () => {
      expect(Object.keys(DigitalToolCategories)).toHaveLength(7)
    })
  })
})
