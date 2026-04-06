import type { HostConfig } from '../scripts/host-config';

const copilot: HostConfig = {
  name: 'copilot',
  displayName: 'Copilot',
  cliCommand: 'copilot',
  cliAliases: [],

  globalRoot: '.copilot/skills/gstack',
  localSkillRoot: '.copilot/skills/gstack',
  hostSubdir: '.copilot',
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
    { from: '~/.claude/skills/gstack', to: '~/.copilot/skills/gstack' },
    { from: '.claude/skills/gstack', to: '.copilot/skills/gstack' },
    { from: '.claude/skills', to: '.copilot/skills' },
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

export default copilot;
