# Teta FE Performance Metrics

A simple script in JS and [Puppeteer](https://github.com/puppeteer/puppeteer) that goes over the standard Teta packing flow and captures page load times.

## Prerequisites

- install node.js
- run `$ npm install` to install package dependencies from `package.json`
- at least one free packing location
- enough picked orders ready to be packed (at least the same number as `loops` value from `config.json`)

## Flow and measurements

The script performs these steps in the packing app:

```
load login page => 
log in => 
choose packing => 
choose first free packing location => 
choose first order => 
confirm order => 
confirm 1 parcel =>
add its weight, finish packing => 
log out =>
```

At every `=>` metrics are taken, there are currently 9 measurements in one loop.

Duration metrics are taken from PerformanceNavigationTiming interface (https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming). Transfer size and DNS metrics are taken from PerformanceResourceTiming interface (https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming).

All historic metrics (and some metadata) are saved into `metrics.db` sqlite database. The script won't create a database, it assumes the DB already exists. `captured` column in the DB represents a datetime when the script was run (not when each measurement was taken).

The script could run in a loop, see `loops` property in `config.json`. If it's set to 3, 27 measurements are taken, saved into DB, and overall statistics are calculated out of all these values.

Overall statistics are printed into console. Time values are in ms, transfer size is in octets.

## Config

Unless the packing app is changed, the script doesn't need to be altered, it's configurable through `config.json`, selectors could be changed in `selectors.js`.

The script could be run on various environments, for that set `ENV` environment variable to one of these values:

- dev
- staging (not recommended, it affects production)
- prod (not recommended)

## Execution

```
$ node run.js
```

## Debugging

The script might fail because of timeout, it will manifest itself in an error message similar to this:

```
/home/pavel/testing/teta/teta-fe-perf-metrics/node_modules/puppeteer/lib/cjs/puppeteer/common/LifecycleWatcher.js:106
        return new Promise((fulfill) => (this._maximumTimer = setTimeout(fulfill, this._timeout))).then(() => new Errors_js_1.TimeoutError(errorMessage));
                                                                                                              ^

TimeoutError: Navigation timeout of 30000 ms exceeded
    at /home/pavel/testing/teta/teta-fe-perf-metrics/node_modules/puppeteer/lib/cjs/puppeteer/common/LifecycleWatcher.js:106:111
    at async FrameManager.waitForFrameNavigation (/home/pavel/testing/teta/teta-fe-perf-metrics/node_modules/puppeteer/lib/cjs/puppeteer/common/FrameManager.js:127:23)
    at async Frame.waitForNavigation (/home/pavel/testing/teta/teta-fe-perf-metrics/node_modules/puppeteer/lib/cjs/puppeteer/common/FrameManager.js:441:16)
    at async Page.waitForNavigation (/home/pavel/testing/teta/teta-fe-perf-metrics/node_modules/puppeteer/lib/cjs/puppeteer/common/Page.js:794:16)
    at async Promise.all (index 1)
    at async /home/pavel/testing/teta/teta-fe-perf-metrics/run.js:175:9
```

This is most likely caused by the app and what environment it runs under, default 30 second interval is more than enough, any action in the app should be completed well within this interval.

It could also be caused by no picked orders in the app, if there is nothing to choose from, the script won't work around it. See [prerequisites](#Prerequisites).

However, it might be necessary to see how the script interacts with the app (e.g. some selectors might change in the future, which will most likely cause a timeout as well), to execute the script in a non-headless mode, change `headless` in `config.json` to `true`. Other popular options for debugging are: `devtools` which will bring up Chrome DevTools if set to `true` and perhaps `slowMo` which will slow down the script by the specified amount of milliseconds.