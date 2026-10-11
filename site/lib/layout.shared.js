import { OrgAiMark } from './org-ai-mark';
export function baseOptions() {
    return {
        nav: {
            title: (<>
          <OrgAiMark />
          Primitives.org.ai
        </>),
        },
        githubUrl: 'https://github.com/dot-org-ai/primitives.org.ai',
        // dark only, as every Org.AI Foundation site is: no light theme to switch to
        themeSwitch: { enabled: false },
    };
}
