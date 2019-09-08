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

	sendCommand(command = "#OUTPUT", device = 1, action = 1, parameter = "") {
		let sendCommand = command+","+device+","+action+((typeof parameter != "undefined") ? ","+parameter : "");
		telnetLog("Sending command: "+sendCommand)
		this.telnetClient.write(sendCommand); //selectively send based on whether there's a parameter
	}

	setLightOutput(device = 2, value = 100) {
		this.sendCommand("#OUTPUT",device,1,value);
	}

	getLightOutput(device = 1) {
		return new Promise((resolve, reject) => {
			this.sendCommand("?OUTPUT",device,1);
			this.waitUntilRecv().then(response => {
				return resolve(response);
			}, rj => {
				return reject(rj); //pass error up chain
			})
		})
	}

	waitUntilRecv(timeout = 10000) {
		return new Promise((resolve, reject) => {
			var oldBuffer = [];
			var recvTimeout = setTimeout(() => {
				clearInterval(dataInterval);
				return reject("DataBuffer timeout: no events");
			},timeout);
			var dataInterval = setInterval(() => {
				if (this.dataBuffer != oldBuffer) {
					let currentDB = this.dataBuffer;
					this.dataBuffer = []; //clear DataBuffer

					clearInterval(dataInterval); //clear timeouts & intervals
					clearTimeout(recvTimeout);
					return resolve(currentDB); //resolve function
				}
				oldBuffer = this.dataBuffer;
			});
		})
	}
}

module.exports = telnetM;