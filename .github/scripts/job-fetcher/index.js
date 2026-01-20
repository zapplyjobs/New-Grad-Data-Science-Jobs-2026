#!/usr/bin/env node

/**
 * Main entry point for README generator (scraping disabled)
 *
 * This module reads existing job data and regenerates the README.
 * Scraping functionality has been removed - data must be updated manually.
 *
 * To restore scraping: See Job_Listings/scraper-code-backup/Hardware/
 */

const fs = require('fs');
const path = require('path');
const { generateReadme } = require('./readme-generator');
const { companies } = require('./utils');

// Read existing job data from JSON files
function readExistingJobData() {
    const dataDir = path.join(__dirname, '../../../data');

    try {
        // Read new_jobs.json (current jobs)
        const newJobsPath = path.join(dataDir, 'new_jobs.json');
        const currentJobs = fs.existsSync(newJobsPath)
            ? JSON.parse(fs.readFileSync(newJobsPath, 'utf8'))
            : [];

        // Read seen_jobs.json (all jobs including archived)
        const seenJobsPath = path.join(dataDir, 'seen_jobs.json');
        const allJobs = fs.existsSync(seenJobsPath)
            ? JSON.parse(fs.readFileSync(seenJobsPath, 'utf8'))
            : [];

        // Separate current vs archived based on age (7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const archivedJobs = allJobs.filter(job => {
            const jobDate = new Date(job.job_posted_at || job.date_added);
            return jobDate.getTime() < sevenDaysAgo;
        });

        // Calculate stats
        const companyCounts = {};
        currentJobs.forEach(job => {
            companyCounts[job.employer_name] = (companyCounts[job.employer_name] || 0) + 1;
        });

        const stats = {
            totalByCompany: companyCounts,
            faangCount: currentJobs.filter(job =>
                companies.faang_plus.some(c => c.name === job.employer_name)
            ).length
        };

        return { currentJobs, archivedJobs, stats };
    } catch (error) {
        console.error('❌ Error reading job data:', error.message);
        console.log('ℹ️ Using empty job data - README will show "No current openings"');
        return {
            currentJobs: [],
            archivedJobs: [],
            stats: { totalByCompany: {}, faangCount: 0 }
        };
    }
}

// Main execution function
async function main() {
    try {
        console.log('🚀 Starting README regeneration...');
        console.log('═'.repeat(50));
        console.log('⚠️ NOTE: Scraping disabled - using existing job data');
        console.log('');

        // Read existing job data (no scraping)
        const { currentJobs, archivedJobs, stats } = readExistingJobData();

        // Update README with current job state
        await generateReadme(currentJobs, archivedJobs, null, stats);

        // Print summary
        console.log('\n✅ README regenerated successfully!');
        console.log('═'.repeat(50));
        console.log(`📊 Stats:`);
        console.log(`   • Current jobs: ${currentJobs.length}`);
        console.log(`   • Archived jobs: ${archivedJobs.length}`);
        console.log(`   • Companies: ${Object.keys(stats.totalByCompany).length}`);
        console.log(`   • FAANG+ jobs: ${stats.faangCount}`);
        console.log('');
        console.log('💡 To update job data, manually edit files in .github/data/');
        console.log('💡 To restore scraping, see Job_Listings/scraper-code-backup/Hardware/');

        // Force exit after completion
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal error regenerating README:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = { main };
