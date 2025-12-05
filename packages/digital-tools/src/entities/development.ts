/**
 * Development Tool Entity Types (Nouns)
 *
 * Semantic type definitions for code development and version control tools.
 * Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Repository
// =============================================================================

/**
 * Code repository entity
 *
 * Represents a version control repository for managing source code
 */
export const Repository: Noun = {
  singular: 'repository',
  plural: 'repositories',
  description: 'A code repository for version control and collaboration',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Repository name',
    },
    fullName: {
      type: 'string',
      optional: true,
      description: 'Full repository name including owner (e.g., owner/repo)',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Repository description',
    },

    // Configuration
    visibility: {
      type: 'string',
      description: 'Repository visibility: public, private, internal',
      examples: ['public', 'private', 'internal'],
    },
    defaultBranch: {
      type: 'string',
      description: 'Default branch name (e.g., main, master)',
    },
    language: {
      type: 'string',
      optional: true,
      description: 'Primary programming language',
    },
    topics: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Repository topics/tags',
    },

    // Settings
    allowForking: {
      type: 'boolean',
      optional: true,
      description: 'Whether forking is allowed',
    },
    allowMergeCommit: {
      type: 'boolean',
      optional: true,
      description: 'Whether merge commits are allowed',
    },
    allowSquashMerge: {
      type: 'boolean',
      optional: true,
      description: 'Whether squash merging is allowed',
    },
    allowRebaseMerge: {
      type: 'boolean',
      optional: true,
      description: 'Whether rebase merging is allowed',
    },
    deleteBranchOnMerge: {
      type: 'boolean',
      optional: true,
      description: 'Whether to auto-delete branches after merge',
    },

    // Status
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the repository is archived',
    },
    disabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether the repository is disabled',
    },

    // Statistics
    size: {
      type: 'number',
      optional: true,
      description: 'Repository size in kilobytes',
    },
    starCount: {
      type: 'number',
      optional: true,
      description: 'Number of stars',
    },
    forkCount: {
      type: 'number',
      optional: true,
      description: 'Number of forks',
    },
    watcherCount: {
      type: 'number',
      optional: true,
      description: 'Number of watchers',
    },
    openIssueCount: {
      type: 'number',
      optional: true,
      description: 'Number of open issues',
    },

    // URLs
    url: {
      type: 'url',
      optional: true,
      description: 'Repository web URL',
    },
    cloneUrl: {
      type: 'url',
      optional: true,
      description: 'Git clone URL',
    },
    sshUrl: {
      type: 'string',
      optional: true,
      description: 'SSH clone URL',
    },
    homepage: {
      type: 'url',
      optional: true,
      description: 'Project homepage URL',
    },

    // Metadata
    license: {
      type: 'string',
      optional: true,
      description: 'Repository license (e.g., MIT, Apache-2.0)',
    },
    hasIssues: {
      type: 'boolean',
      optional: true,
      description: 'Whether issues are enabled',
    },
    hasProjects: {
      type: 'boolean',
      optional: true,
      description: 'Whether projects are enabled',
    },
    hasWiki: {
      type: 'boolean',
      optional: true,
      description: 'Whether wiki is enabled',
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Repository owner/organization',
    },
    branches: {
      type: 'Branch[]',
      backref: 'repository',
      description: 'Branches in this repository',
    },
    commits: {
      type: 'Commit[]',
      backref: 'repository',
      description: 'Commits in this repository',
    },
    pullRequests: {
      type: 'PullRequest[]',
      backref: 'repository',
      description: 'Pull requests in this repository',
    },
    issues: {
      type: 'CodeIssue[]',
      backref: 'repository',
      description: 'Issues in this repository',
    },
    releases: {
      type: 'Release[]',
      backref: 'repository',
      description: 'Releases/tags in this repository',
    },
    workflows: {
      type: 'Workflow[]',
      backref: 'repository',
      description: 'CI/CD workflows in this repository',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'Repository collaborators',
    },
  },

  actions: [
    'create',
    'clone',
    'fork',
    'archive',
    'unarchive',
    'delete',
    'transfer',
    'rename',
    'updateSettings',
    'addCollaborator',
    'removeCollaborator',
    'star',
    'unstar',
    'watch',
    'unwatch',
    'enableFeature',
    'disableFeature',
  ],

  events: [
    'created',
    'cloned',
    'forked',
    'archived',
    'unarchived',
    'deleted',
    'transferred',
    'renamed',
    'settingsUpdated',
    'collaboratorAdded',
    'collaboratorRemoved',
    'starred',
    'unstarred',
    'watched',
    'unwatched',
    'pushed',
  ],
}

