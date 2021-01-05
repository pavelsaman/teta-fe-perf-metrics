require('dotenv').config();
const puppeteer = require('puppeteer');
const config = require('./config.json');
const elements = require('./selectors');
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

const env = process.env.ENV;
const baseUrl = config.url[env];
const date = new Date();
const MIN_WEIGHT = 100;
const MAX_WEIGHT = 2000;
const SUCCESS = 200;

const perfData = page => {
    return page.evaluate(
        () => {
            const data = performance.getEntriesByType("navigation")[0].toJSON();
            const dnsDuration = data.domainLookupEnd - data.domainLookupStart;

            return {
                url              : data.name,
                duration         : data.duration,
                dnsLookupDuration: dnsDuration,
                transferSize     : data.transferSize
            };
        }
    );
};
const randInt = (min = MIN_WEIGHT, max = MAX_WEIGHT) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};
const asc = arr => arr.slice().sort((a, b) => a - b);
const quantile = (arr, q) => {
    const sorted = asc(arr);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined)
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    return sorted[base];
};
const openDB = () => {
    return sqlite.open({
        filename: config.dbFile,
        driver  : sqlite3.Database
    });
};
const saveMetrics = async (metrics, db) => {
    for (const { url, duration, dnsLookupDuration, transferSize } of metrics) {
        await db.run(
            'INSERT INTO Metrics (env, url, duration, dnsLookupDuration,'
            + 'transferSize, captured) VALUES (?, ?, ?, ?, ?, ?)',
            env,
            url,
            duration,
            dnsLookupDuration,
            transferSize,
            date.toISOString()
        );
    }
};
/* eslint-disable max-lines-per-function, no-magic-numbers */
const showMetrics = metrics => {
    const durations = metrics.map(m => m.duration);
    const sumDurations = durations.reduce((a, b) => a + b, 0);
    const dnsLookupDurations = metrics.map(m => m.dnsLookupDuration);
    const sumDnsLookupDurations = dnsLookupDurations.reduce((a, b) => a + b, 0);
    const transferSizes = metrics.map(m => m.transferSize);
    const sumTransferSize = transferSizes.reduce((a, b) => a + b, 0);

    console.log('\nNumber of measuremens: ' + metrics.length);
    console.log('Total transfer size: ' + sumTransferSize);
    console.log('Durations:');
    console.log(' Sum: ' + sumDurations);
    console.log(' Avg: ' + sumDurations / durations.length);
    console.log(' Min: ' + Math.min(...durations));
    console.log(' Max: ' + Math.max(...durations));
    console.log(' Quantiles:');
    console.log('  .50: ' + quantile(durations, .50));
    console.log('  .75: ' + quantile(durations, .75));
    console.log('  .80: ' + quantile(durations, .80));
    console.log('  .90: ' + quantile(durations, .90));
    console.log(' Measurements:');
    console.log('  ' + durations);
    console.log(' Ordered measurements:');
    console.log('  ' + asc(durations));

    console.log('DNS lookup durations:');
    console.log(' Sum: ' + sumDnsLookupDurations);
    console.log(' Avg: ' + sumDnsLookupDurations / dnsLookupDurations.length);
    console.log(' Min: ' + Math.min(...dnsLookupDurations));
    console.log(' Max: ' + Math.max(...dnsLookupDurations));
    console.log(' Quantiles:');
    console.log('  .50: ' + quantile(dnsLookupDurations, .50));
    console.log('  .75: ' + quantile(dnsLookupDurations, .75));
    console.log('  .80: ' + quantile(dnsLookupDurations, .80));
    console.log('  .90: ' + quantile(dnsLookupDurations, .90));
    console.log(' Measurements:');
    console.log('  ' + dnsLookupDurations);
    console.log(' Ordered measurements:');
    console.log('  ' + asc(dnsLookupDurations));

    console.log("\n(All time values are in ms, transfer size is in octets.)");
};

(async () => {
    const metrics = [];
    const browser = await puppeteer.launch(config.browserConfig);
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    for (let i = 0; i < config.loops; i++) {
        // login page
        await page.goto(baseUrl);
        metrics.push(await perfData(page));

        // log in
        await page.type(elements.email, config.credentials[env].username);
        await page.type(elements.password, config.credentials[env].password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click(elements.logIn)
        ]);
        metrics.push(await perfData(page));

        // packing
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click(elements.packing)
        ]);
        metrics.push(await perfData(page));

        // choose first free packing location
        const freePackingLocation = await page.$$(elements.freeLocation);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            freePackingLocation[0].click()
        ]);
        metrics.push(await perfData(page));

        // choose first picked order
        const pickedOrders = await page.$$(elements.pickedOrder);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            pickedOrders[0].click()
        ]);
        metrics.push(await perfData(page));

        // confirm order
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click(elements.confirmOrder)
        ]);
        metrics.push(await perfData(page));

        // confirm 1 parcel
        await Promise.all([
            page.waitForSelector(elements.parcelWeightInput),
            page.waitForSelector(elements.printLabel),
            page.waitForSelector(elements.finishPacking),
            page.waitForResponse(
                res => {
                    return res.url()
                        .includes('/Packing/Parcels?action=Get')
                        && res.status() === SUCCESS;
                }
            ),
            page.click(elements.confirmParcels)
        ]);
        metrics.push(await perfData(page));

        // fill in weight
        await page.type(elements.parcelWeightInput, randInt().toString());

        // print labels
        await Promise.all([
            page.waitForFunction(
                selector => {
                    return document.querySelector(selector)
                        .getAttribute('disabled') !== "disabled";
                },
                {},
                elements.finishPacking
            ),
            page.waitForResponse(
                res => {
                    return res.url()
                        .includes('/Packing/Parcels?handler=PrintParcelLabel')
                        && res.status() === SUCCESS;
                }
            ),
            page.click(elements.printLabel)
        ]);

        // finish order
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click(elements.finishPacking)
        ]);
        metrics.push(await perfData(page));

        // log out
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click(elements.logOut)
        ]);
        metrics.push(await perfData(page));

        // log progress
        process.stdout.write('.');
    }

    await context.close();
    await browser.close();

    // print metrics and save raw data into sqlite
    showMetrics(metrics);
    const db = await openDB();
    await saveMetrics(metrics, db);
    await db.close();
})();
