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
    return { city: 'Multiple', state: 'US', country: 'US', isUS: true };
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
        stateOrCountry.toLowerCase().includes('united states')) {
      return { city, state: stateOrCountry, country: 'US', isUS: true };
    }
  }
  
  // Check for US indicators in the location text
  const locationLower = locationText.toLowerCase();
  if (locationLower.includes('usa') || locationLower.includes('united states') || 
      locationLower.includes('remote') || locationLower.includes('irvine') ||
      locationLower.includes('palo alto') || locationLower.includes('michigan') ||
      locationLower.includes('illinois') || locationLower.includes('california')) {
    return { city: locationText, state: 'US', country: 'US', isUS: true };
  }
  
  return { city: locationText, state: 'International', country: 'Other', isUS: false };
}

async function rivianScraper(searchQuery, maxPages = 10, usOnly = true) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  const allJobs = [];

  try {
    console.log(`Scraping Rivian careers for: "${searchQuery}"`);
    if (usOnly) {
      console.log('Filtering for US jobs only');
    }

    // Use the exact URL format from the provided Rivian careers page
    const baseUrl = 'https://careers.rivian.com/careers-home/jobs';
    
    let foundJobs = false;
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      // Build URL with exact format from the provided link
      const searchUrl = `${baseUrl}?keywords=${encodeURIComponent(searchQuery)}&location=united%20states&stretch=10&stretchUnit=MILES&sortBy=relevance&page=${pageNum}`;
      
      console.log(`\nPage ${pageNum}: ${searchUrl}`);
      
      try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for dynamic content
        
        // Check if we're on the right page
        const pageInfo = await page.evaluate(() => {
          const text = document.body.textContent;
          // Look for the results count shown in screenshot
          const resultsMatch = text.match(/(\d+)\s+Results?/i);
          return {
            hasJobsText: text.includes('jobs') || text.includes('positions') || text.includes('careers') || text.includes('Results'),
            hasDataText: text.toLowerCase().includes('data'),
            resultsCount: resultsMatch ? resultsMatch[1] : '0',
            title: document.title,
            url: window.location.href,
            hasJobElements: document.querySelectorAll('[data-automation-id], .job-card, .job-item, .job-listing').length > 0,
            totalElements: document.querySelectorAll('*').length,
            bodyLength: text.length,
            hasApplyButtons: text.includes('Apply Now'),
            hasLocationFilters: text.includes('united states') || text.includes('United States'),
            searchTermOnPage: text.toLowerCase().includes(searchQuery.toLowerCase())
          };
        });

        console.log(`Page ${pageNum} analysis:`);
        console.log(`- Results count: ${pageInfo.resultsCount}`);
        console.log(`- Has job-related text: ${pageInfo.hasJobsText}`);
        console.log(`- Has search term on page: ${pageInfo.searchTermOnPage}`);
        console.log(`- Has Apply buttons: ${pageInfo.hasApplyButtons}`);
        console.log(`- Has location filters: ${pageInfo.hasLocationFilters}`);
        console.log(`- Has job elements: ${pageInfo.hasJobElements}`);
        console.log(`- Total elements: ${pageInfo.totalElements}`);

        if (pageInfo.totalElements > 100 && pageInfo.bodyLength > 1000) {
          // Try multiple selectors for Workday job listings
          const possibleSelectors = [
            // Workday specific selectors based on screenshot
            '[data-automation-id="searchResultItem"]',
            '[data-automation-id="jobTitle"]', 
            '[data-automation-id*="job"]',
            '.css-1q2dra3', // Common Workday job card class
            '.css-ur1szg',  // Common Workday job title class
            'div[role="button"]', // Workday often uses role="button" for job cards
            'button[data-automation-id*="title"]',
            
            // Generic selectors for job cards
            '.job-card',
            '.job-item', 
            '.search-result',
            'article',
            
            // Try broader selectors that might contain job info
            'div[data-automation-id]',
            '[role="listitem"]',
            'li[data-automation-id]',
            
            // Look for clickable elements with job-like text
            'a, button, div[role="button"]'
          ];

          let jobElements = [];
          let workingSelector = null;

          for (const selector of possibleSelectors) {
            try {
              const elements = await page.$$(selector);
              if (elements.length > 0) {
                console.log(`Found ${elements.length} elements with selector: ${selector}`);
                
                // Test if these elements contain job-like content
                let relevantElements = 0;
                for (let i = 0; i < Math.min(elements.length, 3); i++) {
                  try {
                    const sampleContent = await elements[i].evaluate(el => el.textContent.toLowerCase());
                    if (sampleContent.includes('data') || sampleContent.includes('scientist') || 
                        sampleContent.includes('engineer') || sampleContent.includes('analyst') ||
                        sampleContent.includes('developer') || sampleContent.includes('manager') ||
                        sampleContent.includes('specialist') || sampleContent.includes('coordinator')) {
                      relevantElements++;
                    }
                  } catch (e) {
                    // Skip this element
                  }
                }
                
                if (relevantElements > 0) {
                  jobElements = elements;
                  workingSelector = selector;
                  console.log(`Using selector: ${selector} (${relevantElements}/${Math.min(elements.length, 3)} relevant)`);
                  break;
                }
              }
            } catch (err) {
              // Continue to next selector
            }
          }

          // If no standard selectors work, try content extraction
          if (jobElements.length === 0) {
            console.log('No job elements found with standard selectors, trying content extraction...');
            
            const jobsFromContent = await page.evaluate((searchTerm) => {
              const jobs = [];
              const allElements = document.querySelectorAll('*');
              
              allElements.forEach(el => {
                const text = el.textContent?.trim();
                const children = el.children.length;
                
                // Look for elements that might be job titles
                if (text && text.length > 10 && text.length < 200 && children < 10) {
                  if (text.toLowerCase().includes('data') || 
                      text.toLowerCase().includes('scientist') ||
                      text.toLowerCase().includes('engineer') ||
                      text.toLowerCase().includes('analyst') ||
                      text.toLowerCase().includes('developer') ||
                      text.toLowerCase().includes('manager') ||
                      text.toLowerCase().includes('specialist')) {
                    
                    // Look for associated link
                    const link = el.querySelector('a') || el.closest('a');
                    const href = link?.href || '';
                    
                    // Look for location information
                    let location = '';
                    let parent = el.parentElement;
                    for (let i = 0; i < 3 && parent; i++) {
                      const parentText = parent.textContent;
                      if (parentText.toLowerCase().includes('irvine') || 
                          parentText.toLowerCase().includes('california') ||
                          parentText.toLowerCase().includes('michigan') ||
                          parentText.toLowerCase().includes('remote') ||
                          parentText.includes(',')) {
                        const lines = parentText.split('\n').filter(l => l.trim());
                        location = lines.find(l => 
                          l.toLowerCase().includes('irvine') || 
                          l.toLowerCase().includes('california') ||
                          l.toLowerCase().includes('michigan') ||
                          l.toLowerCase().includes('remote') ||
                          l.includes(',')
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
                if (!seen.has(key) && job.title.length > 15) {
                  seen.add(key);
                  unique.push(job);
                }
              });
              
              return unique.slice(0, 20);
            }, searchQuery);

            console.log(`Found ${jobsFromContent.length} jobs from content extraction`);
            
            if (jobsFromContent.length > 0) {
              jobElements = jobsFromContent;
              workingSelector = 'content-extraction';
            }
          }

          if (jobElements.length > 0) {
            foundJobs = true;
            console.log(`Processing ${jobElements.length} job elements...`);

            let pageJobCount = 0;
            
            // Process job elements
            for (let i = 0; i < Math.min(jobElements.length, 30); i++) {
              try {
                let jobData;
                
                if (workingSelector === 'content-extraction') {
                  // Jobs already extracted from content
                  jobData = jobElements[i];
                } else {
                  // Extract from DOM elements - improved for Workday structure
                  jobData = await jobElements[i].evaluate(el => {
                    const fullText = el.textContent || '';
                    
                    // Try to find job title - look for main text that looks like a job title
                    let title = '';
                    let href = '';
                    let location = '';
                    let category = '';
                    
                    // Method 1: Look for specific selectors within this element
                    const titleSelectors = [
                      'h3', 'h2', 'h4', // Common heading tags for job titles
                      '[data-automation-id*="title"]',
                      '[data-automation-id="jobTitle"]',
                      'a', // Links might contain job titles
                      '.css-ur1szg', // Common Workday title class
                      'button', // Sometimes titles are in buttons
                      'div[role="button"]'
                    ];
                    
                    for (const selector of titleSelectors) {
                      const titleEl = el.querySelector(selector);
                      if (titleEl && titleEl.textContent.trim()) {
                        const potentialTitle = titleEl.textContent.trim();
                        // Check if this looks like a job title (not "Apply Now", etc.)
                        if (potentialTitle.length > 10 && 
                            !potentialTitle.toLowerCase().includes('apply') &&
                            !potentialTitle.toLowerCase().includes('view') &&
                            !potentialTitle.toLowerCase().includes('sort') &&
                            (potentialTitle.toLowerCase().includes('data') ||
                             potentialTitle.toLowerCase().includes('scientist') ||
                             potentialTitle.toLowerCase().includes('engineer') ||
                             potentialTitle.toLowerCase().includes('analyst') ||
                             potentialTitle.toLowerCase().includes('principal') ||
                             potentialTitle.toLowerCase().includes('manager'))) {
                          title = potentialTitle;
                          href = titleEl.href || titleEl.closest('a')?.href || '';
                          break;
                        }
                      }
                    }
                    
                    // Method 2: If no title found, parse from full text
                    if (!title) {
                      const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
                      // Look for a line that looks like a job title
                      for (const line of lines) {
                        if (line.length > 10 && line.length < 100 &&
                            !line.toLowerCase().includes('apply') &&
                            !line.toLowerCase().includes('location') &&
                            !line.toLowerCase().includes('category') &&
                            (line.toLowerCase().includes('data') ||
                             line.toLowerCase().includes('scientist') ||
                             line.toLowerCase().includes('engineer') ||
                             line.toLowerCase().includes('analyst') ||
                             line.toLowerCase().includes('principal'))) {
                          title = line;
                          break;
                        }
                      }
                    }
                    
                    // Look for location information
                    if (fullText.toLowerCase().includes('location')) {
                      const locationMatch = fullText.match(/Location\s*([^\n\r]+)/i);
                      if (locationMatch) {
                        location = locationMatch[1].trim();
                      }
                    }
                    
                    // Look for "Multiple" location specifically (as shown in screenshot)
                    if (fullText.includes('Multiple')) {
                      location = 'Multiple';
                    }
                    
                    // Look for category information
                    if (fullText.toLowerCase().includes('category')) {
                      const categoryMatch = fullText.match(/Category\s*([^\n\r]+)/i);
                      if (categoryMatch) {
                        category = categoryMatch[1].trim();
                      }
                    }
                    
                    // Look for apply link
                    if (!href) {
                      const link = el.querySelector('a') || el.closest('a');
                      href = link?.href || '';
                    }
                    
                    return { 
                      title, 
                      href, 
                      location, 
                      category,
                      fullText: fullText.substring(0, 200) // For debugging
                    };
                  });
                }

                if (!jobData || !jobData.title || jobData.title.length < 5) {
                  // Debug output for skipped elements
                  if (jobData && jobData.fullText) {
                    console.log(`  Skipped element: "${jobData.fullText.substring(0, 100)}..." (title: "${jobData.title || 'none'}")`);
                  }
                  continue;
                }

                console.log(`  Processing: "${jobData.title}" (Location: ${jobData.location || 'none'})`);

                // Filter by search query - more lenient matching
                const titleLower = jobData.title.toLowerCase();
                const queryLower = searchQuery.toLowerCase();
                const queryWords = queryLower.split(' ');
                
                const matchesQuery = titleLower.includes(queryLower) || 
                                   queryWords.some(word => word.length > 2 && titleLower.includes(word));
                
                if (!matchesQuery) {
                  console.log(`  Skipping "${jobData.title}" - doesn't match search query "${searchQuery}"`);
                  continue;
                }

                // Parse location and check if it's US - be more lenient for Rivian
                let location = jobData.location || 'Multiple Locations, US';
                
                // Special handling for Rivian locations
                if (location.toLowerCase().includes('multiple') || !location || location.length < 3) {
                  location = 'Multiple Locations, US'; // Rivian is primarily US-based
                }
                
                const { city, state, country, isUS } = parseLocation(location);

                // Filter for US jobs if requested
                if (usOnly && !isUS) {
                  console.log(`  Skipping non-US job: ${jobData.title} (${location})`);
                  continue;
                }

                const finalJobData = {
                  employer_name: "Rivian",
                  job_title: cleanJobTitle(jobData.title),
                  job_city: city,
                  job_state: state,
                  job_posted_at: 'Recently',
                  job_description: `${searchQuery} position at Rivian - ${jobData.title}`,
                  job_apply_link: jobData.href.startsWith('http') ? jobData.href : 
                                  jobData.href ? `https://careers.rivian.com${jobData.href}` : ''
                };

                allJobs.push(finalJobData);
                pageJobCount++;
                console.log(`  ✓ Added: ${jobData.title} - ${city}, ${state}`);

              } catch (err) {
                console.error(`Error processing job element ${i}:`, err.message);
              }
            }
            
            console.log(`Page ${pageNum}: Added ${pageJobCount} jobs`);
            
            // If no jobs found on this page, likely no more pages
            if (pageJobCount === 0) {
              console.log('No relevant jobs found on this page, stopping pagination');
              break;
            }
          } else {
            console.log(`Page ${pageNum}: No job elements found`);
            break;
          }
        } else {
          console.log(`Page ${pageNum}: Page seems empty or not loaded properly`);
          break;
        }

      } catch (err) {
        console.error(`Error with page ${pageNum}:`, err.message);
        break;
      }
      
      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 2000));
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
  
  console.log(`=== Scraping Rivian careers for: "${searchQuery}" ===`);
  const jobs = await rivianScraper(searchQuery, 5, usOnly); // Reduced to 5 pages as default
  
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

module.exports = rivianScraper;

if (require.main === module) {
  main();
}