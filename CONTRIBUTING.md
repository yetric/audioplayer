# Contributing

## Local setup

```bash
npm install
```

## Main commands

```bash
npm test
npm run check
npm run build
npm run docs:build
```

## Working rules

- Keep the public API small.
- Prefer the simplest working change.
- Update docs when public behavior changes.
- Add or update tests when behavior changes.

## Release shape

- Update `CHANGELOG.md`.
- Create a GitHub release.
- The publish workflow will publish to npm when the release is published and `NPM_TOKEN` is configured.

## Publishing

```bash
npm login
npm publish
```

npm requires 2FA (passkey) for publishing. Use `--tag <name>` for prereleases.
