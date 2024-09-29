const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const csv = require('csv-writer').createObjectCsvWriter;

class Scraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.userDataDir = path.join(__dirname, 'user_data');
        this.isLoggedIn = false;
    }

    async initialize() {
        console.log('Checking login status...');
        this.isLoggedIn = await this.checkLoginStatus();

        console.log('Launching browser...');
        this.browser = await puppeteer.launch({ 
            headless: this.isLoggedIn,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
            ],
            userDataDir: this.userDataDir,
        });
        console.log(`Browser launched in ${this.isLoggedIn ? 'headless' : 'non-headless'} mode.`);
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });
        console.log('New page created. Setting navigation timeout...');
        this.page.setDefaultNavigationTimeout(180000); // 3 minutes
        console.log('Navigation timeout set.');

        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }

    async checkLoginStatus() {
        const tempBrowser = await puppeteer.launch({ headless: true, userDataDir: this.userDataDir });
        const tempPage = await tempBrowser.newPage();
        await tempPage.goto('https://x.com', { waitUntil: 'domcontentloaded' });
        const isLoggedIn = await tempPage.evaluate(() => {
            return document.querySelector('a[href="/compose/tweet"]') !== null;
        });
        await tempBrowser.close();
        console.log(`Login status: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
        return isLoggedIn;
    }

    async navigateToLoginPage() {
        if (this.isLoggedIn) {
            console.log('Already logged in. Continuing...');
            return;
        }

        try {
            console.log('Navigating to x.com...');
            await this.page.goto('https://x.com', { 
                waitUntil: 'domcontentloaded',
                timeout: 60000 // 60 seconds timeout
            });
            console.log('Initial page load complete.');

            console.log('Not logged in. Please log in manually.');
            console.log('Press Enter in the console when you have logged in.');
            await new Promise(resolve => process.stdin.once('data', resolve));
            console.log('Continuing after manual login...');
            this.isLoggedIn = true;
        } catch (error) {
            console.error('Error navigating to login page:', error.message);
            throw error;
        }
    }

    async searchAndScrape(query, startDate, endDate) {
        try {
            console.log(`Searching for: ${query} between ${startDate} and ${endDate}`);
            const advancedSearchUrl = `https://x.com/search?q=${encodeURIComponent(query)}%20until%3A${endDate}%20since%3A${startDate}&src=typed_query`;
            
            console.log(`Navigating to: ${advancedSearchUrl}`);
            await this.page.goto(advancedSearchUrl, { 
                waitUntil: 'networkidle2',
                timeout: 180000 // 3 minutes timeout
            });
            console.log('Page loaded');

            // Check if there are any tweets
            const hasTweets = await this.page.evaluate(() => {
                return document.querySelectorAll('article[data-testid="tweet"]').length > 0;
            });

            if (!hasTweets) {
                console.log('No tweets found for this search query.');
                const waitTime = Math.floor(Math.random() * (20 - 10 + 1) + 10) * 1000; // Random time between 10 to 20 seconds
                console.log(`Waiting for ${waitTime / 1000} seconds before continuing to the next query...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return [];
            }

            console.log('Starting to scrape tweets...');
            let results = [];
            let noNewResultsCount = 0;
            const maxScrollAttempts = 50;

            for (let scrollAttempt = 0; scrollAttempt < maxScrollAttempts; scrollAttempt++) {
                console.log(`\nScroll attempt ${scrollAttempt + 1}/${maxScrollAttempts}`);
                
                await this.scrollDown();
                await this.page.waitForTimeout(1000);

                console.log('Scraping tweets after scroll...');
                const newResults = await this.scrapeTweets();
                console.log(`Scraped ${newResults.length} tweets in this attempt`);

                const newUniqueResults = newResults.filter(newTweet => 
                    !results.some(existingTweet => 
                        existingTweet.username === newTweet.username && 
                        existingTweet.timestamp === newTweet.timestamp
                    )
                );

                results = [...results, ...newUniqueResults];
                
                console.log(`Found ${newUniqueResults.length} new unique tweets. Total: ${results.length}`);
                
                if (newUniqueResults.length === 0) {
                    noNewResultsCount++;
                    console.log(`No new tweets found. Attempt ${noNewResultsCount}/5`);
                    if (noNewResultsCount >= 5) {
                        console.log('No new tweets after 5 attempts. Stopping scrape.');
                        break;
                    }
                } else {
                    noNewResultsCount = 0;
                }
                
                if (results.length >= 30) {
                    console.log('Reached 30 or more tweets. Stopping scrape.');
                    break;
                }
            }

            results = results.slice(0, 30); // Ensure we only keep 30 tweets
            console.log(`Scraped ${results.length} tweets in total.`);
            if (results.length > 0) {
                await this.saveResultsToCSV(results, query, startDate, endDate);
            }
            return results;
        } catch (error) {
            console.error('Error during search and scrape:', error.message);
            console.error(error.stack);
            return [];
        }
    }

    async scrollDown() {
        try {
            console.log('Attempting to scroll down...');
            const previousHeight = await this.page.evaluate('document.body.scrollHeight');
            await this.page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await this.page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`, {timeout: 10000});
            console.log('Scroll completed successfully');
        } catch (error) {
            console.error('Error during scroll:', error.message);
        }
    }

    async scrapeTweets() {
        try {
            return await this.page.evaluate(() => {
                const tweets = document.querySelectorAll('article[data-testid="tweet"]');
                return Array.from(tweets).map(tweet => {
                    const usernameElement = tweet.querySelector('div[data-testid="User-Name"] span');
                    const username = usernameElement ? usernameElement.textContent.trim().replace('@', '') : '';
                    const timestampElement = tweet.querySelector('time');
                    const timestamp = timestampElement ? timestampElement.getAttribute('datetime') : '';
                    const contentElement = tweet.querySelector('div[data-testid="tweetText"]');
                    const content = contentElement ? contentElement.innerText : '';
                    return { username, timestamp, content };
                }).filter(tweet => tweet.username !== '' && tweet.timestamp !== '' && tweet.content !== '');
            });
        } catch (error) {
            console.error('Error during tweet scraping:', error.message);
            return [];
        }
    }

    async saveResultsToCSV(results, query, startDate, endDate) {
        try {
            console.log(`Saving ${results.length} tweets to CSV.`);

            const filename = `${query.replace(/\W+/g, '_')}_${startDate}_${endDate}.csv`;
            const csvWriter = csv({
                path: filename,
                header: [
                    {id: 'username', title: 'Username'},
                    {id: 'timestamp', title: 'Date'},
                    {id: 'content', title: 'Tweet Content'}
                ]
            });

            await csvWriter.writeRecords(results);
            console.log(`Results saved to ${filename}`);
        } catch (error) {
            console.error('Error saving results to CSV:', error.message);
        }
    }

    async close() {
        if (this.browser) {
            console.log('Closing browser...');
            await this.browser.close();
            console.log('Browser closed.');
        }
    }
}

module.exports = { Scraper };