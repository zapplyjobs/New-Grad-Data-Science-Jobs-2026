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
const { fetchInternshipData, companies, ALL_COMPANIES } = require('./utils');

async function main() {
    try {
        console.log('🔄 Updating README from existing job data...');
        console.log('═'.repeat(50));

        // Paths to data files
        const newJobsPath = path.join(__dirname, '../data/new_jobs.json');
        const postedJobsPath = path.join(__dirname, '../data/posted_jobs.json');

        // Check if new_jobs.json exists
        if (!fs.existsSync(newJobsPath)) {
            console.error('❌ Error: new_jobs.json not found!');
            console.error(`   Expected location: ${newJobsPath}`);
            console.error('   Please run the full job fetcher first to populate job data.');
            console.error('');
            console.error('💡 Creating empty data file as placeholder...');
            fs.mkdirSync(path.dirname(newJobsPath), { recursive: true });
            fs.writeFileSync(newJobsPath, '[]', 'utf8');
            console.log('   ✅ Created empty new_jobs.json');
        }

        // Read existing job data
        console.log('📂 Reading existing job data...');
        const allJobs = JSON.parse(fs.readFileSync(newJobsPath, 'utf8'));

        // Filter jobs by age (7 days for current, older for archived)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const currentJobs = [];
        const archivedJobs = [];

        allJobs.forEach(job => {
            const jobDate = new Date(job.job_posted_at || job.job_posted_at_datetime_utc);
            if (isNaN(jobDate.getTime()) || jobDate >= oneWeekAgo) {
                currentJobs.push(job);
            } else {
                archivedJobs.push(job);
            }
        });

        console.log(`📊 Found ${allJobs.length} total jobs:`);
        console.log(`   • Current (≤7 days): ${currentJobs.length}`);
        console.log(`   • Archived (>7 days): ${archivedJobs.length}`);

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

        // Fetch internship data (optional, for resources section)
        let internshipData = null;
        try {
            internshipData = await fetchInternshipData();
        } catch (err) {
            console.log('⚠️  Could not fetch internship data (continuing without it)');
        }

        // Update README
        console.log('📝 Generating README.md...');
        await updateReadme(currentJobs, archivedJobs, internshipData, stats);

        console.log('\n✅ README.md updated successfully!');
        console.log('═'.repeat(50));
        console.log('📋 Summary:');
        console.log(`   • Jobs displayed: ${currentJobs.length}`);
        console.log(`   • Companies: ${Object.keys(stats.totalByCompany).length}`);
        console.log('\n💡 Tip: Commit and push the updated README.md to share changes');

    } catch (error) {
        console.error('\n❌ Error updating README:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
main();
