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

## Publishing

Releases publish from CI through npm trusted publishing (OIDC), with no stored token:

1. Update the version in `package.json` and `CHANGELOG.md`, and merge to `main`.
2. Create a GitHub release for the tag. The publish workflow publishes to npm.
3. Prerelease versions (for example `1.2.0-beta.1`) publish under their prerelease tag (`beta`), stable versions under `latest`.

One-time setup: on npmjs.com, open the package settings and add a trusted publisher for GitHub Actions (owner `yetric`, repository `audioplayer`, workflow `publish.yml`).

Manual fallback: `npm login`, then `npm publish` (add `--tag <name>` for prereleases). npm requires a passkey for 2FA.
