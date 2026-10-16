# Node, TypeScript, Vite

## Tools

- Package manager: whatever the lockfile says. For a new project or a one-off command with no
  lockfile, prefer `bun`/`bunx`, then `pnpm`, never `npm`.
- Runtime version: `fnm`, never `nvm`.

## Toolchain gate

- Pin: `.node-version`, `.nvmrc`, or `engines.node` in `package.json`. `fnm use` it, then print
  `node --version` and compare. A silent fallback to the shell default is the common failure.
- Install with the lockfile-respecting command (`pnpm install --frozen-lockfile`,
  `bun install --frozen-lockfile`, `npm ci`).
- A worktree that symlinks `node_modules` to the main checkout must install in the main
  checkout first; a symlink to a stale tree is stale in both places.
- `fnm` exports do not persist across shell calls. Re-run `fnm use` in every new shell.

## Reading dependencies

- Verify a dependency's real behaviour in `node_modules/<pkg>/dist/`, not its README.

## Vite

- A dev server started from a worktree with a symlinked `node_modules` needs a temporary
  `server.fs.allow` entry for the symlink target, or client hydration fails. Keep it uncommitted.
