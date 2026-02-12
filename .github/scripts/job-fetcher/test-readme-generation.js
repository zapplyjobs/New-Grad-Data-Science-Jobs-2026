#!/usr/bin/env node

/**
 * Test script to validate config system and README generation
 * Creates mock job data to test template rendering and config integration
 */

const { updateReadme } = require('./readme-generator');
const { fetchInternshipData } = require('./utils');

async function test() {
    console.log('🧪 Testing README generation with mock data...\n');

    // Mock current jobs (50 jobs from 20 companies)
    const currentJobs = [];
    const companies = [
        'Tesla', 'NVIDIA', 'Raytheon', 'Chewy', 'CACI',
        'TD Bank', 'Amazon', 'Google', 'Microsoft', 'Apple',
        'Meta', 'Netflix', 'Spotify', 'Airbnb', 'Uber',
        'Lyft', 'Stripe', 'Square', 'Coinbase', 'Dropbox'
    ];

    for (let i = 0; i < 50; i++) {
        const company = companies[i % companies.length];
        currentJobs.push({
            job_title: `Software Engineer ${i + 1}`,
            employer_name: company,
            employer_website: `https://${company.toLowerCase()}.com`,
            job_apply_link: `https://${company.toLowerCase()}.com/jobs/${i}`,
            job_description: 'Software engineering role for new graduates',
            job_city: i % 3 === 0 ? 'Remote' : i % 3 === 1 ? 'New York, NY' : 'San Francisco, CA',
            job_state: i % 3 === 0 ? '' : i % 3 === 1 ? 'NY' : 'CA',
            job_country: 'US',
            job_posted_at_timestamp: Date.now() - (i * 1000 * 60 * 60), // Hours ago
            job_id: `test-${i}`,
            experience_level: 'entry_level'
        });
    }

    // Mock archived jobs (10 jobs)
    const archivedJobs = [];
    for (let i = 0; i < 10; i++) {
        const company = companies[i % companies.length];
        archivedJobs.push({
            job_title: `Archived Engineer ${i + 1}`,
            employer_name: company,
            employer_website: `https://${company.toLowerCase()}.com`,
            job_apply_link: `https://${company.toLowerCase()}.com/jobs/old-${i}`,
            job_description: 'Older software engineering role',
            job_city: 'Seattle, WA',
            job_state: 'WA',
            job_country: 'US',
            job_posted_at_timestamp: Date.now() - (14 * 24 * 60 * 60 * 1000), // 14 days ago
            job_id: `test-archived-${i}`,
            experience_level: 'entry_level'
        });
    }

    // Fetch internship data
    const internshipData = await fetchInternshipData();

    // Generate stats
    const stats = {
        totalByCompany: {}
    };
    currentJobs.forEach(job => {
        stats.totalByCompany[job.employer_name] = (stats.totalByCompany[job.employer_name] || 0) + 1;
    });

    console.log(`📊 Mock Data Created:`);
    console.log(`   • Current jobs: ${currentJobs.length}`);
    console.log(`   • Archived jobs: ${archivedJobs.length}`);
    console.log(`   • Companies: ${Object.keys(stats.totalByCompany).length}\n`);

    // Update README
    await updateReadme(currentJobs, archivedJobs, internshipData, stats);

    console.log('\n✅ README generation test complete!');
    console.log('   Check README.md to verify:');
    console.log('   1. Template variables replaced ({totalCompanies}, {currentJobs})');
    console.log('   2. Image paths use "sej-" prefix');
    console.log('   3. More Resources section appears');
    console.log('   4. No Internships section');
}

test().catch(error => {
    console.error('\n❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
});
