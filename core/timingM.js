const http = require('http');

const timingLog = log => {
	console.log("Timer: "+log);
}

class timingM {
	constructor(tsArr, hubInstance) {
		console.log("timingM instantiated");
		this.tsArr = tsArr;
		this.hubInstance = hubInstance;

		//Save reference to "this"
		var self = this;

		//Determine local time by first getting public IP addr
		this.ipAddr = "0.0.0.0";
		this.ipLoc = "";
		http.get({
			host: 'ipv4bot.whatismyipaddress.com',
			port: 80,
			path: '/'
		}, function(res) {
			if (res.statusCode != 200) {
				console.error("unable to get IpAddr; exiting");
				process.exit(1);
			}

			res.on("data", function(chunk) {
				self.ipAddr = chunk;
				timingLog("Ip Addr get OK");
				self.checkEvents(); //check for outstanding events
			});
		}).on('error', function(e) {
			console.error("unable to get IpAddr; exiting (e= "+e.message+")");
			process.exit(1);
		});

		//First we need to convert times to 24h date format
		var times = [];
		var level = [];
		var devices = [];
		for (let i=0; i<tsArr.length; i++) {
			let rawTime = tsArr[i].at;
			//Parse time
			let splitTime = rawTime.split(",");
			let parsedHours = Number(splitTime[0].split(":")[0]);
			let parsedMinutes = Number(splitTime[0].split(":")[1]);

			if (splitTime[1].toLowerCase() == "pm") {
				parsedHours+=12;
			} else if (parsedHours == 12 && splitTime[1].toLowerCase() == "am") {
				parsedHours = 0; //12am special case
			}

			times.push([parsedHours,parsedMinutes]);

			let maxLevel = tsArr[i].maxLevel;
			//let minLevel = tsArr[i].minLevel; TODO MINLEVEL
			level.push(maxLevel);

			let deviceList = tsArr[i].devices;
			devices.push(deviceList);
		}
		this.trgTimes = times;
		this.trgLevels = level;
		this.trgDevices = devices;

		this.updateLoop = setInterval(function(){self.checkEvents()},5000); //setup interval handler to check minutes

		
	}

	checkEvents() {
		console.log("CheckEvents called using ipAddr: "+this.ipAddr);
		function reject(e) {
			console.warn("TimerSetting failed during event because "+e);
		}

		this.getCurrentTime().then(time => {
			//Process: once we have time, check which events could potentially be relevant and issue the appropriate request
			for (let i=0; i<this.tsArr.length; i++) {
				if (this.trgTimes[0] == time.hours && this.trgTimes[1] == time.minutes) { //event match
					console.log("TimeEvent at ",time);
					var checkLight = index => {
						this.hubInstance.lookupDeviceName(this.trgDevices[index], this.trgLevels[i]).then(device => {
							console.log("dN: "+device.identifier);
							this.hubInstance.getLightOutput(device.identifier).then(currentValue => {
								let ramp = (this.trgLevels[i] >= currentValue) ? device.rampUpTime : device.rampDownTime;
								
								function finish() {
									if (index < this.trgDevices.length-1) { //need to keep iterating
										checkLight(index+1);
									}
								}
								if (currentValue > this.trgLevels[i]) { //oop device has exceeded threshold then CLAMP it
									this.hubInstance.setLightOutput(device.identifier, this.trgLevels[i], ramp).then(() => {
										finish();
									}).catch(e => {
										return reject(e);
									});
								} else {
									finish();
								}
							}).catch(e => {
								return reject(e);
							})
						}).catch(e => {
							return reject(e); //send reject up chain
						})
					};
					checkLight(0); //start recursive function
				}
			}
		})
	}

	getCurrentTime() {
		return new Promise((resolve, reject) => {
			http.get({
				host: 'worldtimeapi.org',
				port: 80,
				path: '/api/ip/'+this.ipAddr+'.json'
			}, function(res) {
				if (res.statusCode != 200) {
					console.error("Warning: timer unable to get currentTime");
					process.exit(1);
				}

				res.on("data", function(chunk) {
					var d = new Date(JSON.parse(chunk).unixtime*1000);
					return resolve ({hours: d.getHours(), minutes: d.getMinutes()});
				});
			}).on('error', function(e) {
				console.warn("Warning: timer unable to get currentTime (e= "+e.message+")");
			});
		});
	}
}

module.exports = timingM;