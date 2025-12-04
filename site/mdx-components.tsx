import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Card, Cards } from 'fumadocs-ui/components/card';
import type { MDXComponents } from 'mdx/types';
import {
  Code,
  Database,
  GitBranch,
  Bot,
  Package,
  Briefcase,
  Building2,
  ListTodo,
  UserCircle,
} from 'lucide-react';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Card,
    Cards,
    Code,
    Database,
    GitBranch,
    Bot,
    Package,
    Briefcase,
    Building2,
    ListTodo,
    UserCircle,
    ...components,
  };
}
