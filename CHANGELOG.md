# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning once public releases start.

## Unreleased

- No unreleased changes yet

## 1.1.0 - 2026-10-11

- Fixes `AudioPlayerProvider` destroying a provider-created player under React StrictMode, which left the player unusable in development
- Publish workflow uses npm trusted publishing (OIDC) and derives the dist-tag from the version
- Adds tests for Media Session, the React adapter, and more queue, persistence and progress behavior

## 1.0.0 - 2026-10-11

- First stable release
- Adds `unload` command to the player
- Extracts internal audio engine boundary
- Fixes persistence `restore()` throwing a `ReferenceError` when the restored source was already loaded

## 1.0.0-beta.1 - 2026-04-04

- Initial browser-first core package
- React adapter
- Persistence, progress reporting, and Media Session support
- Docusaurus external docs site
