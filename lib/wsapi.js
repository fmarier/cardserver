/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// an abstraction that implements all of the cookie handling, CSRF protection,
// etc of the wsapi.  This module also routes request to the approriate handlers
// underneath wsapi/
//
// each handler under wsapi/ supports the following exports:
//   exports.process - function(req, res) - process a request
//   exports.writes_db - must be true if the processing causes a database write
//   exports.method - either 'get' or 'post'
//   exports.args - an array of arguments that should be verified
//   exports.i18n - boolean, does this operation display user facing strings


const
express = require('express'),
logger = require('./logging.js').logger,
httputils = require('./httputils.js'),
url = require('url'),
fs = require('fs'),
path = require('path');

exports.setup = function(options, app) {
  const WSAPI_PREFIX = '/wsapi';

  // If externally we're serving content over SSL we can enable things
  // like strict transport security and change the way cookies are set
  //const overSSL = (config.get('scheme') === 'https');
  const overSSL = false;

  var bodyParser = express.bodyParser();

  // stash our forward-to url so different wsapi handlers can use it
  exports.fowardWritesTo = options.forward_writes;

  app.use(function(req, resp, next) {
    var purl = url.parse(req.url);

    if (purl.pathname.substr(0, WSAPI_PREFIX.length) === WSAPI_PREFIX)
    {
      // explicitly disallow caching on all /wsapi calls (issue #294)
      resp.setHeader('Cache-Control', 'no-cache, max-age=0');

      // we set this parameter so the connect-cookie-session
      // sends the cookie even though the local connection is HTTP
      // (the load balancer does SSL)
      if (overSSL)
        req.connection.proxySecure = true;

      const operation = purl.pathname.substr(WSAPI_PREFIX.length);

      // check to see if the api is known here, before spending more time with
      // the request.
      if (!wsapis[req.method.toLowerCase()].hasOwnProperty(operation))
      {
        return httputils.badRequest(resp, "no such api");
      }
    }
    return bodyParser(req, resp, function() {
      return next();
    });
  });

  // load all of the APIs supported by this process
  var wsapis = {
    "get": {},
    "post": {}
  };

  function describeOperation(name, op) {
    var str = "  " + name + " (";
    str += op.method.toUpperCase() + " - ";
    str += (op.authed ? "" : "not ") + "authed";
    if (op.args) {
      str += " - " + op.args.join(", ");
    }
    str += ")";
    logger.debug(str);
  }

  fs.readdirSync(path.join(__dirname, 'wsapi')).forEach(function (f) {
    // skip files that don't have a .js suffix or start with a dot
    if (f.length <= 3 || f.substr(-3) !== '.js' || f.substr(0,1) === '.') return;
    var operation = f.substr(0, f.length - 3);

    try {
      var api = require(path.join(__dirname, 'wsapi', f));

      // does it override the URL?
      if (api.url) {
        operation = api.url;
        if (operation[0] != '/')
          logger.info("be careful, no starting / in that operation, not likely to work");
      }

      wsapis[api.method.toLowerCase()][operation] = api;

      // set up the argument validator
      if (api.args) {
        if (!Array.isArray(api.args)) throw "exports.args must be an array of strings";
        api.validate = validate(api.args);
      } else {
        api.validate = function(req,res,next) { next(); };
      }

    } catch(e) {
      var msg = "error registering " + operation + " api: " + e;
      logger.error(msg);
      throw msg;
    }
  });

  // debug output - all supported apis
  logger.debug("WSAPIs:");
  Object.keys(wsapis).forEach(function(method) {
    logger.debug("method " + method);
    Object.keys(wsapis[method]).forEach(function(api) {
      describeOperation(api, wsapis[method][api]);
    });
  });

  app.use(function(req, resp, next) {
    var purl = url.parse(req.url);

    if (purl.pathname.substr(0, WSAPI_PREFIX.length) === WSAPI_PREFIX) {
      const operation = purl.pathname.substr(WSAPI_PREFIX.length);
      const method = req.method.toLowerCase();

      // at this point, we *know* 'operation' is valid API, give checks performed
      // above

      // validate the arguments of the request
      logger.debug(method + " - " + req.url);
      wsapis[method][operation].validate(req, resp, function() {
        wsapis[method][operation].process(req, resp);
      });
    } else {
      next();
    }
  });
};
