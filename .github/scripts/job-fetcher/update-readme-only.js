#!/usr/bin/env node

/**
 * Update README from existing job data (without fetching new jobs)
 *
 * This script regenerates the README.md from existing job data files.
 * Use this when you want to:
 * - Update banners/images/links in the README template
 * - Test readme-generator.js changes
 * - Regenerate README without running the full job fetcher
 *
 * Usage: node .github/scripts/job-fetcher/update-readme-only.js
 */

const fs = require('fs');
const path = require('path');
const { updateReadme } = require('./readme-generator');
const { companies, ALL_COMPANIES } = require('./utils');

async function main() {
    try {
        console.log('📝 Starting README regeneration from existing data');

        // Paths to data files
        const currentJobsPath = path.join(__dirname, '../../data/current_jobs.json');

        // Check if current_jobs.json exists
        if (!fs.existsSync(currentJobsPath)) {
            console.error('❌ current_jobs.json not found at:', currentJobsPath);
            console.log('💡 Creating empty data file as placeholder');
            fs.mkdirSync(path.dirname(currentJobsPath), { recursive: true });
            fs.writeFileSync(currentJobsPath, '[]', 'utf8');
        }

        // Read existing job data
        console.log('📂 Reading existing job data from:', currentJobsPath);
        const allJobs = JSON.parse(fs.readFileSync(currentJobsPath, 'utf8'));

        console.log(`✅ Jobs loaded: ${allJobs.length}`);

        // Calculate stats
        const stats = {
            totalByCompany: {},
            byLevel: {},
            byLocation: {},
            byCategory: {}
        };

        allJobs.forEach(job => {
            const company = job.employer_name;
            stats.totalByCompany[company] = (stats.totalByCompany[company] || 0) + 1;
        });

        // Update README (without internship data - simplified version)
        console.log('🔄 Generating README.md...');
        await updateReadme(allJobs, [], null, stats);

        console.log('✅ README regenerated successfully');
        console.log(`📊 Jobs processed: ${allJobs.length}`);
        console.log(`🏢 Companies: ${Object.keys(stats.totalByCompany).length}`);

    } catch (error) {
        console.error('❌ Error updating README:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
main();