// =============================================================================
// Branch
// =============================================================================

/**
 * Git branch entity
 *
 * Represents a branch in a git repository
 */
export const Branch: Noun = {
  singular: 'branch',
  plural: 'branches',
  description: 'A git branch for parallel development',

  properties: {
    name: {
      type: 'string',
      description: 'Branch name',
    },
    fullName: {
      type: 'string',
      optional: true,
      description: 'Full reference name (e.g., refs/heads/main)',
    },

    // Status
    isDefault: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is the default branch',
    },
    isProtected: {
      type: 'boolean',
      optional: true,
      description: 'Whether this branch is protected',
    },

    // Commit info
    sha: {
      type: 'string',
      optional: true,
      description: 'SHA of the latest commit',
    },
    commitMessage: {
      type: 'string',
      optional: true,
      description: 'Latest commit message',
    },

    // Comparison
    aheadBy: {
      type: 'number',
      optional: true,
      description: 'Commits ahead of base branch',
    },
    behindBy: {
      type: 'number',
      optional: true,
      description: 'Commits behind base branch',
    },

    // Protection rules
    requirePullRequest: {
      type: 'boolean',
      optional: true,
      description: 'Whether pull requests are required for changes',
    },
    requiredReviewers: {
      type: 'number',
      optional: true,
      description: 'Number of required reviewers',
    },
    requireStatusChecks: {
      type: 'boolean',
      optional: true,
      description: 'Whether status checks must pass',
    },
    requireSignedCommits: {
      type: 'boolean',
      optional: true,
      description: 'Whether commits must be signed',
    },
    allowForcePush: {
      type: 'boolean',
      optional: true,
      description: 'Whether force pushing is allowed',
    },
    allowDeletion: {
      type: 'boolean',
      optional: true,
      description: 'Whether branch deletion is allowed',
    },
  },

  relationships: {
    repository: {
      type: 'Repository',
      backref: 'branches',
      description: 'Repository this branch belongs to',
    },
    latestCommit: {
      type: 'Commit',
      description: 'The latest commit on this branch',
    },
    pullRequests: {
      type: 'PullRequest[]',
      description: 'Pull requests for this branch',
    },
  },

  actions: [
    'create',
    'delete',
    'rename',
    'protect',
    'unprotect',
    'merge',
    'rebase',
    'checkout',
    'push',
    'pull',
    'reset',
    'compare',
  ],

  events: [
    'created',
    'deleted',
    'renamed',
    'protected',
    'unprotected',
    'merged',
    'rebased',
    'pushed',
    'pulled',
    'updated',
  ],
}

// =============================================================================
// Commit
// =============================================================================

/**
 * Git commit entity
 *
 * Represents a git commit with changes to the codebase
 */
