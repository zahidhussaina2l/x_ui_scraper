const { Scraper } = require('./scraper');
const fs = require('fs');
const fsPromises = require('fs').promises;
const csv = require('csv-parser');

async function createSampleInputFile() {
    const sampleContent = `keyword,startDate,endDate
example1,2023-01-01,2023-12-31
example2,2023-06-01,
cryptoproject,2023-01-01,`;

    try {
        await fsPromises.access('input.csv');
        console.log('input.csv already exists. Skipping sample file creation.');
    } catch (error) {
        await fsPromises.writeFile('input.csv', sampleContent);
        console.log('Sample input.csv file created. Please edit it with your keywords and dates before running the script again.');
        process.exit(0);
    }
}

async function readInputFile(filename) {
    const results = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filename)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

async function main() {
    await createSampleInputFile();

    const scraper = new Scraper();
    try {
        console.log('Initializing scraper...');
        await scraper.initialize();
        console.log('Scraper initialized. Navigating to login page...');
        await scraper.navigateToLoginPage();
        console.log('Navigation complete. Starting query loop...');
        
        const inputData = await readInputFile('input.csv');
        
        for (const row of inputData) {
            try {
                const { keyword, startDate, endDate } = row;
                const currentDate = new Date().toISOString().split('T')[0];
                const searchEndDate = endDate || currentDate;
                
                console.log(`Performing search and scrape for keyword: ${keyword}`);
                const results = await scraper.searchAndScrape(keyword, startDate, searchEndDate);
                console.log(`Search complete. ${results.length} tweets found.`);
                
                // Check if file was saved
                const filename = `${keyword.replace(/\W+/g, '_')}_${startDate}_${searchEndDate}.csv`;
                try {
                    await fs.access(filename);
                    console.log(`File ${filename} was successfully saved.`);
                } catch (error) {
                    console.error(`Error: File ${filename} was not saved.`);
                }
                
                console.log('Waiting for 10 seconds before next search...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                
                console.log('\n---\n');
            } catch (error) {
                console.error('Error during search loop:', error);
                console.error(error.stack);
                console.log('Continuing to next keyword...');
            }
        }
    } catch (error) {
        console.error('An error occurred in main():', error);
        console.error(error.stack);
    } finally {
        console.log('Closing browser...');
        await scraper.close();
        console.log('Browser has been closed. Exiting script.');
    }
}

process.on('SIGINT', async () => {
    console.log('Received SIGINT. Closing browser and exiting...');
    await scraper.close();
    process.exit(0);
});

console.log('Starting main function...');
main().catch(error => {
    console.error('Unhandled error in main():', error);
    console.error(error.stack);
});