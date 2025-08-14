const puppeteer = require('puppeteer');

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  return title
    .replace(/^(Senior|Staff|Principal|Lead|Jr|Junior)\s+/i, '')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .trim();
}

// Helper function to parse location and filter US jobs
function parseLocation(locationText) {
  if (!locationText || locationText.toLowerCase().includes('multiple')) {
    return { city: 'Multiple', state: 'Locations', country: 'US', isUS: true };
  }
  
  // Clean up the location text
  locationText = locationText.replace(/\s+/g, ' ').trim();
  
  const parts = locationText.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    const city = parts[0];
    const stateOrCountry = parts[1];
    
    // Check if it's a US state or US location
    const usStates = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'MI', 'GA', 'NC', 'NJ', 'VA', 'WA', 'MA', 'IN', 'AZ', 'TN', 'MO', 'MD', 'WI', 'MN', 'CO', 'AL', 'SC', 'LA', 'KY', 'OR', 'OK', 'CT', 'IA', 'MS', 'AR', 'KS', 'UT', 'NV', 'NM', 'WV', 'NE', 'ID', 'HI', 'NH', 'ME', 'RI', 'MT', 'DE', 'SD', 'ND', 'AK', 'VT', 'WY', 'DC'];
    const usStateFull = ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Michigan', 'Georgia', 'North Carolina', 'New Jersey', 'Virginia', 'Washington', 'Massachusetts', 'Indiana', 'Arizona', 'Tennessee', 'Missouri', 'Maryland', 'Wisconsin', 'Minnesota', 'Colorado', 'Alabama', 'South Carolina', 'Louisiana', 'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Iowa', 'Mississippi', 'Arkansas', 'Kansas', 'Utah', 'Nevada', 'New Mexico', 'West Virginia', 'Nebraska', 'Idaho', 'Hawaii', 'New Hampshire', 'Maine', 'Rhode Island', 'Montana', 'Delaware', 'South Dakota', 'North Dakota', 'Alaska', 'Vermont', 'Wyoming'];
    
    if (usStates.includes(stateOrCountry) || usStateFull.includes(stateOrCountry) || 
        stateOrCountry.toLowerCase().includes('us') || stateOrCountry.toLowerCase().includes('usa') ||
        stateOrCountry.toLowerCase().includes('united states') ||
        stateOrCountry.toLowerCase().includes('california') || stateOrCountry.toLowerCase().includes('hq')) {
      return { city, state: stateOrCountry, country: 'US', isUS: true };
    }
  }
  
  // Check for US indicators in the location text
  const locationLower = locationText.toLowerCase();
  if (locationLower.includes('usa') || locationLower.includes('united states') || 
      locationLower.includes('california') || locationLower.includes('pleasanton') ||
      locationLower.includes('remote') || locationLower.includes('hq')) {
    return { city: locationText, state: 'US', country: 'US', isUS: true };
  }
  
  return { city: locationText, state: 'International', country: 'Other', isUS: false };
}

