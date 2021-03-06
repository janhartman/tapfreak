'use strict';

var express = require('express');
var fs = require('fs');
var path = require('path');
var cors = require('cors');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');

var app = express();
var games = require('./game.json');
var ips = [];

app.use(express.static(path.join(__dirname, '..', 'website')));
app.use(cors());
app.use(bodyParser.json());
//app.use(favicon(path.join(__dirname, '..', 'website', 'favicon.ico')));


/**
 * Load the website.
 */
app.get('/', function (req, res) {
    return res.sendFile(path.join(__dirname, '..', 'website', 'index.html'));
});

/**
 * Get the specified game details.
 */
app.get('/api/games/:gameId', function (req, res) {
    var gameId = req.params.gameId;

    if (!gameId) {
        return res.sendStatus(400);
    }

    if (gameId == "all") {
        res.setHeader('Content-Type', 'application/json');
        return res.send(JSON.stringify(games));
    }

    for (var idx in games) {
        var game = games[idx];
        if (game.id.toString() == gameId.toString()) {
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify(game));
        }
    }

    res.sendStatus(404);
});

/**
 * Add a new game to the database.
 */
app.post('/api/games/', function (req, res) {
    var game = req.body;
    console.log("adding game");
    console.log(game);

    for (var i in games) {
        if (games[i].name == game.name || games[i].url == game.name) {
            return res.sendStatus(409);
        }
    }
    var newId = games[games.length - 1].id + 1;
    game['id'] = newId;
    games.push(game);
    fs.writeFileSync('game.json', JSON.stringify(games));

    res.sendStatus(200);
});

/**
 * Add a new client socket server.
 */
app.post('/api/ip', function (req, res) {
    var socketServer = req.body;
    ips.push(socketServer);
    console.log("client " + JSON.stringify(socketServer) );
    res.sendStatus(200);
});

/**
 * Redirect to client socket server.
 */
app.get('/play/:code', function (req, res) {
    var code = req.params.code;

    for (var i in ips) {
        var record = ips[i];
        if (record.code == code) {
            return res.redirect('http://' + record.ip + ':3000');
        }
    }

    res.sendStatus(404);
});

/**
 * Delete ip.
 */
app.delete('/api/ip/:code', function (req, res) {
    var code = req.params.code;
    for (var i in ips) {
        var record = ips[i];
        if (record.code == code) {
            delete ips[i];
            return res.sendStatus(204);
        }
    }
    return res.sendStatus(404);
});

/**
 * Start a game.
 */
app.get('/game/:id', function(req, res) {
    var id = req.params.id;
    return res.sendStatus(200);
});

app.listen(80, function () {
    console.log("Web server listening on port 80");
});