const express = require('express')
const app = express()
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

app.use(function(req, res, next) {
    if (req.secure) {
        next();
    }
    else {
        // console.log('req: ', Object.keys(req));
        // console.log('headers: ', Object.keys(req.headers));
        res.redirect('https://' + req.hostname + ':3443');
    }
});

app.set('view engine', 'pug')
app.get('/', function (req, res) {
    res.render('index', { title: 'Hey', message: 'Hello there!' })
})
// app.use('/', express.static(path.join(__dirname, 'www/')));
app.use('/js', express.static(path.join(__dirname, 'js/')));
app.use('/controllers', express.static(path.join(__dirname, 'controllers/')));
app.use('/css', express.static(path.join(__dirname, 'css/')));
app.use('/img', express.static(path.join(__dirname, 'img/')));

let privateKey  = fs.readFileSync(path.join(__dirname, '/selfsigned.key'));
let certificate = fs.readFileSync(path.join(__dirname, '/selfsigned.crt'));
let credentials = {key: privateKey, cert: certificate, passphrase: 'midi'};

let httpServer = http.createServer(app);
let httpsServer = https.createServer(credentials, app);
httpServer.listen(3000, () => {
    console.log(`Example app listening at http://localhost:${3000}`)
});
httpsServer.listen(3443, () => {
    console.log(`Example app listening at http://localhost:${3443}`)
})
