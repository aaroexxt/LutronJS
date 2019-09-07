/*
Main.js - Contains main server file
Run this lol
*/

/*
 * Copyright (c) Aaron Becker
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

/* Dependency initialization */

const settings = {
	assetsDirectory: "assets",
	baseHubIP: "192.168.1.33",
	baseHubUser: "lutron",
	baseHubPass: "integration"
}

//Basic Dependencies
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

//Express dependencies
const bodyParser = require('body-parser');
const cors = require('cors');

//Additional core utilities
const {RequestHandler, Util} = require("./core/serverUtilities.js");
const telnetMain = require("./core/telnetM.js");
console.log("Required all packages successfully");

/* Initialization */
var telnetM = new telnetMain(settings.baseHubIP, settings.baseHubUser, settings.baseHubPass);
const cwd = __dirname; //setup pointer to current working directory

console.log('Initialized all modules successfully');

/* Server initialization */
console.log("Initializing express & associated packages");
const app = express();
const server = http.Server(app);

//Instantiate all express packages
//app.use(serveFavicon(path.join(cwd,runtimeSettings.faviconDirectory))); //serve favicon
app.use(cors()); //enable cors

app.use(express.static(path.join(cwd,settings.assetsDirectory))); //define a static directory

app.use(bodyParser.urlencoded({ extended: true })); //, limit: '50mb' })); //bodyparser for getting json data
app.use(bodyParser.json());

console.log("Initializing express routing");
//Initialize express routing
var APIrouter = express.Router();

app.get('/status', (req, res) => {
    console.log("GET /status");
})

console.log("Connecting routers to pages");
app.use('/api', APIrouter); //connect api to main

app.use(function(req, res, next){ //404 page
	res.status(404);
	res.send("<h1>You tried to go to a page that doesn't exist :(</h1>");
});

console.log("Starting server");
const port = process.env.PORT || 1337;
server.listen(port);

console.log("Server running at http://localhost:"+port);
