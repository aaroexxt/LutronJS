const net = require('net');
const deviceCommandQueue = require('./deviceCommandQueue.js');
const EOL = "\r\n"; //end of line to server

const debugMode = true;
const telnetLog = log => {
	if (debugMode) {
		console.log("TelnetClient: "+log);
	}
}

const clampPower = newPower => {
	if (newPower > 100) {
		return 100;
	} else if (newPower < 0) {
		return 0;
	} else if (typeof newPower == "undefined") {
		return 0;
	}
	return newPower;
}
class telnetM {
	constructor(ip = "192.168.1.33", user = "lutron", pass = "integration", roomData = {}, loginTimeout = 180000, connectTimeout = 10000, commandTimeout = 10000) {
		console.log("Instantiating telnetM with:\nIP:"+ip+"\nUSER:"+user+"\nPASS: "+pass);
		//State stuff
		this.isAuthenticated = false;

		//RoomData:
		this.devices = roomData.devices;
		this.locations = roomData.locations;

		//Telnet stuff
		this.ip = ip;
		this.login = {
			user: user,
			pass: pass
		}
		this.dataBuffer = [];
		this.loginTimeout = loginTimeout;
		this.connectionStatus = {
			connected: false,
			login: false
		}
		this.connectTimeout = connectTimeout;
		this.commandTimeout = commandTimeout;
		this.telnetClient = new net.Socket(); //Instantiate telnet server

		this.commandQueue = new deviceCommandQueue("LutronQueue", false, debugMode);

		setInterval(() => {
			if (debugMode && this.commandQueue.queue.length > 0) {
				this.commandQueue.queueDump();
			}
			if (this.commandQueue.hasElemThatCanSendCommand()) {
				let elem = this.commandQueue.getTopElemWithCommand();
				let rawCommand = elem.commandToSend;
				telnetLog("Queue isNot empty, sending command='"+rawCommand+"'");

				this.telnetClient.write(rawCommand+EOL);
			}
		},2000);
	}

	begin() {
		return new Promise((resolve, reject) => {
			//Setup timeout in case server fails to connect
			var connectTimeout,loginTimeout;
			this.connectionStatus.connected = false;
			this.connectionStatus.login = false;
			connectTimeout = setTimeout(() => {
				telnetLog("Connection attempt timed out; killing instance");
				this.connectionStatus.connected = false;
				this.telnetClient.destroy();
				return reject("Connection attempt timed out (Is the IP address correct?)");
			},this.connectTimeout);

			//Setup Handlers
			this.telnetClient.on("data", data => {
				if (!this.isAuthenticated) { //checks for authenticated handler
					telnetLog("got data before auth; sending auth request");
					if (data.indexOf("login:") > -1) { //write the pass or user when prompted
						this.telnetClient.write(this.login.user+EOL);
					} else if (data.indexOf("password:") > -1) {
						this.telnetClient.write(this.login.pass+EOL);
					} else if (data.indexOf("GNET>") > -1) { //got the terminal; we're authenticated
						this.connectionStatus.login = true;
						telnetLog("authentication success");
						clearTimeout(loginTimeout);
						this.isAuthenticated = true;
						return resolve(); //now return ok because hub is connected & authenticated
					}
				} else {
					this.recv(data);
				}
			});
			this.telnetClient.on("close", () => {
				console.log("Telnet client closed the connection; server terminating");
				this.telnetClient.destroy();
				this.connectionStatus.connected = false;
				this.connectionStatus.login = false;
				return reject("Client closed connection");
			});
			this.telnetClient.on("ready", () => {
				telnetLog("ready");
				this.connectionStatus.connected = true;
				this.connectionStatus.login = false;
				loginTimeout = setTimeout(() => {
					telnetLog("Login attempt timed out; killing instance");
					this.telnetClient.destroy();
					this.connectionStatus.connected = false;
					this.connectionStatus.login = false;
					return reject("Login attempt timed out (Is the username/password correct?)");
				},this.loginTimeout);
			})

			//Begin connection
			telnetLog("init connection");
			this.telnetClient.connect(23, this.ip, prompt => {
				telnetLog("Connected@ip="+this.ip);
				clearTimeout(connectTimeout); //remove connect timeout handler
			});
		})
	}

	recv(data) {
		// console.log("Recieved data: "+data);
		if (data.toString().indexOf("GNET>" == -1)) { //only push data with useful info
			this.commandQueue.checkForCompletions(data.toString());
		}
	}

	sendCommand(command = "#OUTPUT", device = 1, action = 1, parameters = undefined) {
		return new Promise((resolve, reject) => {
			if (!this.connectionStatus.connected) {
				return reject("Err: not connected to lights");
			}
			if (!this.connectionStatus.login) {
				return reject("Err: not logged in to lights telnet shell");
			}
			let sendCommand = command+","+device+","+action; //selectively send based on whether there's a parameter
			switch (typeof parameters) { //put in switch to determine what to do with parameters
				case "object":
					for (let i=0; i<parameters.length; i++) {
						sendCommand+=",";
						sendCommand+=parameters[i];
					}
					break;
				case "string":
				case "number":
					sendCommand+=",";
					sendCommand+=parameters;
					break;
			}
			telnetLog("Adding command to queue: "+sendCommand);
			let resp = "~"+sendCommand.substring(1);
			this.commandQueue.addItem(sendCommand, resp, this.commandTimeout).then(resp => {
				telnetLog("LutronQueue returned OK: "+resp);
				return resolve(resp);
			}).catch(e => {
				telnetLog("LutronQueue returned e: "+e);
				return reject(e);
			});
		});
	}

