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
  if (!locationText) {
    return { city: 'Unknown', state: 'US' };
  }
  
  // Clean up the location text and parse "Boise, Idaho, United States of America" format
  const cleanLocation = locationText.replace(/\s+/g, ' ').trim();
  const parts = cleanLocation.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    // Format: "Boise, Idaho, United States of America" or "City, State"
    return { 
      city: parts[0], 
      state: parts[1].replace(', United States of America', '').trim()
    };
  } else {
    // Single location
    return { city: parts[0], state: 'US' };
  }
}

async function micronScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  const allJobs = [];
  const baseUrl = 'https://careers.micron.com';
  var startParam = 0;
  try {
    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      console.log(`Scraping page ${pageNum + 1}...`);
      
      // Calculate start parameter (0, 10, 20, 30, etc.)
      
      
      // Construct URL with search query and pagination
      const searchUrl = `${baseUrl}/careers?query=${encodeURIComponent(searchQuery).replace(/%20/g, '+')}&start=${startParam}&location=united+states&sort_by=solr&filter_include_remote=1`;
      
      startParam += 10; // Increment for next page
      console.log(`Searching for: "${searchQuery}"`);
      console.log(`Navigating to: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for job cards to load
      try {
        await page.waitForSelector('div.cardContainer-GcY1a', { timeout: 10000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum + 1}, stopping...`);
        break;
      }
      
      // Get all job cards
      const jobCards = await page.$$('div.cardContainer-GcY1a');
      
      if (jobCards.length === 0) {
        console.log(`No job cards found on page ${pageNum + 1}, stopping...`);
        break;
      }
      
      console.log(`Found ${jobCards.length} jobs on page ${pageNum + 1}`);
      
      // Extract job data from each card
      for (const jobCard of jobCards) {
        try {
          const jobData = await jobCard.evaluate((card) => {
            // Extract title
            const titleElement = card.querySelector('div.title-1aNJK');
            const title = titleElement ? titleElement.textContent.trim() : '';
            
            // Extract apply link - look for the a tag with the specific pattern
            const linkElement = card.querySelector('a[id*="job-card-"][id*="-job-list"]');
            const relativeLink = linkElement ? linkElement.getAttribute('href') : '';
            
            // Extract location
            const locationElement = card.querySelector('div.fieldValue-3kEar');
            const location = locationElement ? locationElement.textContent.trim() : '';
            
            // Extract posted date
            const postedElement = card.querySelector('div.subData-13Lm1');
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
          
          // Format the job data
          const formattedJob = {
            employer_name: "Micron",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: jobData.posted || 'Recently',
            job_description:`${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
            job_apply_link: applyLink
          };
          
          allJobs.push(formattedJob);
          
          console.log(`✓ Scraped: ${jobData.title} at ${jobData.location}`);
          
        } catch (error) {
          console.error('Error extracting job data from card:', error);
          continue;
        }
      }
      
      // Add delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 3000));
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
      console.log('Usage: node micronScraper.js data science');
      console.log('Usage: node micronScraper.js hardware engineering');
      console.log('Usage: node micronScraper.js software');
      console.log('Or with quotes: node micronScraper.js "machine learning"');
      return;
    }
    
    console.log(`=== Scraping Micron Careers for: "${searchQuery}" ===`);
    const jobs = await micronScraper(searchQuery, 10);
    console.log(`\n🎉 Scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`);
    
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
module.exports =  micronScraper ;

// Run if this file is executed directly
if (require.main === module) {
  main();
}