export const Commit: Noun = {
  singular: 'commit',
  plural: 'commits',
  description: 'A git commit representing a set of changes',

  properties: {
    // Identity
    sha: {
      type: 'string',
      description: 'Commit SHA hash',
    },
    shortSha: {
      type: 'string',
      optional: true,
      description: 'Short SHA (first 7 characters)',
    },

    // Content
    message: {
      type: 'string',
      description: 'Commit message',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'First line of commit message',
    },
    body: {
      type: 'string',
      optional: true,
      description: 'Remaining lines of commit message',
    },

    // Author info
    authorName: {
      type: 'string',
      description: 'Author name',
    },
    authorEmail: {
      type: 'string',
      description: 'Author email',
    },
    authoredAt: {
      type: 'datetime',
      description: 'When the commit was authored',
    },

    // Committer info (may differ from author)
    committerName: {
      type: 'string',
      optional: true,
      description: 'Committer name',
    },
    committerEmail: {
      type: 'string',
      optional: true,
      description: 'Committer email',
    },
    committedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the commit was committed',
    },

    // Changes
    filesChanged: {
      type: 'number',
      optional: true,
      description: 'Number of files changed',
    },
    additions: {
      type: 'number',
      optional: true,
      description: 'Lines added',
    },
    deletions: {
      type: 'number',
      optional: true,
      description: 'Lines deleted',
    },
    changedFiles: {
      type: 'json',
      optional: true,
      description: 'List of changed files with their changes',
    },

    // Verification
    verified: {
      type: 'boolean',
      optional: true,
      description: 'Whether the commit signature is verified',
    },
    signature: {
      type: 'string',
      optional: true,
      description: 'GPG signature',
    },

    // Relationships to other commits
    parentShas: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Parent commit SHAs',
    },
    treeSha: {
      type: 'string',
      optional: true,
      description: 'Git tree SHA',
    },

    // URLs
    url: {
      type: 'url',
      optional: true,
      description: 'Commit web URL',
    },
    htmlUrl: {
      type: 'url',
      optional: true,
      description: 'Commit HTML page URL',
    },
  },

  relationships: {
    repository: {
      type: 'Repository',
      backref: 'commits',
      description: 'Repository this commit belongs to',
    },
    author: {
      type: 'Contact',
      description: 'Commit author',
    },
    committer: {
      type: 'Contact',
      required: false,
      description: 'Person who committed (if different from author)',
    },
    parents: {
      type: 'Commit[]',
      description: 'Parent commits',
    },
    branch: {
      type: 'Branch',
      required: false,
      description: 'Branch this commit is on',
    },
    pullRequest: {
      type: 'PullRequest',
      required: false,
      description: 'Pull request this commit is part of',
    },
  },

  actions: [
    'create',
    'amend',
    'revert',
    'cherryPick',
    'view',
    'compare',
    'blame',
    'sign',
    'verify',
  ],

  events: [
    'created',
    'amended',
    'reverted',
    'cherryPicked',
    'pushed',
    'signed',
    'verified',
  ],
}

// =============================================================================
// Pull Request
// =============================================================================

/**
 * Pull request entity
 *
 * Represents a pull request for code review and merging
 */
