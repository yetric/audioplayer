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

- Use prerelease versions until the package is ready for public beta.
- Update `CHANGELOG.md`.
- Create a GitHub release.
- The publish workflow will publish to npm when the release is published and `NPM_TOKEN` is configured.
