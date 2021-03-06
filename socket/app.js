'use strict';

var path = require('path');
var fs = require('fs');
var express = require('express');
var http = require('http');
var socketio = require('socket.io');
var robot = require('robotjs');
var request = require('request');
var opn = require('opn');
var ip = require('ip');
var randomstring = require('randomstring');

var app = express();
var server = http.Server(app);
var io = socketio(server);
var ipAddress = ip.address();

// the config (URL to webserver...)
var config = require('./config.json');

// the connected clients (phones)
var clients = {};
var ids = {};

// the keymaps for the current game
var game = {};

var code = "";

/**
 * Getting game info / loading a new game
 * Wait for the request with the name of the game and request the keymappings from the web server.
 */
app.get('/game/:name', function (req, res) {
    var gameName = req.params.name;

    console.log("Received request to start game with id "+ gameName);

    request.get(config.webURL + '/api/games/' + gameName.toString(), function (err, response, body) {
        if (err) {
            console.log(err);
            return res.sendStatus(500);
        }

        code = randomstring.generate({length: 5, charset: 'alphabetic', capitalization: 'lowercase'});

        request({
            method: 'POST',
            url: config.webURL + '/api/ip',
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                code: code,
                ip: ipAddress
            })
            }, function (err, response, body2) {
                if (err) {
                    console.log("Error posting ip to server");
                    return res.sendStatus(500);
            }

            console.log("Game " + body);
            game = JSON.parse(body);

            clients = {};
            ids = {};

            // load the template and inject ip, then save and display

            var template = fs.readFileSync('game.html', {encoding: 'utf8'});
            var toDisplay = template.replace('{ip}', ipAddress + ':3000');
            toDisplay = toDisplay.replace('{code}', code);

            fs.writeFileSync('newgame.html', toDisplay);
            opn(path.join(__dirname, 'newgame.html'));
            res.sendStatus(200);
        });

    });

});

/**
 * Shut the server down.
 */
app.get('/shutdown', function (req, res) {
    request.delete(config.webURL + '/api/ip/' + code, function (err, res, body) {
    });
    process.exit(0);
});


/**
 * UI serving
 * Serve the HTML with client-side socket JS code based on the current game.
 */

app.get('/', function (req, res) {
    if (Object.keys(game).length == 0) {
        console.log('Game not started yet');
        return res.sendFile(path.join(__dirname, '..', 'client', 'gameNotStarted.html'));
    }

    var numOfClients = Object.keys(clients).length;

    if (numOfClients == game.numOfPlayers) {
        console.log('All available spots are filled');
        res.sendFile(path.join(__dirname, '..', 'client', 'tooManyPlayers.html'));
    }

    else if (numOfClients > game.numOfPlayers) {
        console.log('Error: there are more clients than allowed players');
        res.sendFile(path.join(__dirname, '..', 'client', 'tooManyPlayers.html'));

    }

    // potentially request UIs from main web server
    else {
        console.log('Sending HTML to client');
        switch (game.keys) {
            case 2:
                return res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
            case 3:
                return res.sendFile(path.join(__dirname, '..', 'client', 'index3.html'));
            case 4:
                return res.sendFile(path.join(__dirname, '..', 'client', 'index4.html'));
            case 5:
                return res.sendFile(path.join(__dirname, '..', 'client', 'index5.html'));
        }

    }

});


/**
 * Sockets: clients connecting and disconnecting
 */

io.on('connection', function (socket) {
    console.info('New client connected (id=' + socket.id + ').');

    if (!game.keyBindings) {
        console.log('Game not set or player number not allowed');
        return;
    }
    var numOfClients = Object.keys(clients).length;

    if (numOfClients == game.numOfPlayers) {
        console.log('All available spots are filled');
        return socket.disconnect(true);
    }
    else if (numOfClients > game.numOfPlayers) {
        console.log('Error: there are more clients than allowed players');
        return socket.disconnect(true);
    }

    clients[socket.id] = socket;

    for (var i = 1; i <= game.numOfPlayers; i++) {
        var playerId = 'player' + i.toString();
        if (! ids[socket.id]) {
            ids[socket.id] = playerId;
            console.log('Binding socket ' + socket.id + ' to player id ' + playerId);
        }

    }


    socket.on('disconnect', function () {
        if (clients[socket.id]) {
            delete clients[socket.id];
            console.info('Client disconnected (id=' + socket.id + ').');
        }
    });
});

/**
 * Sockets: clients sending commands
 */

io.sockets.on('connection', function (socket) {
    socket.on('command', function (data) {
        //console.log(data);


        var playerId = ids[socket.id];
        if (!game.keyBindings || !game.keyBindings[playerId]) {
            console.log('Game not set or player number not allowed');
            return;
        }

        if (data.type === 'down') {

            robot.keyToggle(game.keyBindings[playerId][data.key], 'down');
        }
        else if (data.type === 'up') {
            robot.keyToggle(game.keyBindings[playerId][data.key], 'up');
        }

        socket.broadcast.emit('command', data);

    });


});


server.listen(3000, function () {
    console.log('Socket server listening on port 3000');
});