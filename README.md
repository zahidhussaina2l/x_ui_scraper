# X (Twitter) Scraper

This project is a web scraper designed to extract tweets from X (formerly Twitter) based on specific search queries and date ranges. It uses Puppeteer to automate browser interactions and can handle multiple search queries in a single run.

## Features

- Scrapes tweets based on keywords and date ranges
- Handles user authentication (manual login required if not already logged in)
- Saves results in CSV format
- Supports multiple queries through a CSV input file
- Implements scrolling to load more tweets
- Handles cases where no tweets are found
- Runs in headless mode when already logged in

## Prerequisites

- Node.js (v12 or higher recommended)
- npm (Node Package Manager)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/zahidhussaina2l/x_ui_scraper
   cd x_ui_scraper
   ```

2. Install the required dependencies:
   ```bash
   npm install
   ```

## Usage

1. Run the script:
   ```bash
   npm start
   ```

2. On first run, the script will create a sample `input.csv` file. Edit this file with your desired search queries and date ranges.

3. Run the script again to start scraping based on your input file.

4. If you're not logged in, the browser will open, and you'll need to log in manually. Once logged in, press Enter in the console to continue.

5. The script will process each query in the input file and save results to individual CSV files.

## Input File Format

The `input.csv` file should have the following format:

