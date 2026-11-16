# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning once public releases start.

## Unreleased

- No unreleased changes yet

## 1.3.0 - 2026-11-16

- Promotes timed metadata to stable: `attachAudioPlayerCues`, `createPodcastChapterCues`, and the React `useAudioPlayerCues` hook
- Supports typed overlapping cues, stable snapshots, enter/exit events, metadata refresh, and automatic cleanup
- Converts parsed Podcasting 2.0 JSON Chapters 1.2.0, preserving hidden markers and inferred or open-ended ranges
- Keeps cues synchronized across seeks, rate changes, repeat, queue transitions, unload, and source changes
- Adds The Last Signal, a two-part fictional storytelling demo with local narration, contextual material, deferred questions, and playback-preserving exploration
- Includes original demo assets, standard chapter fixtures, reproducible audio generation, and documentation of passage-level reveal rules
- Adds browser coverage for storytelling navigation, detours, answer availability, mobile layout, and failure recovery
- Preserves the existing public playback API; silence skipping and remote playback destinations remain separate follow-ups

## 1.3.0-beta.1 - 2026-11-15

- Adds opt-in timed metadata with `attachAudioPlayerCues`, typed overlapping ranges, stable active snapshots, enter/exit events, metadata refresh, and automatic cleanup
- Adds `createPodcastChapterCues` for parsed Podcasting 2.0 JSON Chapters 1.2.0, preserving hidden markers and supporting inferred and open-ended chapter ranges
- Adds `useAudioPlayerCues(controller)` for application-owned controllers, including React StrictMode support
- Keeps cue presentation aligned after seeking, rate changes, repeat, queue transitions, and source changes
- Prevents stale cue callbacks after unload or destruction and duplicate opening-cue events during queue setup
- Extends the demo with local audio, synchronized artwork, text, links, and chapter navigation
- Documents the metadata contract, consumer-owned fetching and rendering, and parsed timed transcript mapping
- Validates the milestone with 103 unit tests and 18 browser cases across Chromium, Firefox, and WebKit

## 1.2.0 - 2026-11-15

- Adds `player.skip(seconds)` for relative seeking. Media Session seek buttons now use it.
- `seek(NaN)` now sets a `SEEK_ERROR` instead of producing an invalid position
- `AudioPlayerProvider` accepts `persistence` (with `onRestore`), `mediaSession` and `progressReporter` options and attaches and detaches them itself
- `useAudioPlayerState(selector, isEqual?)` re-renders only when the selected value changes
- Adds `useAudioPlayerProgress({ intervalMs })` for throttled, event-driven timeline updates
- Fixes persistence restoration under React StrictMode
- Keeps browser storage failures, including page-teardown and quota errors, from interrupting playback
- Adds real-browser playback and React integration tests, server rendering checks, and bundle size budgets
- Consolidates documentation into `docs/` and adds support, stability, and server-rendering guidance

## 1.2.0-beta.1 - 2026-11-15

- Adds `player.skip(seconds)` for relative seeking. Media Session seek buttons now use it.
- `seek(NaN)` now sets a `SEEK_ERROR` instead of producing an invalid position
- `AudioPlayerProvider` accepts `persistence` (with `onRestore`), `mediaSession` and `progressReporter` options and attaches and detaches them itself
- `useAudioPlayerState(selector, isEqual?)` re-renders only when the selected value changes
- Adds `useAudioPlayerProgress({ intervalMs })` for throttled, event-driven timeline updates
- Fixes persistence restoration under React StrictMode
- Keeps browser storage failures, including page-teardown and quota errors, from interrupting playback
- Adds real-browser playback and React integration tests, server rendering checks, and bundle size budgets
- Consolidates documentation into `docs/` and adds support, stability, and server-rendering guidance

## 1.1.1 - 2026-11-15

- Updates React, React DOM, jsdom, tsup, and TypeScript development dependencies
- Generates declarations with TypeScript 7 while preserving the package entry points
- Refreshes the workspace lockfile and overrides vulnerable docs-tooling dependencies
- Adds docs typechecking to CI
- Known limitation: the docs SVG tooling still depends on deepmerge 4.3.1, which has a low-severity advisory and no patched release

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
