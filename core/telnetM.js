const telnet = require('telnet-client');

//Instantiate telnet server
const server = new telnet();
const EOL = "\r\n"; //end of line to server

class telnetM {
	constructor(ip = "192.168.1.33", user = "lutron", pass = "integration") {
		console.log("Instantiating telnetM with:\nIP:"+ip+"\nUSER:"+user+"\nPASS: "+pass);

		//Data handler
		server.on("data", data => {
			this.recv(data);
		});

		//Login
		server.on("connect", () => {
			server.exec(user+EOL);
			server.exec(pass+EOL);
			this.serverConnected();
		});

		server.connect({
			host: ip,
			port: 23
		})
	}

	recv(data) {
		console.log("Recieved data: "+data);
	}

	serverConnected() {
		console.log("Server connected!");
	}
}

module.exports = telnetM;