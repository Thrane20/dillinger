<!--
Sync Impact Report:
- Version change: Initial → 1.0.0
- Added principles: I. Simplicity First, II. User-Centered Design, III. Quality Over Speed
- Added sections: Development Standards, Solo Development Workflow
- Templates requiring updates: ✅ All aligned (initial setup)
- Follow-up TODOs: None
-->

# Dillinger Constitution

## Core Principles

### I. Simplicity First
Start simple and add complexity only when justified by real user needs. Every feature MUST solve a concrete problem before implementation. Prefer readable, maintainable code over clever optimizations. When in doubt, choose the simpler solution that delivers user value.

**Rationale**: As a solo hobby project, maintainability is critical. Complex solutions increase cognitive load and make future development harder.

### II. User-Centered Design
Features MUST be designed from the user's perspective first. Every user story MUST be independently testable and deliver standalone value. Prioritize user experience over technical elegance. Document features from the user's point of view in plain language.

**Rationale**: Ensures development stays focused on delivering value rather than building for the sake of building.

### III. Quality Over Speed
Better to ship fewer, well-tested features than many buggy ones. Every feature MUST have clear acceptance criteria and be validated before moving to the next. Technical debt MUST be documented and addressed before it accumulates.

**Rationale**: In a hobby project, bugs and technical debt can kill motivation and make the project unsustainable.

## Development Standards

All features MUST follow the spec-driven development workflow: specification → plan → implementation → validation. Code MUST be self-documenting with clear variable names and logical organization. Dependencies MUST be justified and documented. Performance requirements MUST be defined upfront for any feature that could impact user experience.

## Solo Development Workflow

Since this is currently a single-developer project, all principles apply to individual commits and feature branches. Self-review is mandatory before merging features. The constitution serves as a personal accountability framework to maintain project quality and direction. As the project grows and potentially adds collaborators, these principles will scale to team review processes.

## Governance

This constitution supersedes all other development practices. Changes to principles require updating the version number and documenting the rationale. Complexity violations MUST be explicitly justified in implementation plans. All features MUST demonstrate compliance with core principles before completion.

**Version**: 1.0.0 | **Ratified**: 2025-10-26 | **Last Amended**: 2025-10-26
