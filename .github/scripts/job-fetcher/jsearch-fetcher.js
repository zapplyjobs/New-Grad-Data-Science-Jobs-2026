#!/usr/bin/env node

/**
 * JSearch API Fetcher for Data Science Jobs
 * Wrapper for shared JSearch fetcher library (Phase 4.3)
 */

const createJSearchFetcher = require('../shared/lib/jsearch-fetcher');

// Domain-specific search queries for Data Science
const SEARCH_QUERIES = [
    'data scientist',
    'data analyst',
    'data engineer',
    'machine learning engineer',
    'ml engineer',
    'ai engineer',
    'research scientist',
    'business analyst',
    'business intelligence analyst',
    'analytics engineer',
    'statistician',
    'quantitative analyst',
    'data science intern',
    'machine learning intern',
    'ai researcher',
    'applied scientist',
    'research engineer'
];

// Create fetcher instance with domain queries
const fetcher = createJSearchFetcher(
    SEARCH_QUERIES,
    process.env.JSEARCH_API_KEY,
    { maxRequestsPerDay: 30 }
);

module.exports = {
    fetchAllJSearchJobs: fetcher.fetchAllJSearchJobs,
    SEARCH_QUERIES: fetcher.SEARCH_QUERIES
};
