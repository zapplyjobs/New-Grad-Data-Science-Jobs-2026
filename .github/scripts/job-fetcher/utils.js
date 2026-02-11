/**
 * Job Fetcher Utilities - Wrapper for Shared Library
 *
 * MIGRATED TO SHARED SUBMODULE: 2026-02-11
 *
 * This file now acts as a thin wrapper that re-exports from the shared
 * job-board-scripts library. This ensures all repos use the same
 * filtering logic (DRY principle) while maintaining backwards compatibility.
 *
 * Source of Truth: .github/scripts/shared/lib/utils.js
 * Repository: https://github.com/zapplyjobs/job-board-scripts
 *
 * Benefits of shared library:
 * - Single source of truth for all 7 job board repos
 * - Bug fixes apply to all repos with one submodule update
 * - Consistent filtering across New-Grad, Internships, and SEO repos
 *
 * Migration: 2026-02-11
 * - Moved isUSOnlyJob() fix (default to ALLOW empty locations)
 * - Moved getExperienceLevel() fix (default to Entry-Level)
 * - All other utility functions migrated
 */

const fs = require('fs');
const path = require('path');

// Import shared utilities library
const sharedUtils = require('../shared/lib/utils');

// Try to load company database (different filenames for different repos)
// Main repos: companies.json
// SEO repos: software.json, data-science.json, hardware.json, etc.
let companies = {};
const possibleFiles = ['companies.json', 'software.json', 'data-science.json', 'hardware.json', 'nursing.json'];

for (const file of possibleFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    companies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    break;
  }
}

// Initialize shared library with this repo's company data (if found and compatible format)
// Main repos use format: {category: [{name, api_names}, ...]}
// SEO repos use format: {category: {title, companies: [names]}}
// Only initialize for Main repo format to avoid errors
if (Object.keys(companies).length > 0) {
  const firstCategory = Object.values(companies)[0];

  // Check if Main repo format (array of company objects)
  if (Array.isArray(firstCategory)) {
    sharedUtils.initCompanyDatabase(companies);
  }
  // SEO repo format - skip company init, just use shared filtering logic
  // Company-specific features won't work, but core filtering (US location, experience level) will
}

// Re-export all shared utilities
module.exports = {
  ...sharedUtils,
  companies
};
