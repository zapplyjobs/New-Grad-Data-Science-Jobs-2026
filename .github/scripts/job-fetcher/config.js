/**
 * New-Grad-Data-Science-Jobs-2026 Configuration
 *
 * Purpose: Per-repo customization for shared job board library
 * Version: 1.0 (2026-02-12)
 *
 * Template Variables:
 * - {totalCompanies} - Replaced with unique company count
 * - {currentJobs} - Replaced with active job count
 */

module.exports = {
  // Schema version
  version: 1,

  // Image configuration
  repoPrefix: 'dsj',
  headingImageAlt: 'Data Science Jobs 2026 - Illustration of people working in data science.',

  // Branding text
  title: 'Data Science Jobs 2026',
  tagline: '',  // No tagline for SEO repos

  // Description paragraphs (with template variables)
  descriptionLine1: '🚀 Real-time data science, analytics, and machine learning jobs from {totalCompanies}+ top companies like Anthropic, Coinbase, and Instacart. Updated every 15 minutes with {currentJobs}+ fresh opportunities for new graduates, data science students, and entry-level data analysts.',
  descriptionLine2: '🎯 Includes roles across tech giants, fast-growing startups, and data-first companies like Anthropic, Coinbase, and Instacart.',

  // Note box
  noteType: 'TIP',
  noteText: '🛠 Help us grow! Add new jobs by submitting an issue! View contributing steps [here](CONTRIBUTING-GUIDE.md).',

  // Section headers
  jobsSectionHeader: 'Fresh Data Science Jobs 2026',

  // Feature flags
  features: {
    internships: false,
    moreResources: true
  },

  // Job categorization
  defaultCategory: 'data_analyst'  // Broadest DS fallback — reduces wrong-section display
};
