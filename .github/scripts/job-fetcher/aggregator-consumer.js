#!/usr/bin/env node

/**
 * Aggregator Consumer - Data Science Jobs
 *
 * Thin wrapper around shared aggregator-consumer library.
 * Filters for data science/ML domain jobs only.
 *
 * Architecture:
 * - Uses shared library: ../shared/lib/aggregator-consumer.js
 * - Filters for domains: ['data_science']
 * - Part of centralized aggregator migration (2026-02-15)
 */

const { createAggregatorConsumer } = require('../shared/lib/aggregator-consumer');

/**
 * Fetch data science jobs from aggregator
 * @returns {Promise<Array>} - Array of data science jobs
 */
async function fetchAllJobs() {
  const consumer = createAggregatorConsumer({
    filters: {
      domains: ['data_science']
    },
    verbose: true
  });

  return await consumer.fetchJobs();
}

module.exports = { fetchAllJobs };

// Run if called directly
if (require.main === module) {
  fetchAllJobs()
    .then(jobs => {
      console.log(`\n✅ Fetched ${jobs.length} data science jobs`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}
