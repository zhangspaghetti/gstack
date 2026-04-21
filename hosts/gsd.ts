import type { HostConfig } from '../scripts/host-config';

const gsd: HostConfig = {
  name: 'gsd',
  displayName: 'GSD',
  cliCommand: 'gsd',
  cliAliases: [],

  globalRoot: '.gsd/agent/skills/gstack',
  localSkillRoot: '.claude/skills/gstack',
  hostSubdir: '.gsd',
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
    { from: '~/.claude/skills/review', to: '~/.gsd/agent/skills/review' }
  ],

  runtimeRoot: {
    globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'gstack-upgrade', 'ETHOS.md'],
    globalFiles: { 'review': ['checklist.md', 'TODOS-format.md'] },
  },

  install: {
    prefixable: false,
    linkingStrategy: 'symlink-generated',
  },

  learningsMode: 'basic',
};

export default gsd;
