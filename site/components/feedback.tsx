'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface FeedbackProps {
  url?: string;
}

export function Feedback({ url }: FeedbackProps) {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = async (type: 'positive' | 'negative') => {
    setFeedback(type);
    setSubmitted(true);

    // You can implement server action here to store feedback
    // For now, we'll just log it
    console.log('Feedback submitted:', { url: url || window.location.pathname, type });
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-fd-muted-foreground border-t border-fd-border pt-6 mt-8">
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm text-fd-muted-foreground border-t border-fd-border pt-6 mt-8">
      <span>Was this page helpful?</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleFeedback('positive')}
          className="p-2 rounded-lg hover:bg-fd-accent transition-colors"
          aria-label="Yes, this page was helpful"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleFeedback('negative')}
          className="p-2 rounded-lg hover:bg-fd-accent transition-colors"
          aria-label="No, this page was not helpful"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
