'use strict'
const path = require('path');
const url = require('url');
const RTCMultiConnectionServer = require('rtcmulticonnection-server');
const fs = require('fs').promises;
const { pushLogs } = require('rtcmulticonnection-server');
const BASH_COLORS_HELPER = RTCMultiConnectionServer.BASH_COLORS_HELPER;
const getValuesFromConfigJson = RTCMultiConnectionServer.getValuesFromConfigJson;
const getBashParameters = RTCMultiConnectionServer.getBashParameters;
const resolveURL = RTCMultiConnectionServer.resolveURL;
const jsonPath = {
  config: 'config.json',
  logs: './logs.json'
};

module.exports = async (request, response) => {
  // to make sure we always get valid info from json file
  // even if external codes are overriding it
  let config = getValuesFromConfigJson(jsonPath);
  config = getBashParameters(config, BASH_COLORS_HELPER);

  // HTTP_GET handling code goes below
  try {
    let uri, filename;

    try {
      if (!config.dirPath || !config.dirPath.length) {
        config.dirPath = null;
      }

      uri = url.parse(request.url).pathname;
      filename = path.join(config.dirPath ? resolveURL(config.dirPath) : process.cwd(), uri);
    } catch (e) {
      pushLogs(config, 'url.parse', e);
    }

    filename = (filename || '').toString();

    if (request.method !== 'GET' || uri.indexOf('..') !== -1) {
      try {
        response.writeHead(401, {
          'Content-Type': 'text/plain'
        });
        response.write('401 Unauthorized: ' + path.join('/', uri) + '\n');
        response.end();
        return;
      } catch (e) {
        pushLogs(config, '!GET or ..', e);
      }
    }

    if (filename.indexOf(resolveURL('/admin/')) !== -1 && config.enableAdmin !== true) {
      try {
        response.writeHead(401, {
          'Content-Type': 'text/plain'
        });
        response.write('401 Unauthorized: ' + path.join('/', uri) + '\n');
        response.end();
        return;
      } catch (e) {
        pushLogs(config, '!GET or ..', e);
      }
      return;
    }

    let matched = false;
    ['/demos/', '/dev/', '/dist/', '/socket.io/', '/node_modules/canvas-designer/', '/admin/'].forEach(function (item) {
      if (filename.indexOf(resolveURL(item)) !== -1) {
        matched = true;
      }
    });

    // files from node_modules
    ['RecordRTC.js', 'FileBufferReader.js', 'getStats.js', 'getScreenId.js', 'adapter.js', 'MultiStreamsMixer.js'].forEach(function (item) {
      if (filename.indexOf(resolveURL('/node_modules/')) !== -1 && filename.indexOf(resolveURL(item)) !== -1) {
        matched = true;
      }
    });

    if (filename.search(/.js|.json/g) !== -1 && !matched) {
      try {
        response.writeHead(404, {
          'Content-Type': 'text/plain'
        });
        response.write('404 Not Found: ' + path.join('/', uri) + '\n');
        response.end();
        return;
      } catch (e) {
        pushLogs(config, '404 Not Found', e);
      }
    }

    ['Video-Broadcasting', 'Screen-Sharing', 'Switch-Cameras'].forEach(function (fname) {
      try {
        if (filename.indexOf(fname + '.html') !== -1) {
          filename = filename.replace(fname + '.html', fname.toLowerCase() + '.html');
        }
      } catch (e) {
        pushLogs(config, 'forEach', e);
      }
    });

    let stats;

    try {
      stats = await fs.lstat(filename);

      if (filename.search(/demos/g) === -1 && filename.search(/admin/g) === -1 && stats.isDirectory() && config.homePage === '/demos/index.html') {
        if (response.redirect) {
          response.redirect('/demos/');
        } else {
          response.writeHead(301, {
            'Location': '/demos/'
          });
        }
        response.end();
        return;
      }
    } catch (e) {
      response.writeHead(404, {
        'Content-Type': 'text/plain'
      });
      response.write('404 Not Found: ' + path.join('/', uri) + '\n');
      response.end();
      return;
    }

    try {
      if (await fs.stat(filename).isDirectory()) {
        response.writeHead(404, {
          'Content-Type': 'text/html'
        });
      }
    } catch (e) {
      pushLogs(config, 'statSync.isDirectory', e);
    }

    let contentType = 'text/plain';
    if (filename.toLowerCase().indexOf('.html') !== -1) {
      contentType = 'text/html';
    }
    if (filename.toLowerCase().indexOf('.css') !== -1) {
      contentType = 'text/css';
    }
    if (filename.toLowerCase().indexOf('.png') !== -1) {
      contentType = 'image/png';
    }

    let file = await fs.readFile(filename, 'binary');
    try {
      file = file.replace('connection.socketURL = \'/\';', 'connection.socketURL = \'' + config.socketURL + '\';');
    } catch (e) {}

    response.writeHead(200, {
      'Content-Type': contentType
    });
    response.write(file, 'binary');
    response.end();

  } catch (e) {
    pushLogs(config, 'Unexpected', e);

    response.writeHead(404, {
      'Content-Type': 'text/plain'
    });
    response.write('404 Not Found: Unexpected error.\n' + e.message + '\n\n' + e.stack);
    response.end();
  }
}