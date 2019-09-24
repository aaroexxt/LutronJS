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
	baseHubIP: "192.168.1.33",
	baseHubUser: "lutron",
	baseHubPass: "integration",
	roomDataPath: "roomData.json"
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
const telnetHandler = require("./core/telnetM.js");
const timingHandler = require("./core/timingM.js");
console.log("Required all packages successfully");

/* Initialization */
//JSON file parsing
const rdContents = fs.readFileSync(settings.roomDataPath, 'utf8')
var roomData = JSON.parse(rdContents);

//Hub connection via telnet server
const hub = new telnetHandler(settings.baseHubIP, settings.baseHubUser, settings.baseHubPass, roomData);
var hubConnected = false;
/*hub.begin().then(() => {
	hubConnected = true;
	console.log("Hub connected");
	/**** EXAMPLE USAGE

	Single light (by device identifier):

	SET VALUE
	hub.setLightOutput(2,0).then(() => {
		console.log("Success");
	}).catch(e => {
		console.error("Light output value fail: "+e);
	});

	GET VALUE
	hub.getLightOutput(2).then(value => {
			console.log("Light output value: "+value);
	}).catch(e => {
		console.error("Light output value fail: "+e);
	});

	Location (room, by room name):

	hub.setLocationLight("AaronsRoom",100).then(() => {
		console.log("AaronsRoom success");
	}).catch(e => {
		console.error(e);
	})
	*/
/*}).catch(e => {
	console.error("Hub connection failure: "+e);
	process.exit(1);
});*/

//Timer setup for autodimming of lights, etc
const timing = new timingHandler(roomData.timeShift, hub);

//setup pointer to current working directory
const cwd = __dirname;

console.log('Initialized all modules successfully');

/* Server initialization */
console.log("Initializing express & associated packages");
const app = express();
const server = http.Server(app);

//Instantiate all express packages
app.use(cors()); //enable cors

app.use(bodyParser.urlencoded({ extended: true })); //, limit: '50mb' })); //bodyparser for getting json data
app.use(bodyParser.json());

console.log("Initializing express routing");
//Initialize express routing
app.get('/status', (req, res) => {
    return res.end(RequestHandler.SUCCESS(hubConnected));
});

console.log("Connecting routers to pages");
app.post("/deviceName/:device/:newValue", function(req, res) {
	let deviceName = req.params.device;
	let newValue = req.params.newValue;
	hub.lookupDeviceName(deviceName, newValue).then(deviceObject => {
		hub.getLightOutput(deviceObject.identifier).then(currentValue => {
			let ramp = (newValue >= currentValue) ? deviceObject.rampUpTime : deviceObject.rampDownTime;
			hub.setLightOutput(deviceObject.identifier, newValue, ramp).then(() => {
				return res.end(RequestHandler.SUCCESS());
			}).catch(e => {
				return res.end(RequestHandler.FAILURE("Error setting light value: "+e+"\n"));
			})
		}).catch(e => {
			return res.end(RequestHandler.FAILURE("Error getting light output value: "+e+"\n"));
		})
	}).catch(e => {
		return res.end(RequestHandler.FAILURE("Device lookup failed: "+e+"\n"));
	});
});
app.post("/device/:device/:newValue", function(req, res) {
	let device = req.params.device;
	let newValue = req.params.newValue;
	hub.lookupDeviceIdentifier(device, newValue).then(deviceObject => {
		hub.getLightOutput(deviceObject.identifier).then(currentValue => {
			let ramp = (newValue >= currentValue) ? deviceObject.rampUpTime : deviceObject.rampDownTime;
			hub.setLightOutput(deviceObject.identifier, newValue, ramp).then(() => {
				return res.end(RequestHandler.SUCCESS());
			}).catch(e => {
				return res.end(RequestHandler.FAILURE("Error setting light value: "+e+"\n"));
			})
		}).catch(e => {
			return res.end(RequestHandler.FAILURE("Error getting light output value: "+e+"\n"));
		})
	}).catch(e => {
		return res.end(RequestHandler.FAILURE("Device lookup failed: "+e+"\n"));
	});
});
app.post("/location/:location/:newValue", function(req, res) {
	let locName = req.params.location;
	let newValue = req.params.newValue;
	hub.setLocationLight(locName,newValue).then(() => {
		return res.end(RequestHandler.SUCCESS());
	}).catch(e => {
		return res.end(RequestHandler.FAILURE("Error setting room value: "+e+"\n"));
	})
})

var deviceHTML = "";
let deviceKeys = Object.keys(roomData.devices);
for (let i=0; i<deviceKeys.length; i++) {
	deviceHTML+=`<p>Device: ${deviceKeys[i]}</p>`;
	deviceHTML+=`<input id="${deviceKeys[i]}Slider" type="range" min="0" max="100" value="100" oninput="document.getElementById('${deviceKeys[i]}Value').innerHTML = 'Value: '+this.value;"></input>`
	deviceHTML+=`<p id="${deviceKeys[i]}Value">Value: 100</p>`
	deviceHTML+=`<button onclick="sendDeviceNameCommand('${deviceKeys[i]}',document.getElementById('${deviceKeys[i]}Slider').value);">Set Device Value</button>`;
	deviceHTML+=`<br><br>`;
}

var locationHTML = "";
let locationKeys = Object.keys(roomData.locations);
for (let i=0; i<locationKeys.length; i++) {
	locationHTML+=`<p>Location: ${locationKeys[i]}</p>`;
	locationHTML+=`<input id="${locationKeys[i]}Slider" type="range" min="0" max="100" value="100" oninput="document.getElementById('${locationKeys[i]}Value').innerHTML = 'Value: '+this.value;"></input>`
	locationHTML+=`<p id="${locationKeys[i]}Value">Value: 100</p>`
	locationHTML+=`<button onclick="sendLocationCommand('${locationKeys[i]}',document.getElementById('${locationKeys[i]}Slider').value);">Set Location Value</button>`;
	locationHTML+=`<br><br>`;
}

app.use(function(req, res, next){ //404 page
	res.send(`
		<h1>Aaron's Light Manager V1</h1>
		<br>
		<h3>Devices:</h3>
		${deviceHTML}
		<br>
		<h3>Locations:</h3>
		${locationHTML}
		<h3>
		<script>
		function sendDeviceNameCommand(deviceName, value) { 
	    	let response = fetch("http://"+document.location.host+"/deviceName/"+deviceName+"/"+value, {
				method: 'post'
		    }).then(res => res.json()).then(res => {
		    	console.log(JSON.stringify(res));
		    }).catch(e => {
		    	console.error(JSON.stringify(e));
		    });
		}
		function sendDeviceCommand(device, value) {
	    	let response = fetch("http://"+document.location.host+"/device/"+device+"/"+value, {
				method: 'post'
		    }).then(res => res.json()).then(res => {
		    	console.log(JSON.stringify(res));
		    }).catch(e => {
		    	console.error(JSON.stringify(e));
		    });
		}
		function sendLocationCommand(loc, value) {
	    	let response = fetch("http://"+document.location.host+"/location/"+loc+"/"+value, {
				method: 'post'
		    }).then(res => res.json()).then(res => {
		    	console.log(JSON.stringify(res));
		    }).catch(e => {
		    	console.error(JSON.stringify(e));
		    });
		}
		</script>
	`);
});

console.log("Starting server");
const port = process.env.PORT || 80;
server.listen(port);

console.log("LutronJS Server running at http://localhost:"+port+" :)");
