'use client';

import { useState } from 'react';

const tabLabels: Record<string, string> = {
  business: 'Business',
  service: 'Service',
  product: 'Product',
  agent: 'Agent',
  human: 'Human',
  task: 'Task',
  workflow: 'Workflow',
  database: 'Database',
  function: 'Function',
};

interface CodeTabsClientProps {
  tabs: readonly string[];
  highlightedCode: Record<string, string>;
}

export function CodeTabsClient({ tabs, highlightedCode }: CodeTabsClientProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-[#0d1117] shadow-2xl">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-4 py-2 bg-[#161b22] border-b border-gray-700 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#0d1117] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#21262d]'
              }`}
            >
              {tabLabels[tab]}
            </button>
          );
        })}
      </div>
      {/* Code Content */}
      <div className="px-4 py-4 overflow-x-auto max-h-[500px] overflow-y-auto">
        <div
          className="text-sm leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent [&_code]:block [&_.line]:before:content-[attr(data-line)] [&_.line]:before:inline-block [&_.line]:before:w-6 [&_.line]:before:mr-3 [&_.line]:before:text-right [&_.line]:before:text-gray-500 [&_.line]:before:select-none"
          dangerouslySetInnerHTML={{ __html: highlightedCode[activeTab] }}
        />
      </div>
    </div>
  );
}