export const PullRequest: Noun = {
  singular: 'pull request',
  plural: 'pull requests',
  description: 'A pull request for reviewing and merging code changes',

  properties: {
    // Identity
    number: {
      type: 'number',
      description: 'Pull request number',
    },
    title: {
      type: 'string',
      description: 'Pull request title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Pull request description/body',
    },

    // Status
    status: {
      type: 'string',
      description: 'PR status: open, closed, merged, draft',
      examples: ['open', 'closed', 'merged', 'draft'],
    },
    state: {
      type: 'string',
      description: 'State: open, closed',
      examples: ['open', 'closed'],
    },
    isDraft: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a draft PR',
    },
    mergeable: {
      type: 'boolean',
      optional: true,
      description: 'Whether the PR can be merged',
    },
    mergeableState: {
      type: 'string',
      optional: true,
      description: 'Mergeable state: clean, dirty, unstable, blocked',
      examples: ['clean', 'dirty', 'unstable', 'blocked'],
    },

    // Branches
    headBranch: {
      type: 'string',
      description: 'Source branch name',
    },
    baseBranch: {
      type: 'string',
      description: 'Target branch name',
    },
    headSha: {
      type: 'string',
      optional: true,
      description: 'SHA of the head commit',
    },
    baseSha: {
      type: 'string',
      optional: true,
      description: 'SHA of the base commit',
    },

    // Changes
    filesChanged: {
      type: 'number',
      optional: true,
      description: 'Number of files changed',
    },
    additions: {
      type: 'number',
      optional: true,
      description: 'Lines added',
    },
    deletions: {
      type: 'number',
      optional: true,
      description: 'Lines deleted',
    },
    commits: {
      type: 'number',
      optional: true,
      description: 'Number of commits',
    },

    // Review
    reviewDecision: {
      type: 'string',
      optional: true,
      description: 'Review decision: approved, changes_requested, review_required',
      examples: ['approved', 'changes_requested', 'review_required'],
    },
    requestedReviewers: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Usernames of requested reviewers',
    },
    assignees: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Usernames of assignees',
    },

    // Checks
    checksStatus: {
      type: 'string',
      optional: true,
      description: 'Status checks state: pending, success, failure',
      examples: ['pending', 'success', 'failure'],
    },
    requiredChecksPass: {
      type: 'boolean',
      optional: true,
      description: 'Whether all required checks pass',
    },

    // Merge
    merged: {
      type: 'boolean',
      optional: true,
      description: 'Whether the PR has been merged',
    },
    mergedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the PR was merged',
    },
    mergedBy: {
      type: 'string',
      optional: true,
      description: 'Username who merged the PR',
    },
    mergeCommitSha: {
      type: 'string',
      optional: true,
      description: 'SHA of the merge commit',
    },
    autoMerge: {
      type: 'boolean',
      optional: true,
      description: 'Whether auto-merge is enabled',
    },

    // Metadata
    labels: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Labels applied to the PR',
    },
    milestone: {
      type: 'string',
      optional: true,
      description: 'Milestone name',
    },
    locked: {
      type: 'boolean',
      optional: true,
      description: 'Whether the PR is locked',
    },

    // URLs
    url: {
      type: 'url',
      optional: true,
      description: 'PR API URL',
    },
    htmlUrl: {
      type: 'url',
      optional: true,
      description: 'PR web page URL',
    },
    diffUrl: {
      type: 'url',
      optional: true,
      description: 'URL to view the diff',
    },
    patchUrl: {
      type: 'url',
      optional: true,
      description: 'URL to download the patch',
    },
  },

  relationships: {
    repository: {
      type: 'Repository',
      backref: 'pullRequests',
      description: 'Repository this PR belongs to',
    },
    author: {
      type: 'Contact',
      description: 'PR author',
    },
    headBranchRef: {
      type: 'Branch',
      description: 'Source branch',
    },
    baseBranchRef: {
      type: 'Branch',
      description: 'Target branch',
    },
    commits: {
      type: 'Commit[]',
      description: 'Commits in this PR',
    },
    reviews: {
      type: 'CodeReview[]',
      backref: 'pullRequest',
      description: 'Code reviews on this PR',
    },
    reviewers: {
      type: 'Contact[]',
      description: 'Requested reviewers',
    },
    assignedTo: {
      type: 'Contact[]',
      description: 'People assigned to this PR',
    },
    workflowRuns: {
      type: 'WorkflowRun[]',
      description: 'CI/CD workflow runs for this PR',
    },
    linkedIssues: {
      type: 'CodeIssue[]',
      description: 'Issues linked to this PR',
    },
  },

  actions: [
    'create',
    'update',
    'close',
    'reopen',
    'merge',
    'squashMerge',
    'rebaseMerge',
    'approve',
    'requestChanges',
    'requestReview',
    'assign',
    'unassign',
    'label',
    'unlabel',
    'lock',
    'unlock',
    'enableAutoMerge',
    'disableAutoMerge',
    'convertToDraft',
    'markReadyForReview',
  ],

  events: [
    'created',
    'updated',
    'closed',
    'reopened',
    'merged',
    'approved',
    'changesRequested',
    'reviewRequested',
    'assigned',
    'unassigned',
    'labeled',
    'unlabeled',
    'locked',
    'unlocked',
    'autoMergeEnabled',
    'autoMergeDisabled',
    'convertedToDraft',
    'markedReadyForReview',
    'synchronize',
  ],
}

// =============================================================================
// Code Review
// =============================================================================

/**
 * Code review entity
 *
 * Represents a code review or review comment on a pull request
 */