async function genomicsScraper(searchQuery, maxPages = 10, usOnly = true) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  const allJobs = [];

  try {
    console.log(`Scraping 10x Genomics careers for: "${searchQuery}"`);
    if (usOnly) {
      console.log('Filtering for US jobs only');
    }

    // Try different URL patterns based on the screenshot
    const baseUrls = [
      // Pattern from screenshot
      `https://careers.10xgenomics.com/careers?query=${encodeURIComponent(searchQuery)}&location=united+states&sort_by=solr&filter_include_remote=1`,
      // Alternative patterns
      `https://careers.10xgenomics.com/careers?query=${encodeURIComponent(searchQuery.replace(/ /g, '+'))}&start=0`,
      `https://careers.10xgenomics.com/careers?search=${encodeURIComponent(searchQuery)}&location=us`,
      `https://careers.10xgenomics.com/careers?start=0&search=${encodeURIComponent(searchQuery)}`
    ];

    let foundJobs = false;
    
    for (let urlIndex = 0; urlIndex < baseUrls.length && !foundJobs; urlIndex++) {
      const baseUrl = baseUrls[urlIndex];
      console.log(`\nTrying URL pattern ${urlIndex + 1}: ${baseUrl}`);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if we're on the right page and if there are jobs
        const pageInfo = await page.evaluate(() => {
          const text = document.body.textContent;
          return {
            hasJobsText: text.includes('jobs') || text.includes('positions'),
            hasDataText: text.toLowerCase().includes('data'),
            jobCount: text.match(/(\d+)\s+jobs?/i)?.[1] || '0',
            title: document.title,
            url: window.location.href
          };
        });

        console.log('Page info:', pageInfo);

        if (pageInfo.hasJobsText && pageInfo.hasDataText) {
          console.log(`Found ${pageInfo.jobCount} jobs on page`);
          
          // Try multiple selectors for job listings
          const possibleSelectors = [
            // Based on typical job board structures
            '.job-card',
            '.job-item',
            '.job-listing',
            '.opening',
            '.position',
            '.career-item',
            'div[role="listitem"]',
            'li[data-testid]',
            '[data-cy="job"]',
            '.search-result',
            '.result-item',
            // Generic selectors
            'article',
            'div[class*="job"]',
            'div[class*="position"]',
            'div[class*="opening"]',
            // Link-based selectors
            'a[href*="job"]',
            'a[href*="position"]',
            'a[href*="career"]'
          ];

          let jobElements = [];
          let workingSelector = null;

          for (const selector of possibleSelectors) {
            try {
              const elements = await page.$$(selector);
              if (elements.length > 0) {
                console.log(`Found ${elements.length} elements with selector: ${selector}`);
                
                // Test if these elements contain job-like content
                const sampleContent = await elements[0].evaluate(el => el.textContent.toLowerCase());
                if (sampleContent.includes('data') || sampleContent.includes('engineer') || 
                    sampleContent.includes('analyst') || sampleContent.includes('scientist') ||
                    sampleContent.includes('director') || sampleContent.includes('manager')) {
                  jobElements = elements;
                  workingSelector = selector;
                  console.log(`Using selector: ${selector}`);
                  foundJobs = true;
                  break;
                }
              }
            } catch (err) {
              // Continue to next selector
            }
          }

          if (jobElements.length === 0) {
            console.log('No job elements found with standard selectors, trying content extraction...');
            
            // Extract job information directly from page content
            const jobsFromContent = await page.evaluate((searchTerm) => {
              const jobs = [];
              
              // Look for job titles and links
              const allElements = document.querySelectorAll('*');
              
              allElements.forEach(el => {
                const text = el.textContent?.trim();
                const children = el.children.length;
                
                // Look for elements that might be job titles (short text, contains relevant keywords)
                if (text && text.length > 5 && text.length < 100 && children < 5) {
                  if (text.toLowerCase().includes('data') || 
                      text.toLowerCase().includes('engineer') ||
                      text.toLowerCase().includes('analyst') ||
                      text.toLowerCase().includes('scientist') ||
                      text.toLowerCase().includes('director') ||
                      text.toLowerCase().includes('manager')) {
                    
                    // Look for associated link
                    const link = el.querySelector('a') || el.closest('a');
                    const href = link?.href || '';
                    
                    // Look for location information in nearby elements
                    let location = '';
                    let parent = el.parentElement;
                    for (let i = 0; i < 3 && parent; i++) {
                      const parentText = parent.textContent;
                      if (parentText.toLowerCase().includes('california') || 
                          parentText.toLowerCase().includes('pleasanton') ||
                          parentText.toLowerCase().includes('usa') ||
                          parentText.toLowerCase().includes('remote')) {
                        const lines = parentText.split('\n').filter(l => l.trim());
                        location = lines.find(l => 
                          l.toLowerCase().includes('california') || 
                          l.toLowerCase().includes('pleasanton') ||
                          l.toLowerCase().includes('usa') ||
                          l.toLowerCase().includes('remote')
                        ) || '';
                        break;
                      }
                      parent = parent.parentElement;
                    }
                    
                    jobs.push({
                      title: text,
                      href: href,
                      location: location
                    });
                  }
                }
              });
              
              // Remove duplicates
              const unique = [];
              const seen = new Set();
              
              jobs.forEach(job => {
                const key = job.title.toLowerCase();
                if (!seen.has(key) && job.title.length > 10) {
                  seen.add(key);
                  unique.push(job);
                }
              });
              
              return unique.slice(0, 20); // Limit to reasonable number
            }, searchQuery);

            console.log(`Found ${jobsFromContent.length} jobs from content extraction`);
            
            if (jobsFromContent.length > 0) {
              jobElements = jobsFromContent;
              workingSelector = 'content-extraction';
              foundJobs = true;
            }
          }

          if (foundJobs && jobElements.length > 0) {
            console.log(`Processing ${jobElements.length} job elements...`);

            // Process job elements
            for (let i = 0; i < Math.min(jobElements.length, 30); i++) {
              try {
                let jobData;
                
                if (workingSelector === 'content-extraction') {
                  // Jobs already extracted from content
                  jobData = jobElements[i];
                } else {
                  // Extract from DOM elements
                  jobData = await jobElements[i].evaluate(el => {
                    // Try to find job title
                    const titleSelectors = ['a', 'h1', 'h2', 'h3', 'h4', '.title', '.job-title'];
                    let title = '';
                    let href = '';
                    
                    for (const selector of titleSelectors) {
                      const titleEl = el.querySelector(selector);
                      if (titleEl && titleEl.textContent.trim()) {
                        title = titleEl.textContent.trim();
                        href = titleEl.href || titleEl.closest('a')?.href || '';
                        break;
                      }
                    }
                    
                    if (!title) {
                      title = el.textContent.trim().split('\n')[0]; // First line as title
                    }
                    
                    // Look for location in the element
                    const fullText = el.textContent;
                    let location = '';
                    
                    if (fullText.toLowerCase().includes('california') || 
                        fullText.toLowerCase().includes('pleasanton') ||
                        fullText.toLowerCase().includes('usa') ||
                        fullText.toLowerCase().includes('remote')) {
                      const lines = fullText.split('\n').filter(l => l.trim());
                      location = lines.find(l => 
                        l.toLowerCase().includes('california') || 
                        l.toLowerCase().includes('pleasanton') ||
                        l.toLowerCase().includes('usa') ||
                        l.toLowerCase().includes('remote')
                      ) || '';
                    }
                    
                    return { title, href, location };
                  });
                }

                if (!jobData || !jobData.title || jobData.title.length < 5) continue;

                // Parse location and check if it's US
                let location = jobData.location || 'Pleasanton, California, USA';
                const { city, state, country, isUS } = parseLocation(location);

                // Filter for US jobs if requested
                if (usOnly && !isUS) {
                  console.log(`  Skipping non-US job: ${jobData.title} (${location})`);
                  continue;
                }

                const finalJobData = {
                  employer_name: "10x Genomics",
                  job_title: cleanJobTitle(jobData.title),
                  job_city: city,
                  job_state: state,
                  job_posted_at: 'Recently',
                  job_description: `${searchQuery} position at 10x Genomics - ${jobData.title}`,
                  job_apply_link: jobData.href.startsWith('http') ? jobData.href : 
                                  jobData.href.startsWith('/') ? `https://careers.10xgenomics.com${jobData.href}` :
                                  `https://careers.10xgenomics.com/careers/${jobData.href}`
                };

                allJobs.push(finalJobData);
                console.log(`  ✓ Added: ${jobData.title} - ${city}, ${state}`);

              } catch (err) {
                console.error(`Error processing job element ${i}:`, err.message);
              }
            }
          }
        }

      } catch (err) {
        console.error(`Error with URL pattern ${urlIndex + 1}:`, err.message);
        continue;
      }
    }

    if (!foundJobs) {
      console.log('\nNo jobs found with any URL pattern. Analyzing page structure...');
      
      const finalAnalysis = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          bodyText: document.body.textContent.substring(0, 500),
          linkCount: document.querySelectorAll('a').length,
          hasJobText: document.body.textContent.toLowerCase().includes('job'),
          hasDataText: document.body.textContent.toLowerCase().includes('data'),
          allJobLinks: Array.from(document.querySelectorAll('a')).filter(a => 
            a.textContent.toLowerCase().includes('data') ||
            a.textContent.toLowerCase().includes('engineer') ||
            a.textContent.toLowerCase().includes('scientist')
          ).map(a => ({
            text: a.textContent.trim(),
            href: a.href
          })).slice(0, 10)
        };
      });
      
      console.log('Final page analysis:', JSON.stringify(finalAnalysis, null, 2));
    }

  } catch (err) {
    console.error('Error during scraping:', err);
  } finally {
    await browser.close();
  }

  console.log(`\nScraping completed! Found ${allJobs.length} ${usOnly ? 'US ' : ''}jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  const args = process.argv.slice(2);
  const searchQuery = args.filter(arg => !arg.startsWith('--')).join(' ') || 'Data Science';
  const usOnly = !args.includes('--all-locations'); // Default to US only
  
  console.log(`=== Scraping 10x Genomics careers for: "${searchQuery}" ===`);
  const jobs = await genomicsScraper(searchQuery, 10, usOnly);
  
  console.log(`\nFinal result: Found ${jobs.length} ${usOnly ? 'US ' : ''}jobs for "${searchQuery}"`);
  
  if (jobs.length > 0) {
    console.log('\nJobs found:');
    jobs.forEach((job, index) => {
      console.log(`\n${index + 1}. ${job.job_title}`);
      console.log(`   Location: ${job.job_city}, ${job.job_state}`);
      console.log(`   Link: ${job.job_apply_link}`);
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total jobs: ${jobs.length}`);
    const locations = [...new Set(jobs.map(job => `${job.job_city}, ${job.job_state}`))];
    console.log(`Locations: ${locations.join(', ')}`);
    
    console.log('\nFull JSON output:');
    console.log(JSON.stringify(jobs, null, 2));
  } else {
    console.log(`\nNo ${usOnly ? 'US ' : ''}jobs found for "${searchQuery}".`);
    console.log('\nTips:');
    console.log('- Try broader search terms like "Data" instead of "Data Science"');
    if (usOnly) {
      console.log('- Use --all-locations flag to include international jobs');
    }
  }
}

module.exports = genomicsScraper;

if (require.main === module) {
  main();
}