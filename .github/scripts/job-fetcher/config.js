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
  descriptionLine1: '🚀 Data science, analytics, and ML jobs for new graduates, updated in real time.',
  descriptionLine2: '',

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
