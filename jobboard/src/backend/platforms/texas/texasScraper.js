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
  
  // Clean up the location text and parse different formats
  const cleanLocation = locationText.replace(/,?\s*United States$/i, '').trim();
  
  if (!cleanLocation) {
    return { city: '', state: 'United States' };
  }
  
  // Split by comma and trim
  const parts = cleanLocation.split(',').map(part => part.trim());
  
  if (parts.length >= 2) {
    // Format: "Dallas, TX" or "City, State"
    return {
      city: parts[0],
      state: parts[1]
    };
  } else if (parts.length === 1) {
    // Could be just a state or just a city
    const singlePart = parts[0];
    
    // Common US state abbreviations
    const stateAbbreviations = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];
    
    if (stateAbbreviations.includes(singlePart.toUpperCase())) {
      return { city: '', state: singlePart.toUpperCase() };
    } else {
      return { city: singlePart, state: '' };
    }
  }
  
  return { city: '', state: '' };
}

// Helper function to convert date to relative format
function convertDateToRelative(dateStr) {
  if (!dateStr || dateStr.trim() === '') return 'Recently';
  
  try {
    // Handle different date formats
    let jobDate;
    
    // Check if it's already in relative format (like "4 days ago")
    if (dateStr.toLowerCase().includes('ago') || dateStr.toLowerCase().includes('today') || dateStr.toLowerCase().includes('yesterday')) {
      return dateStr;
    }
    
    // Try to parse MM/DD/YYYY format
    if (dateStr.includes('/')) {
      const dateParts = dateStr.split('/');
      if (dateParts.length === 3) {
        const month = parseInt(dateParts[0]);
        const day = parseInt(dateParts[1]);
        const year = parseInt(dateParts[2]);
        
        // Validate the parsed values
        if (isNaN(month) || isNaN(day) || isNaN(year) || 
            month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) {
          return 'Recently';
        }
        
        jobDate = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        return 'Recently';
      }
    } else {
      // Try other date formats or return default
      return 'Recently';
    }
    
    // Validate the created date
    if (isNaN(jobDate.getTime())) {
      return 'Recently';
    }
    
    const today = new Date();
    
    // Calculate difference in days
    const timeDiff = today.getTime() - jobDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    
    // Handle invalid calculations
    if (isNaN(daysDiff)) {
      return 'Recently';
    }
    
    if (daysDiff === 0) {
      return 'Today';
    } else if (daysDiff === 1) {
      return '1 day ago';
    } else if (daysDiff > 0 && daysDiff < 30) {
      return `${daysDiff} days ago`;
    } else if (daysDiff >= 30 && daysDiff < 365) {
      const months = Math.floor(daysDiff / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    } else if (daysDiff >= 365) {
      const years = Math.floor(daysDiff / 365);
      return years === 1 ? '1 year ago' : `${years} years ago`;
    } else {
      // Handle negative days (future dates)
      return 'Recently';
    }
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return 'Recently'; // Return default instead of original string
  }
}

async function texasScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  const allJobs = [];
  const baseUrl = 'https://careers.ti.com';
  
  try {
    // Construct URL with search query (no pagination)
    const searchUrl = `${baseUrl}/en/sites/CX/jobs?keyword=${encodeURIComponent(searchQuery)}&location=United+States&locationId=300000000361862&locationLevel=country&mode=location`;
    
    console.log(`Searching for: "${searchQuery}"`);
    console.log(`Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for job listings to load
    try {
      await page.waitForSelector('li', { timeout: 10000 });
    } catch (error) {
      console.log('No jobs found, stopping...');
      return allJobs;
    }
    
    console.log(`Starting infinite scroll for ${maxPages} scrolls...`);
    
    // Perform infinite scroll to load more jobs
    for (let scrollNum = 1; scrollNum <= maxPages; scrollNum++) {
      console.log(`Scroll ${scrollNum}/${maxPages}...`);
      
      // Get current job count before scrolling
      const jobCountBefore = await page.evaluate(() => {
        const jobItems = document.querySelectorAll('li span.job-tile__title');
        return jobItems.length;
      });
      
      // Scroll to bottom of page
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new content to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if more jobs loaded
      const jobCountAfter = await page.evaluate(() => {
        const jobItems = document.querySelectorAll('li span.job-tile__title');
        return jobItems.length;
      });
      
      if (jobCountAfter === jobCountBefore) {
        console.log(`No new jobs loaded after scroll ${scrollNum}, reached end of listings. Stopping scroll.`);
        break; // Exit the scroll loop early
      } else {
        console.log(`Loaded ${jobCountAfter - jobCountBefore} new jobs after scroll ${scrollNum}`);
      }
      
      // Add delay between scrolls to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('Finished scrolling, now extracting all job data...');
    
    // Extract all job data at once after scrolling
    const allJobData = await page.evaluate(() => {
      const jobItems = document.querySelectorAll('li');
      const jobs = [];
      
      jobItems.forEach(item => {
        // Check if this li contains job data
        const titleElement = item.querySelector('span.job-tile__title');
        if (!titleElement) return;
        
        // Extract title
        const title = titleElement.textContent.trim();
        
        // Extract apply link
        const linkElement = item.querySelector('a');
        const relativeLink = linkElement ? linkElement.getAttribute('href') : '';
        
        // Extract location - look for span elements that might contain location
        const locationSpans = item.querySelectorAll('span');
        let location = '';
        for (const span of locationSpans) {
          const text = span.textContent.trim();
          // Look for location patterns (skip the title span)
          if (span !== titleElement && 
              (text.includes(',') || text.toLowerCase().includes('united states') || 
               text.match(/[A-Z]{2}/) || text.includes('TX') || text.includes('Dallas'))) {
            location = text;
            break;
          }
        }
        
        // Extract posted date
        const postedElement = item.querySelector('div.job-list-item__job-info-value');
        const posted = postedElement ? postedElement.textContent.trim() : '';
        
        jobs.push({
          title,
          relativeLink,
          location,
          posted
        });
      });
      
      return jobs;
    });
    
    console.log(`Extracted ${allJobData.length} total job listings`);
    
    // Process and format all the jobs
    for (const jobData of allJobData) {
      try {
        // Parse location
        const { city, state } = parseLocation(jobData.location);
        
        // Construct full apply link
        const applyLink = jobData.relativeLink ? 
          (jobData.relativeLink.startsWith('http') ? jobData.relativeLink : `${baseUrl}${jobData.relativeLink}`) 
          : '';
        
        // Format the job data
        const formattedJob = {
          employer_name: "TEXAS INSTRUMENTS",
          job_title: cleanJobTitle(jobData.title),
          job_city: city,
          job_state: state,
          job_posted_at: convertDateToRelative(jobData.posted),
            job_description:`${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
          job_apply_link: applyLink
        };
        
        allJobs.push(formattedJob);
        console.log(`✓ Formatted: ${jobData.title} at ${jobData.location}`);
        
      } catch (error) {
        console.error('Error formatting job data:', error);
        continue;
      }
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

// Export the scraper function
module.exports = texasScraper;

// Run if this file is executed directly
