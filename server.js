var fs = require('fs'),
    http = require('http'),
    express = require('express'),
    bodyParser = require('body-parser'),
    setup = require('./proxy');


// ---------- The UI - Express ---------------------------------------

var app = express();
var uiServer = http.createServer(app);
app.use(bodyParser.json({ type: 'application/json' }));
app.use(express.static(__dirname + '/public'));
app.post('/config', function(req, res){
    res.setHeader('Content-Type', 'application/json');
    if (typeof req.body !== 'object' || !req.body.allowedApps) {
        res.status(400).end('Bad request');
    } else {
        fs.writeFileSync('./config.json', JSON.stringify(req.body, null, 2));
        res.end(JSON.stringify({ result: 'OK' }));
    }
});
app.get('/config', function(req, res){
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(serverContext.config));
});
app.get('/request-log', function(req, res){
    // TODO: Remove assumption that there is at max one request per millisecond
    var afterTime = parseInt(req.query.afterTime || '0');
    var logEntriesToSend = requestLog.filter(function(entry) {
        return entry.time > afterTime;
    });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(logEntriesToSend));
});
app.listen(47673);



// ---------- The Config (monitored JSON file on disk) ---------------------------------------

// Setup initial empty config, read config from file and setup watcher for config file
var serverContext = { config: { } };

function readConfig() {
    try {
        var newConfig = JSON.parse(fs.readFileSync('./config.json'));
        newConfig.allowedApps.forEach(function(app) {
            app.urls.forEach(function(stringRule, i, rules) {
                rules[i] = new RegExp(stringRule, 'i');
                rules[i].toJSON = function() { return stringRule; };
            });
        });
        serverContext.config = newConfig;
        console.log('INFO: Read updated config from config.json');
    } catch (e) {
        console.log('ERROR: Exception while parsing config: ' + e);
    }
}

fs.watchFile('./config.json', function(currentVersion, previousVersion) {
    readConfig();
});

readConfig();




// ---------- The HTTP / HTTPS proxy ---------------------------------------

var requestLog = [];

// Helper callback function to check if requested URL is allowed
function allowRequest(req, url) {
    var allow = false;
    serverContext.config.allowedApps.forEach(function(app) {
        app.urls.forEach(function(urlRule) {
            if (url.match(urlRule)) {
                allow = true;
            }
        });
    });
    console.log((allow ? 'ALLOW: ' : 'DENY:  ') + req.method + ' ' + url);

    requestLog.push({ id: requestLog.sequenceNumber, time: new Date().getTime(), allow: allow, method: req.method, url: url });
    while (requestLog.length > 1000) {
        requestLog.shift();
    }
    return allow;
}

var proxyServer = setup(http.createServer(), undefined, allowRequest);
proxyServer.listen(47672, function () {
    console.log('HTTP(s) proxy server listening on port %d', proxyServer.address().port);
});

