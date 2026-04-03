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

## Next release step

Current repo state:

- `1.0.0-beta.1` is prepared locally and committed on `main`
- package contents were verified with `npm pack --dry-run`
- tarball install smoke test passed from a clean temp project
- direct `npm publish` from this machine is currently blocked because npm auth is not configured

Next actions:

```bash
npm login
npm whoami
npm publish --tag beta
```

After publish:

- update `podcast-app` to depend on `@yetric/audioplayer@1.0.0-beta.1`
- replace the temporary GitHub dependency there
