const net = require('net');
const EOL = "\r\n"; //end of line to server

class telnetM {
	constructor(ip = "192.168.1.33", user = "lutron", pass = "integration") {
		console.log("Instantiating telnetM with:\nIP:"+ip+"\nUSER:"+user+"\nPASS: "+pass);

		this.ip = ip;
		this.login = {
			user: user,
			pass: pass
		}
		this.telnetClient = new net.Socket(); //Instantiate telnet server	
	}

	begin() {
		return new Promise((resolve, reject) => {
			//Setup Handlers
			this.telnetClient.on("data", data => {
				this.recv(data);
			});

			//Begin connection
			this.telnetClient.connect(23, ip, prompt => {
				this.serverConnected();
				return resolve();
			});
		})
	}

	recv(data) {
		console.log("Recieved data: "+data);
		if (data.contains)
	}

	serverConnected() {
		console.log("Connected to telnet server@ip="+ip);

	}
}

module.exports = telnetM;