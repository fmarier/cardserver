#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
fs = require('fs'),
path = require('path'),
url = require('url'),
http = require('http'),
urlparse = require('urlparse'),
etagify = require('etagify'),
express = require('express');

const
wsapi = require('../lib/wsapi.js'),
httputils = require('../lib/httputils.js'),
conf = require('../lib/configuration.js'),
logger = require('../lib/logging.js').logger;

var app = express.createServer();

logger.info("logging server starting up");

// none of our views include dynamic data.  all of them should be served
// with reasonable cache headers.  This wrapper around rendering handles
// cache headers maximally leveraging the same logic that connect uses
// issue #910
function renderCachableView(req, res, template, options) {
  // allow caching, but require revalidation via ETag
  res.etagify();
  res.setHeader('Cache-Control', 'public, max-age=0');
  res.setHeader('Date', new Date().toUTCString());
  res.setHeader('Vary', 'Accept-Encoding,Accept-Language');
  res.setHeader('Content-Type', 'text/html; charset=utf8');
  res.render(template, options);
}

// logging!  all requests other than __heartbeat__ are logged
app.use(express.logger({
  stream: {
    write: function(x) {
      logger.info(typeof x === 'string' ? x.trim() : x);
    }
  }
}));

// limit all content bodies to 10kb, at which point we'll forcefully
// close down the connection.
app.use(express.limit("10kb"));

// verify all JSON responses are objects
app.use(function(req, resp, next) {
  var realRespJSON = resp.json;
  resp.json = function(obj) {
    if (!obj || typeof obj !== 'object') {
      logger.error("INTERNAL ERROR!  *all* json responses must be objects");
      return httputils.serverError(resp, "broken internal API implementation");
    }
    realRespJSON.call(resp, obj);
  };
  return next();
});

// static files first
var static_root = path.join(__dirname, "..", "static");
app.use(express.static(static_root));
app.set('views', static_root + '/../views');

// Caching for dynamic resources
app.use(etagify());

// handle /wsapi requests
wsapi.setup({}, app);

app.get('/', function(req, resp) {
  renderCachableView(req, resp, 'home.ejs', {layout: false});
});

// if nothing else has caught this request, serve static files, but ensure
// that proper vary headers are installed to prevent unwanted caching
app.use(function(req, res, next) {
  res.setHeader('Vary', 'Accept-Encoding,Accept-Language');
  next();
});

// custom 404 page
app.use(function(req, res,next) {
  res.statusCode = 404;
  res.write("Cannot find this resource");
  res.end();
});

app.listen(conf.get('bind_to').port, function() {
  logger.info("running on "+ app.address().address + ":" + app.address().port);
});
