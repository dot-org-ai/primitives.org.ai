import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { TypeTable } from 'fumadocs-ui/components/type-table';
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
    TypeTable,
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