export const CodeReview: Noun = {
  singular: 'code review',
  plural: 'code reviews',
  description: 'A code review on a pull request',

  properties: {
    // Content
    body: {
      type: 'string',
      optional: true,
      description: 'Review comment body',
    },

    // Type
    reviewType: {
      type: 'string',
      description: 'Type: comment, approve, request_changes',
      examples: ['comment', 'approve', 'request_changes'],
    },
    state: {
      type: 'string',
      description: 'Review state: pending, commented, approved, changes_requested, dismissed',
      examples: ['pending', 'commented', 'approved', 'changes_requested', 'dismissed'],
    },

    // Line-specific (for inline comments)
    path: {
      type: 'string',
      optional: true,
      description: 'File path for inline comment',
    },
    line: {
      type: 'number',
      optional: true,
      description: 'Line number for inline comment',
    },
    startLine: {
      type: 'number',
      optional: true,
      description: 'Start line for multi-line comment',
    },
    side: {
      type: 'string',
      optional: true,
      description: 'Side of diff: LEFT or RIGHT',
      examples: ['LEFT', 'RIGHT'],
    },
    commitId: {
      type: 'string',
      optional: true,
      description: 'Commit SHA this comment is on',
    },

    // Status
    resolved: {
      type: 'boolean',
      optional: true,
      description: 'Whether the comment is resolved',
    },
    outdated: {
      type: 'boolean',
      optional: true,
      description: 'Whether the comment is outdated',
    },

    // URLs
    htmlUrl: {
      type: 'url',
      optional: true,
      description: 'Review web page URL',
    },
  },

  relationships: {
    pullRequest: {
      type: 'PullRequest',
      backref: 'reviews',
      description: 'Pull request this review is on',
    },
    reviewer: {
      type: 'Contact',
      description: 'Person who wrote the review',
    },
    commit: {
      type: 'Commit',
      required: false,
      description: 'Specific commit being reviewed',
    },
    inReplyTo: {
      type: 'CodeReview',
      required: false,
      description: 'Parent comment if this is a reply',
    },
    replies: {
      type: 'CodeReview[]',
      description: 'Replies to this review comment',
    },
  },

  actions: [
    'create',
    'submit',
    'update',
    'delete',
    'dismiss',
    'resolve',
    'unresolve',
    'reply',
  ],

  events: [
    'created',
    'submitted',
    'updated',
    'deleted',
    'dismissed',
    'resolved',
    'unresolved',
    'replied',
  ],
}

// =============================================================================
// Code Issue
// =============================================================================

/**
 * Code issue entity
 *
 * Represents a GitHub/GitLab style issue for tracking bugs, features, and tasks
 */
export const CodeIssue: Noun = {
  singular: 'code issue',
  plural: 'code issues',
  description: 'An issue for tracking bugs, features, and tasks in code',

  properties: {
    // Identity
    number: {
      type: 'number',
      description: 'Issue number',
    },
    title: {
      type: 'string',
      description: 'Issue title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Issue description/body',
    },

    // Status
    state: {
      type: 'string',
      description: 'Issue state: open, closed',
      examples: ['open', 'closed'],
    },
    stateReason: {
      type: 'string',
      optional: true,
      description: 'Reason for state: completed, not_planned, reopened',
      examples: ['completed', 'not_planned', 'reopened'],
    },

    // Classification
    labels: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Labels applied to the issue',
    },
    milestone: {
      type: 'string',
      optional: true,
      description: 'Milestone name',
    },
    assignees: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Usernames of assignees',
    },

    // Interaction
    commentCount: {
      type: 'number',
      optional: true,
      description: 'Number of comments',
    },
    locked: {
      type: 'boolean',
      optional: true,
      description: 'Whether the issue is locked',
    },

    // Dates
    closedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the issue was closed',
    },
    closedBy: {
      type: 'string',
      optional: true,
      description: 'Username who closed the issue',
    },

    // URLs
    url: {
      type: 'url',
      optional: true,
      description: 'Issue API URL',
    },
    htmlUrl: {
      type: 'url',
      optional: true,
      description: 'Issue web page URL',
    },
  },

  relationships: {
    repository: {
      type: 'Repository',
      backref: 'issues',
      description: 'Repository this issue belongs to',
    },
    author: {
      type: 'Contact',
      description: 'Issue author',
    },
    assignedTo: {
      type: 'Contact[]',
      description: 'People assigned to this issue',
    },
    linkedPullRequests: {
      type: 'PullRequest[]',
      description: 'Pull requests that reference this issue',
    },
  },

  actions: [
    'create',
    'update',
    'close',
    'reopen',
    'assign',
    'unassign',
    'label',
    'unlabel',
    'lock',
    'unlock',
    'comment',
    'transfer',
    'pin',
    'unpin',
  ],

  events: [
    'created',
    'updated',
    'closed',
    'reopened',
    'assigned',
    'unassigned',
    'labeled',
    'unlabeled',
    'locked',
    'unlocked',
    'commented',
    'transferred',
    'pinned',
    'unpinned',
  ],
}