	setLightOutput(device = 2, value = 100, rampTime = "00:05") {
		value = clampPower(value);
		return new Promise((resolve, reject) => {
			this.sendCommand("#OUTPUT",device,1,[value,rampTime]).then(response => {
				return resolve();
			}).catch( e => {
				return reject(e);
			});
		});
	}

	getLightOutput(device = 1) {
		return new Promise((resolve, reject) => {
			this.sendCommand("?OUTPUT",device,1).then(response => {
				for (let i=0; i<response.length; i++) {
					if (response[i].indexOf("~OUTPUT,"+device) > -1) {
						return resolve(response[i].toString().split(",")[3]);
					}
				}
				return reject("OutputCMDResponse did not contain light we were looking for");
			}).catch(e => {
				return reject(e);
			})
		})
	}

	lookupLocation(name = "") {
		name = name.toLowerCase(); //case insensitive
		return new Promise((resolve, reject) => {
			let locationsIndices = Object.keys(this.locations);
			for (let i=0; i<locationsIndices.length; i++) {
				if (locationsIndices[i].toLowerCase() == name) { //indices are names
					return resolve(this.locations[locationsIndices[i]]);
				}
			}
			return reject("Location lookup failed: not found");
		})
	}

	lookupDeviceName(name = "", newPower = 100) { //set power on lookup
		name = name.toLowerCase();
		newPower = clampPower(newPower);
		return new Promise((resolve, reject) => {
			let devicesIndices = Object.keys(this.devices);
			for (let i=0; i<devicesIndices.length; i++) {
				if (devicesIndices[i].toLowerCase() == name) { //indices are names
					if (typeof newPower != "undefined") {
						this.devices[devicesIndices[i]].power = newPower;
					}
					return resolve(this.devices[devicesIndices[i]]);
				}
			}
			return reject("Device lookup failed: name not found");
		})
	}

	lookupDeviceIdentifier(identifier = 0, newPower = 100) {
		newPower = clampPower(newPower);
		return new Promise((resolve, reject) => {
			let devicesIndices = Object.keys(this.devices);
			for (let i=0; i<devicesIndices.length; i++) {
				if (this.devices[devicesIndices[i]].identifier == identifier) { //indices are names
					if (typeof newPower != "undefined") {
						this.devices[devicesIndices[i]].power = newPower;
					}
					return resolve(this.devices[devicesIndices[i]]);
				}
			}
			return reject("Device lookup failed: identifier not found");
		})
	}

	setLocationLight(name = "", value = 100) {
		value = clampPower(value);
		name = name.toLowerCase();
		return new Promise((resolve, reject) => {
			this.lookupLocation(name).then(locationObject => {
				var setLight = index => {
					this.lookupDeviceName(locationObject.devices[index], value).then(device => {
						// console.log("dN: "+device.identifier);
						this.getLightOutput(device.identifier).then(currentValue => {
							let ramp = (value >= currentValue) ? device.rampUpTime : device.rampDownTime;
							// console.log("RampNValue: "+value+" RampOValue: "+currentValue+" Ramp: "+ramp);
							this.setLightOutput(device.identifier, value, ramp).then(() => {
								if (index < locationObject.devices.length-1) { //need to keep iterating
									setLight(index+1);
								} else {
									return resolve(); //now we're done
								}
							}).catch(e => {
								return reject(e);
							});
						}).catch(e => {
							return reject(e);
						})
					}).catch(e => {
						return reject(e); //send reject up chain
					})
				};
				setLight(0); //start recursive function
			}).catch(e => {
				return reject(e);
			})
		})
	}

	getLocationLight(name = "") { //average all devices in location
		name = name.toLowerCase();
		return new Promise((resolve, reject) => {
			this.lookupLocation(name).then(locationObject => {
				var lightAvg = 0;
				var getLight = index => {
					this.lookupDeviceName(locationObject.devices[index]).then(device => {
						// console.log("dN: "+device.identifier);
						this.getLightOutput(device.identifier).then(currentValue => {
							lightAvg+=Number(currentValue);
							if (index < locationObject.devices.length-1) { //need to keep iterating
								getLight(index+1);
							} else {
								lightAvg/=locationObject.devices.length;
								// console.log("lA"+lightAvg);
								return resolve(lightAvg); //now we're done
							}
						}).catch(e => {
							return reject(e);
						})
					}).catch(e => {
						return reject(e); //send reject up chain
					})
				};
				getLight(0); //start recursive function
			}).catch(e => {
				return reject(e);
			})
		})
	}
}

module.exports = telnetM;