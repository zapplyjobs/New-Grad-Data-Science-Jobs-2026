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

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText || locationText.toLowerCase().includes('multiple')) {
    return { city: 'Multiple', state: 'Locations' };
  }
  
  // Try to parse "City, State" format
  const parts = locationText.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1] };
  }
  
  return { city: locationText, state: 'US' };
}

async function armScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  const allJobs = [];
  const baseUrl = 'https://careers.arm.com';
  
  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Scraping page ${pageNum}...`);
      
      // Construct URL with search query and page number
      const searchUrl = `${baseUrl}/search-jobs/${encodeURIComponent(searchQuery)}/United%20States?orgIds=33099&kt=1&alp=6252001&alt=2&p=${pageNum}`;
      
      console.log(`Searching for: "${searchQuery}"`);
      console.log(`Navigating to: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for job cards to load
      try {
        await page.waitForSelector('li.job-card.fs-start.fs-middle.fs-container.custom-row-gap-1', { timeout: 10000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum}, stopping...`);
        break;
      }
      
      // Get all job cards
      const jobCards = await page.$$('li.job-card.fs-start.fs-middle.fs-container.custom-row-gap-1');
      
      if (jobCards.length === 0) {
        console.log(`No job cards found on page ${pageNum}, stopping...`);
        break;
      }
      
      console.log(`Found ${jobCards.length} jobs on page ${pageNum}`);
      
      // Extract job data from each card
      for (const jobCard of jobCards) {
        try {
          const jobData = await jobCard.evaluate((card) => {
            // Extract title and link
            const titleElement = card.querySelector('a.job-card__title.fs-11.fs-m-11');
            const title = titleElement ? titleElement.textContent.trim() : '';
            const relativeLink = titleElement ? titleElement.getAttribute('href') : '';
            
            // Extract description
            const descElement = card.querySelector('span.job-card__intro');
            const description = descElement ? descElement.textContent.trim() : '';
            
            // Extract location
            const locationElement = card.querySelector('span.location');
            const location = locationElement ? locationElement.textContent.trim() : '';
            
            // Extract category
            const categoryElement = card.querySelector('span.category');
            const category = categoryElement ? categoryElement.textContent.trim() : '';
            
            return {
              title,
              relativeLink,
              description,
              location,
              category
            };
          });
          
          // Skip if no title found
          if (!jobData.title) continue;
          
          // Parse location
          const { city, state } = parseLocation(jobData.location);
          
          // Construct full apply link
          const applyLink = jobData.relativeLink ? `${baseUrl}${jobData.relativeLink}` : '';
          
          // Format the job data
          const formattedJob = {
            employer_name: "Arm",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: 'Recently', // ARM doesn't show posting date on listing page
            job_description:`${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
            job_apply_link: applyLink
          };
          
          allJobs.push(formattedJob);
          
        } catch (error) {
          console.error('Error extracting job data from card:', error);
          continue;
        }
      }
      
      // Add delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 5000));
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
    // If multiple arguments, join them with spaces
    const searchQuery = process.argv.slice(2).join(' ');
    
    if (!searchQuery) {
      console.log('Please provide a search query!');
      console.log('Usage: node armScraper.js data science');
      console.log('Usage: node armScraper.js hardware engineering');
      console.log('Usage: node armScraper.js software');
      console.log('Or with quotes: node armScraper.js "data science"');
      return;
    }
    
    console.log(`=== Scraping ARM careers for: "${searchQuery}" ===`);
    const jobs = await armScraper(searchQuery, 10);
    console.log(`\nFound ${jobs.length} jobs for "${searchQuery}"`);
    
    // Show first few jobs as example
    if (jobs.length > 0) {
      console.log('\nFirst 3 jobs:');
      console.log(JSON.stringify(jobs.slice(0, 3), null, 2));
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Export the scraper function
module.exports =  armScraper ;

// Run if this file is executed directly
if (require.main === module) {
  main();
}