---
id: stability
slug: /stability
---

# Stability Policy

The library follows semantic versioning. Patch releases fix bugs and maintain dependencies. Minor releases add compatible APIs. Breaking public API changes require a major release.

The public contract consists of the package exports, exported types, and documented command and event semantics. Internal engines and unexported helpers may change between releases.

Deprecations are documented in the changelog and kept available for at least one minor release before removal in a major release. A security issue may require a faster change; the release notes will explain the impact and migration.

Prereleases use explicit tags such as `beta`. They do not update npm's `latest` tag. APIs introduced in a prerelease may change before the stable release.

Each stable release requires passing unit, package, browser, type, size, example-build, and docs checks. Validate the prerelease in this repo's demos before promotion. External app adoption is not required.

Report reproducible bugs through [GitHub issues](https://github.com/yetric/audioplayer/issues). Include the library version, browser, and a minimal example. Security reports follow [SECURITY.md](https://github.com/yetric/audioplayer/blob/main/SECURITY.md).
