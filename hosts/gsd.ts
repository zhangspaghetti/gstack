import type { HostConfig } from '../scripts/host-config';

const gsd: HostConfig = {
  name: 'gsd',
  displayName: 'GSD',
  cliCommand: 'gsd',
  cliAliases: [],

  globalRoot: '.gsd/agent/skills/gstack',
  localSkillRoot: '.gsd/agent/skills/gstack',
  hostSubdir: '.gsd/agent',
  usesEnvVars: true,

  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description'],
    descriptionLimit: null,
  },

  generation: {
    generateMetadata: false,
    skipSkills: ['codex'],
  },

  pathRewrites: [
    { from: '~/.claude/skills/gstack', to: '~/.gsd/agent/skills/gstack' },
    { from: '.claude/skills/gstack', to: '.gsd/agent/skills/gstack' },
    { from: '~/.claude/skills/review', to: '~/.gsd/agent/skills/review' },
    { from: '.claude/skills/review', to: '.gsd/agent/skills/review' },
    { from: '.claude/skills', to: '.gsd/agent/skills' },
  ],

  runtimeRoot: {
    globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'gstack-upgrade', 'ETHOS.md', 'review/specialists'],
    globalFiles: { 'review': ['checklist.md', 'design-checklist.md', 'greptile-triage.md', 'TODOS-format.md'] },
  },

  install: {
    prefixable: false,
    linkingStrategy: 'symlink-generated',
  },

  learningsMode: 'basic',
};

export default gsd;