// =============================================================================
// Release
// =============================================================================

/**
 * Release entity
 *
 * Represents a release or tag with version information
 */
export const Release: Noun = {
  singular: 'release',
  plural: 'releases',
  description: 'A release or version tag with distribution artifacts',

  properties: {
    // Identity
    tagName: {
      type: 'string',
      description: 'Git tag name (e.g., v1.0.0)',
    },
    name: {
      type: 'string',
      optional: true,
      description: 'Release name/title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Release notes/description',
    },

    // Version
    version: {
      type: 'string',
      optional: true,
      description: 'Semantic version number',
    },
    targetCommitish: {
      type: 'string',
      optional: true,
      description: 'Target branch or commit SHA',
    },

    // Status
    draft: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a draft release',
    },
    prerelease: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a pre-release',
    },
    latest: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is the latest release',
    },

    // Publishing
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the release was published',
    },
    publishedBy: {
      type: 'string',
      optional: true,
      description: 'Username who published the release',
    },

    // URLs
    htmlUrl: {
      type: 'url',
      optional: true,
      description: 'Release web page URL',
    },
    tarballUrl: {
      type: 'url',
      optional: true,
      description: 'URL to download tarball',
    },
    zipballUrl: {
      type: 'url',
      optional: true,
      description: 'URL to download zipball',
    },
  },

  relationships: {
    repository: {
      type: 'Repository',
      backref: 'releases',
      description: 'Repository this release belongs to',
    },
    author: {
      type: 'Contact',
      description: 'Release author',
    },
    commit: {
      type: 'Commit',
      required: false,
      description: 'Commit this release points to',
    },
    assets: {
      type: 'Attachment[]',
      description: 'Release assets (binaries, packages, etc.)',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'publish',
    'unpublish',
    'addAsset',
    'removeAsset',
    'setLatest',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'published',
    'unpublished',
    'assetAdded',
    'assetRemoved',
    'edited',
  ],
}

// =============================================================================
// Workflow
// =============================================================================

/**
 * CI/CD workflow entity
 *
 * Represents a continuous integration/deployment workflow or action
 */
export const Workflow: Noun = {
  singular: 'workflow',
  plural: 'workflows',
  description: 'A CI/CD workflow for automated testing and deployment',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Workflow name',
    },
    path: {
      type: 'string',
      optional: true,
      description: 'Path to workflow file (e.g., .github/workflows/ci.yml)',
    },

    // Status
    state: {
      type: 'string',
      description: 'Workflow state: active, deleted, disabled_manually, disabled_inactivity',
      examples: ['active', 'deleted', 'disabled_manually', 'disabled_inactivity'],
    },

    // Triggers
    triggers: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Events that trigger this workflow (push, pull_request, schedule, etc.)',
      examples: ['push', 'pull_request', 'workflow_dispatch', 'schedule', 'release'],
    },

    // Configuration
    steps: {
      type: 'json',
      optional: true,
      description: 'Workflow steps configuration',
    },
    jobs: {
      type: 'json',
      optional: true,
      description: 'Workflow jobs configuration',
    },
    environment: {
      type: 'json',
      optional: true,
      description: 'Environment variables and secrets',
    },

    // Timing
    timeout: {
      type: 'number',
      optional: true,
      description: 'Workflow timeout in minutes',
    },

    // URLs
    htmlUrl: {
      type: 'url',
      optional: true,
      description: 'Workflow web page URL',
    },
    badgeUrl: {
      type: 'url',
      optional: true,
      description: 'Status badge URL',
    },
  },

  relationships: {
    repository: {
      type: 'Repository',
      backref: 'workflows',
      description: 'Repository this workflow belongs to',
    },
    runs: {
      type: 'WorkflowRun[]',
      backref: 'workflow',
      description: 'Executions of this workflow',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'enable',
    'disable',
    'trigger',
    'dispatch',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'enabled',
    'disabled',
    'triggered',
    'dispatched',
  ],
}

