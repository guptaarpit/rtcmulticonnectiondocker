// http://127.0.0.1:9001
// http://localhost:9001

const generateSecureServer = require('./generateSecureServer');
const express = require('express');
const app = express();
const serverHandler = require('./serverHandler');
let httpServer = require('http');
const ioServer = require('socket.io');
const RTCMultiConnectionServer = require('rtcmulticonnection-server');
const redisAdapter = require('socket.io-redis');

let PORT = 9001;
let isUseHTTPs = false;

const jsonPath = {
  config: 'config.json',
  logs: 'logs.json'
};

const BASH_COLORS_HELPER = RTCMultiConnectionServer.BASH_COLORS_HELPER;
const getValuesFromConfigJson = RTCMultiConnectionServer.getValuesFromConfigJson;
const getBashParameters = RTCMultiConnectionServer.getBashParameters;
let config = getValuesFromConfigJson(jsonPath);
config = getBashParameters(config, BASH_COLORS_HELPER);

// if user didn't modifed "PORT" object
// then read value from "config.json"
if (PORT === 9001) {
  PORT = config.port;
}

if (isUseHTTPs === false) {
  isUseHTTPs = config.isUseHTTPs;
}

let httpApp, numUsers = 0;

(async () => {
  try {
    if (isUseHTTPs) {
      httpServer = require('https');
      try {
        httpApp = httpServer.createServer(await generateSecureServer(), app, serverHandler);
      } catch (e) {
        console.log(e);
      }
    } else {
      httpApp = httpServer.createServer(app, serverHandler);
    }

    RTCMultiConnectionServer.beforeHttpListen(httpApp, config);
    const io = ioServer(httpApp);
    io.adapter(redisAdapter({ host: 'redis', port: 6379 }));
    httpApp = httpApp.listen(process.env.PORT || PORT, process.env.IP || '0.0.0.0', function () {
      RTCMultiConnectionServer.afterHttpListen(httpApp, config);
    });

// --------------------------
// socket.io codes goes below

    app.use(express.static(__dirname + '/public'));
    io.on('connection', function (socket) {
      RTCMultiConnectionServer.addSocket(socket, config);

      // ----------------------
      // below code is optional
      socket.emit('my-name-is', serverName);

      let addedUser = false;

      // when the client emits 'new message', this listens and executes
      socket.on('new message', function (data) {
        // we tell the client to execute 'new message'
        socket.broadcast.emit('new message', {
          username: socket.username,
          message: data
        });
      });

      // when the client emits 'add user', this listens and executes
      socket.on('add user', function (username) {
        if (addedUser) return;

        // we store the username in the socket session for this client
        socket.username = username;
        ++numUsers;
        addedUser = true;
        socket.emit('login', {
          numUsers: numUsers
        });
        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
          username: socket.username,
          numUsers: numUsers
        });
      });

      // when the client emits 'typing', we broadcast it to others
      socket.on('typing', function () {
        socket.broadcast.emit('typing', {
          username: socket.username
        });
      });

      // when the client emits 'stop typing', we broadcast it to others
      socket.on('stop typing', function () {
        socket.broadcast.emit('stop typing', {
          username: socket.username
        });
      });

      // when the user disconnects.. perform this
      socket.on('disconnect', function () {
        if (addedUser) {
          --numUsers;

          // echo globally that this client has left
          socket.broadcast.emit('user left', {
            username: socket.username,
            numUsers: numUsers
          });
        }
      });

      console.log('Handshake Query', socket.handshake.query)
      const params = socket.handshake.query;

      if (!params.socketCustomEvent) {
        params.socketCustomEvent = 'custom-message';
      }

      socket.on(params.socketCustomEvent, function (message) {
        socket.broadcast.emit(params.socketCustomEvent, message);
      });
    });
  }catch (e) {
    console.log(e);
  }
})();
