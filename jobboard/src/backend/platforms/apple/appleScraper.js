const puppeteer = require('puppeteer');

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  
  // Remove common prefixes and suffixes
  return title
    .replace(/^(Senior|Staff|Principal|Lead|Jr|Junior)\s+/i, '')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .trim();
}

// Helper function to convert date to relative format
function convertToRelativeDate(dateStr) {
  if (!dateStr) return 'Recently';
  
  try {
    // Parse the date format "Apr 02, 2025"
    const jobDate = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - jobDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return '1 day ago';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return years === 1 ? '1 year ago' : `${years} years ago`;
    }
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return 'Recently';
  }
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: 'Unknown', state: 'US' };
  }
  
  // Clean up the location text
  const cleanLocation = locationText.replace(/\s+/g, ' ').trim();
  
  // For Apple, locations are usually just city names like "Austin"
  // We'll assume US locations and try to map common cities to states
  const cityStateMap = {
    'Austin': 'Texas',
    'Cupertino': 'California',
    'San Jose': 'California',
    'Santa Clara': 'California',
    'Seattle': 'Washington',
    'New York': 'New York',
    'Boston': 'Massachusetts',
    'Chicago': 'Illinois',
    'Denver': 'Colorado',
    'Atlanta': 'Georgia',
    'Dallas': 'Texas',
    'Houston': 'Texas',
    'Los Angeles': 'California',
    'San Francisco': 'California',
    'Portland': 'Oregon'
  };
  
  const state = cityStateMap[cleanLocation] || 'US';
  
  return { city: cleanLocation, state: state };
}

async function appleScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for production
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-css', // Disable CSS for faster loading
      '--disable-images', // Disable images for faster loading
      '--disable-javascript', // Keep JS enabled as we need it for dynamic content
      '--disable-plugins',
      '--disable-extensions'
    ]
  });

  const page = await browser.newPage();
  
  // Disable CSS and images for faster loading
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.resourceType() == 'stylesheet' || req.resourceType() == 'image') {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  const allJobs = [];
  const baseUrl = 'https://jobs.apple.com';

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Scraping page ${pageNum}...`);
      
      // Construct URL with search query and pagination
      const searchUrl = `${baseUrl}/en-us/search?search=${encodeURIComponent(searchQuery).replace(/%20/g, '+')}&sort=relevance&location=united-states-USA&page=${pageNum}`;
      
      console.log(`Searching for: "${searchQuery}"`);
      console.log(`Navigating to: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for job listings to load
      try {
        await page.waitForSelector('li', { timeout: 100000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum}, stopping...`);
        break;
      }
      
      // Get all job listing li elements that contain job data
      const jobListItems = await page.$$('li');
      
      if (jobListItems.length === 0) {
        console.log(`No job listings found on page ${pageNum}, stopping...`);
        break;
      }
      
      console.log(`Found ${jobListItems.length} jobs on page ${pageNum}`);
      
      // Extract job data from each li element
      for (const jobItem of jobListItems) {
        try {
          const jobData = await jobItem.evaluate((item) => {
            // Extract title and link
            const titleLinkElement = item.querySelector('h3 a.link-inline');
            const title = titleLinkElement ? titleLinkElement.textContent.trim() : '';
            const relativeLink = titleLinkElement ? titleLinkElement.getAttribute('href') : '';
            
            // Extract location - look for span with id containing "search-store-name-container"
            const locationElement = item.querySelector('span[id*="search-store-name-container"]');
            const location = locationElement ? locationElement.textContent.trim() : '';
            
            // Extract posted date - look for span with class "job-posted-date"
            const postedElement = item.querySelector('span.job-posted-date');
            const posted = postedElement ? postedElement.textContent.trim() : '';
            
            return {
              title,
              relativeLink,
              location,
              posted
            };
          });
          
          // Skip if no title found
          if (!jobData.title) continue;
          
          // Parse location
          const { city, state } = parseLocation(jobData.location);
          
          // Construct full apply link
          const applyLink = jobData.relativeLink ? `${baseUrl}${jobData.relativeLink}` : '';
          
          // Convert posted date to relative format
          const relativePostedDate = convertToRelativeDate(jobData.posted);
          
          // Format the job data
          const formattedJob = {
            employer_name: "Apple",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: relativePostedDate,
            job_description: `${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
            job_apply_link: applyLink
          };
          
          allJobs.push(formattedJob);
          
          console.log(`✓ Scraped: ${jobData.title} at ${jobData.location} (${relativePostedDate})`);
          
        } catch (error) {
          console.error('Error extracting job data from item:', error);
          continue;
        }
      }
      
      // Add delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
  
  console.log(`\nScraping completed! Found ${allJobs.length} total jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  try {
    // Get search query from command line arguments
    const searchQuery = process.argv.slice(2).join(' ');
    
    if (!searchQuery) {
      console.log('Please provide a search query!');
      console.log('Usage: node appleScraper.js hardware engineering');
      console.log('Usage: node appleScraper.js software engineer');
      console.log('Usage: node appleScraper.js data science');
      console.log('Or with quotes: node appleScraper.js "machine learning"');
      return;
    }
    
    console.log(`=== Scraping Apple Careers for: "${searchQuery}" ===`);
    const jobs = await appleScraper(searchQuery, 10);
    console.log(`\n🎉 APPLE Scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`);
    
    // Display all scraped jobs
    if (jobs.length > 0) {
      console.log('\n📋 All Scraped Jobs:');
      console.log('='.repeat(80));
      
      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_title}`);
        console.log(`   Company: ${job.employer_name}`);
        console.log(`   Location: ${job.job_city}, ${job.job_state}`);
        console.log(`   Posted: ${job.job_posted_at}`);
        console.log(`   Apply: ${job.job_apply_link}`);
        console.log(`   Description: ${job.job_description.substring(0, 100)}...`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log(`📊 Summary: ${jobs.length} jobs found`);
      
      // Also show JSON format for first 2 jobs
      console.log('\n🔧 JSON Format (first 2 jobs):');
      console.log(JSON.stringify(jobs.slice(0, 2), null, 2));
    } else {
      console.log('❌ No jobs found for the search query.');
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Export the scraper function
module.exports = appleScraper;

// Run if this file is executed directly
if (require.main === module) {
  main();
}