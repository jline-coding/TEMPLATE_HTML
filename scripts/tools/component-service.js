/**
 * scripts/tools/component-service.js
 * Core Component Engine for Dual Environment
 * Re-exports modularized component architecture:
 * - metadata: Component specification (id, version, schemaVersion, dependencies)
 * - paths: Path confinement, category resolution, safe path resolution
 * - backup: Snapshot backups and safe rollback engine
 * - variants: SCSS class slicing, merging, and card-level deletion
 * - installer: Transactional install with automatic rollback on failure
 * - registry: Drift detection, status checking, and diff viewer
 * - workbench-manager: Canonical showroom management
 */

export * from './components/index.js';
