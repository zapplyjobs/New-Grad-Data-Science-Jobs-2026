#!/usr/bin/env node

/**
 * Main entry point for JSearch-based job fetching system
 *
 * This module orchestrates:
 * 1. Fetching jobs from JSearch API
 * 2. Processing and filtering jobs
 * 3. Generating enhanced README with job listings
 */

const { fetchAllJSearchJobs } = require('./jsearch-fetcher');
const { processJobs } = require('./job-processor');
const { updateReadme } = require('./readme-generator');

async function main() {
    try {
        console.log('🚀 Starting Data Science Jobs fetching system...');
        console.log('═'.repeat(50));

        // Fetch jobs from JSearch API
        const jobs = await fetchAllJSearchJobs();

        if (jobs.length === 0) {
            console.log('⚠️ No jobs fetched from API');
            return;
        }

        // Process jobs (filter, deduplicate, merge)
        const { currentJobs, archivedJobs } = await processJobs(jobs);

        // Generate stats for README
        const stats = {
            totalByCompany: {}
        };
        currentJobs.forEach(job => {
            stats.totalByCompany[job.employer_name] = (stats.totalByCompany[job.employer_name] || 0) + 1;
        });

        // Update README
        await updateReadme(currentJobs, archivedJobs, null, stats);

        // Print summary
        console.log('\n✅ Job fetching completed successfully!');
        console.log('═'.repeat(50));
        console.log(`📊 Final Stats:`);
        console.log(`   • Current jobs: ${currentJobs.length}`);
        console.log(`   • Archived jobs: ${archivedJobs.length}`);
        console.log(`   • Companies: ${Object.keys(stats.totalByCompany).length}`);

    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = { main };
