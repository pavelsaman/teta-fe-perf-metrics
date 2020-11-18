require('dotenv').config();
const puppeteer = require('puppeteer');
const config = require('./config.json');
const elements = require('./selectors');
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

const env = process.env.ENV;
const url = config.url[env];
const date = new Date();

const perfData = async function (page) {
    return await page.evaluate(
        () => {
            const data = performance.getEntriesByType("navigation")[0].toJSON();
            const dnsDuration = data.domainLookupEnd - data.domainLookupStart;
            return {
                url: data.name,
                duration: data.duration,
                dnsLookupDuration: dnsDuration,
                transferSize: data.transferSize
            };
        }
    );
};
const randInt = (min = 100, max = 2000) => {
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
    else
        return sorted[base];
};
const openDB = async function () {
    return await sqlite.open({
        filename: config.dbFile,
        driver: sqlite3.Database
    });
};
const saveMetrics = async (metrics, db) => {    
    for (let m of metrics) {
        await db.run(
            'INSERT INTO Metrics (env, url, duration, dnsLookupDuration, \
                transferSize, captured) VALUES (?, ?, ?, ?, ?, ?)',
            env,
            m.url,
            m.duration,
            m.dnsLookupDuration,
            m.transferSize,
            date.toISOString()
        );
    }
};
const showMetrics = (metrics) => {
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
    let metrics = [];
    const browser = await puppeteer.launch(config.browserConfig);
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    for (let i = 0; i < config.loops; i++) {
        // login page
        await page.goto(url);
        metrics.push(await perfData(page));    

        // log in
        await page.type(elements.email, config.credentials[env].username);
        await page.type(elements.password, config.credentials[env].password);
        await Promise.all([
            page.click(elements.logIn),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        metrics.push(await perfData(page));
        
        // packing
        await Promise.all([
            page.click(elements.packing),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        metrics.push(await perfData(page));

        // choose first free packing location
        const freePackingLocation = await page.$$(elements.freeLocation);
        await Promise.all([
            freePackingLocation[0].click(),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        metrics.push(await perfData(page));

        // choose first picked order
        const pickedOrders = await page.$$(elements.pickedOrder);
        await Promise.all([
            pickedOrders[0].click(),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        metrics.push(await perfData(page));

        // confirm order
        await Promise.all([
            page.click(elements.confirmOrder),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        metrics.push(await perfData(page));

        // confirm 1 parcel
        await Promise.all([
            page.click(elements.confirmParcels),
            page.waitForSelector(elements.parcelWeightInput),
            page.waitForSelector(elements.printLabel),
            page.waitForSelector(elements.finishPacking),
            page.waitForResponse(
                res => {
                    return res.url()
                        .includes('/Packing/Parcels?action=Get')
                        && res.status() === 200;
                }
            )
        ]);
        metrics.push(await perfData(page));

        // fill in weight
        await page.type(elements.parcelWeightInput, randInt().toString());

        // print labels
        await Promise.all([
            page.click(elements.printLabel),
            page.waitForFunction(
                selector => {
                    return document.querySelector(selector)
                        .getAttribute('disabled') != "disabled";
                },
                {},
                elements.finishPacking
            ),
            page.waitForResponse(
                res => {
                    return res.url()
                        .includes('/Packing/Parcels?handler=PrintParcelLabel')
                        && res.status() === 200;
                }
            )
        ]);

        // finish order
        await Promise.all([
            page.click(elements.finishPacking),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        metrics.push(await perfData(page));

        // log out
        await Promise.all([
            page.click(elements.logOut),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
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