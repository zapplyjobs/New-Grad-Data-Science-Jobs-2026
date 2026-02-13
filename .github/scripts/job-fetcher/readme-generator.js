/**
 * README Generator Wrapper (Data-Science-Jobs-2026)
 *
 * Thin wrapper that loads repo-specific config and uses shared library.
 * Migrated from 590-line duplicated file to 25-line wrapper (2026-02-13).
 * Bug #1 proved code duplication = 4x fix effort.
 */

const path = require("path");

// Load repo-specific config
const config = require(path.join(process.cwd(), '.github/scripts/job-fetcher/config.js'));

// Load repo-specific job categories
const jobCategories = require(path.join(process.cwd(), '.github/scripts/job-fetcher/job_categories.json'));

// Validate config before using
const { validateConfig } = require(path.join(__dirname, '../shared/lib/config-validator.js'));
validateConfig(config, process.cwd());

// Import shared readme generator
const { createReadmeGenerator } = require(path.join(__dirname, '../shared/lib/readme-generator.js'));

// Create and export readme generator with repo-specific config
module.exports = createReadmeGenerator(config, jobCategories, process.cwd());
