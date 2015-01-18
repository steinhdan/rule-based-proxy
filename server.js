var fs = require('fs');
var http = require('http');
var setup = require('./proxy-server/proxy');




// Setup initial empty config, read config from file and setup watcher for config file
var serverContext = { config: { } };

function readConfig() {
    try {
        var newConfig = JSON.parse(fs.readFileSync('./config.json'));
        newConfig.allowedApps.forEach(function(app) {
            app.urls.forEach(function(stringRule, i, rules) {
                rules[i] = new RegExp(stringRule, 'i');
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





// Setup the proxy

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
    console.log((allow ? 'ALLOW: ' : 'DENY:  ') + req.method + ' ' + url.toString());
    return allow;
}

var proxyServer = setup(http.createServer(), undefined, allowRequest);

proxyServer.listen(47672, function () {
    console.log('HTTP(s) proxy server listening on port %d', proxyServer.address().port);
});