// =============================================================================
// Workflow Run
// =============================================================================

/**
 * Workflow run entity
 *
 * Represents a single execution of a workflow
 */
export const WorkflowRun: Noun = {
  singular: 'workflow run',
  plural: 'workflow runs',
  description: 'An execution instance of a workflow',

  properties: {
    // Identity
    runNumber: {
      type: 'number',
      description: 'Run number for this workflow',
    },
    runAttempt: {
      type: 'number',
      optional: true,
      description: 'Attempt number for this run',
    },

    // Status
    status: {
      type: 'string',
      description: 'Run status: queued, in_progress, completed, waiting',
      examples: ['queued', 'in_progress', 'completed', 'waiting'],
    },
    conclusion: {
      type: 'string',
      optional: true,
      description: 'Run conclusion: success, failure, cancelled, skipped, timed_out, action_required',
      examples: ['success', 'failure', 'cancelled', 'skipped', 'timed_out', 'action_required'],
    },

    // Trigger
    event: {
      type: 'string',
      description: 'Event that triggered the run',
    },
    triggeredBy: {
      type: 'string',
      optional: true,
      description: 'Username who triggered the run',
    },

    // Timing
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the run started',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the run completed',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Run duration in seconds',
    },

    // Context
    headBranch: {
      type: 'string',
      optional: true,
      description: 'Branch name',
    },
    headSha: {
      type: 'string',
      optional: true,
      description: 'Commit SHA',
    },

    // Jobs
    jobsUrl: {
      type: 'url',
      optional: true,
      description: 'URL to view jobs',
    },
    logsUrl: {
      type: 'url',
      optional: true,
      description: 'URL to view logs',
    },

    // Results
    steps: {
      type: 'json',
      optional: true,
      description: 'Individual step results',
    },
    artifacts: {
      type: 'json',
      optional: true,
      description: 'Build artifacts produced',
    },

    // URLs
    htmlUrl: {
      type: 'url',
      optional: true,
      description: 'Run web page URL',
    },
  },

  relationships: {
    workflow: {
      type: 'Workflow',
      backref: 'runs',
      description: 'Workflow that was executed',
    },
    repository: {
      type: 'Repository',
      description: 'Repository the workflow ran in',
    },
    commit: {
      type: 'Commit',
      required: false,
      description: 'Commit that triggered the run',
    },
    branch: {
      type: 'Branch',
      required: false,
      description: 'Branch the run executed on',
    },
    pullRequest: {
      type: 'PullRequest',
      required: false,
      description: 'Pull request that triggered the run',
    },
    triggeredBy: {
      type: 'Contact',
      required: false,
      description: 'User who triggered the run',
    },
  },

  actions: [
    'start',
    'cancel',
    'rerun',
    'approve',
    'viewLogs',
    'downloadArtifacts',
  ],

  events: [
    'started',
    'queued',
    'inProgress',
    'completed',
    'succeeded',
    'failed',
    'cancelled',
    'skipped',
    'timedOut',
    'requiresApproval',
    'approved',
    'rerun',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All development tool entity types
 */
export const DevelopmentEntities = {
  Repository,
  Branch,
  Commit,
  PullRequest,
  CodeReview,
  CodeIssue,
  Release,
  Workflow,
  WorkflowRun,
}

/**
 * Entity categories for organization
 */
export const DevelopmentCategories = {
  versionControl: ['Repository', 'Branch', 'Commit'],
  codeReview: ['PullRequest', 'CodeReview'],
  issueTracking: ['CodeIssue'],
  releases: ['Release'],
  cicd: ['Workflow', 'WorkflowRun'],
} as const
