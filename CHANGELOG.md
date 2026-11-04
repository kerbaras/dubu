# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- OpenTofu v1.13.2 compiled to WebAssembly with in-process random, null, local, time and http providers.
- Browser runtime: in-memory filesystem, tty line discipline, one Web Worker per process, IndexedDB persistence.
- Monaco HCL editor with `tofu validate` diagnostics, `tofu fmt` formatting, function/schema completion and hover.
- xterm.js terminal with a sandbox shell (`tofu`, `ls`, `cat`, `rm`, `reset`) and Console/Init/Plan/Apply buttons.
- Multi-file workspaces and starter examples.
- GitHub Pages build and deploy workflow.
