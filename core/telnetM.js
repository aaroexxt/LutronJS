const net = require('net');
const EOL = "\r\n"; //end of line to server

const telnetLog = log => {
	console.log("TelnetClient: "+log);
}
class telnetM {
	constructor(ip = "192.168.1.33", user = "lutron", pass = "integration", roomData = {}, loginTimeout = 2000, connectTimeout = 1000) {
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
		this.connectTimeout = connectTimeout;
		this.telnetClient = new net.Socket(); //Instantiate telnet server
	}

	begin() {
		return new Promise((resolve, reject) => {
			//Setup timeout in case server fails to connect
			var connectTimeout,loginTimeout;
			connectTimeout = setTimeout(() => {
				telnetLog("Connection attempt timed out; killing instance");
				this.telnetClient.destroy();
				return reject("Connection attempt timed out (Is the IP address correct?)");
			},this.connectTimeout);

			//Setup Handlers
			this.telnetClient.on("data", data => {
				if (!this.isAuthenticated) { //checks for authenticated handler
					if (data.indexOf("login:") > -1) { //write the pass or user when prompted
						this.telnetClient.write(this.login.user+EOL);
					} else if (data.indexOf("password:") > -1) {
						this.telnetClient.write(this.login.pass+EOL);
					} else if (data.indexOf("GNET>") > -1) { //got the terminal; we're authenticated
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
				return reject("Client closed connection");
			});
			this.telnetClient.on("ready", () => {
				telnetLog("ready");
				loginTimeout = setTimeout(() => {
					telnetLog("Login attempt timed out; killing instance");
					this.telnetClient.destroy();
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
		console.log("Recieved data: "+data);
		this.dataBuffer.push(data);
	}

	sendCommand(command = "#OUTPUT", device = 1, action = 1, parameters = undefined) {
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
		telnetLog("Sending command: "+sendCommand)
		this.telnetClient.write(sendCommand+EOL); //Make sure to send EOL so server understands
	}

	setLightOutput(device = 2, value = 100, rampTime = "00:05") {
		return new Promise((resolve, reject) => {
			this.sendCommand("#OUTPUT",device,1,[value,rampTime]);
			this.waitUntilRecv().then(response => {
				return resolve();
			}).catch( e => {
				return reject(e);
			})
		});
	}

	getLightOutput(device = 1) {
		return new Promise((resolve, reject) => {
			this.sendCommand("?OUTPUT",device,1);
			this.waitUntilRecv().then(response => {
				for (let i=0; i<response.length; i++) {
					if (response[i].indexOf("~OUTPUT,"+device) > -1) {
						return resolve(response[i].toString().split(",")[3]);
					}
				}
				return reject("Couldn't get value of device; didn't show up in data (data="+response+")");
			}).catch(rj => {
				return reject(rj); //pass error up chain
			});
		})
	}

	waitUntilRecv(timeout = 10000) {
		return new Promise((resolve, reject) => {
			var oldBuffer = JSON.parse(JSON.stringify(this.dataBuffer)); //somewhat hacky solution to not have oldBuffer directly reference memory address of this.dataBuffer
			var recvTimeout = setTimeout(() => {
				clearInterval(dataInterval);
				return reject("DataBuffer timeout: no events");
			},timeout);
			var dataInterval = setInterval(() => {
				if (this.dataBuffer.length != oldBuffer.length) {
					let currentDB = this.dataBuffer;
					this.dataBuffer = []; //clear DataBuffer

					clearInterval(dataInterval); //clear timeouts & intervals
					clearTimeout(recvTimeout);
					return resolve(currentDB); //resolve function
				} else {
					console.log(this.dataBuffer.length,oldBuffer.length);
				}
				oldBuffer = JSON.parse(JSON.stringify(this.dataBuffer)); //somewhat hacky solution to not have oldBuffer directly reference memory address of this.dataBuffer
			},50);
		})
	}

	lookupLocation(name = "") {
		return new Promise((resolve, reject) => {
			let locationsIndices = Object.keys(this.locations);
			for (let i=0; i<locationsIndices.length; i++) {
				if (locationsIndices[i] == name) { //indices are names
					return resolve(this.locations[locationsIndices[i]]);
				}
			}
			return reject("Location lookup failed: not found");
		})
	}

	lookupDeviceName(name = "", newPower = 100) { //set power on lookup
		name = name.toLowerCase();
		return new Promise((resolve, reject) => {
			let devicesIndices = Object.keys(this.devices);
			for (let i=0; i<devicesIndices.length; i++) {
				if (devicesIndices[i].toLowerCase() == name) { //indices are names
					this.devices[devicesIndices[i]].power = newPower;
					return resolve(this.devices[devicesIndices[i]]);
				}
			}
			return reject("Device lookup failed: name not found");
		})
	}

	lookupDeviceIdentifier(identifier = 0, newPower = 100) {
		console.log(this.devices);
		return new Promise((resolve, reject) => {
			let devicesIndices = Object.keys(this.devices);
			for (let i=0; i<devicesIndices.length; i++) {
				if (this.devices[devicesIndices[i]].identifier == identifier) { //indices are names
					this.devices[devicesIndices[i]].power = newPower;
					return resolve(this.devices[devicesIndices[i]]);
				}
			}
			return reject("Device lookup failed: identifier not found");
		})
	}

	setLocationLight(name = "", value = 100) {
		name = name.toLowerCase();
		return new Promise((resolve, reject) => {
			this.lookupLocation(name).then(locationObject => {
				var setLight = index => {
					this.lookupDeviceName(locationObject.devices[index], value).then(device => {
						this.getLightOutput(device.identifier).then(currentValue => {
							let ramp = (value >= currentValue) ? device.rampUpTime : device.rampDownTime;
							console.log("RampNValue: "+value+" RampOValue: "+currentValue+" Ramp: "+ramp);
							this.setLightOutput(device.identifier, value, ramp).then(() => {
								if (index < locationObject.devices.length-1) { //need to keep iterating
									setLight(index+1);
								} else {
									return resolve(); //now we're done
								}
							}).catch(e => {
								return reject(e);
							});
						}).catch( e => {
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
}

module.exports = telnetM;