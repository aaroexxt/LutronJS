# LutronJS
 Telnet wrapper that exposes the Lutron Caseta system in my house using a REST API

## Installation Instructions:
1) Clone this repo onto your computer
2) Install required packages using your favorite package manager:
 - Express
 - EJS
 - Net
 - BodyParser
 - CORS
 - Path
3) Run the "main.js" script. I like to use ```nohup sudo node main.js &``` so that it runs in the background
Enjoy!
4) **IMPORTANT: you need to configure your home setup in roomData.json, otherwise this will not work. You need the light identifier number that you can find in the Lutron mobile app (Settings -> Advanced Settings -> Integration -> Send Integration Support, identifier number = "ID" parameter in that JSON file). In addition, make sure the "Telnet Support" switch is toggled on.**

### Update/Install Script (For Aaron mostly)
```
	sudo apt-get install -y avahi-daemon;
	cd /home/pi/Desktop;
	sudo rm -R LutronJS;
	git clone https://github.com/aaroexxt/LutronJS.git;
	sudo cp -R BAK/node_modules LutronJS/node_modules && sudo cp BAK/package-lock.json LutronJS/package-lock.json || (cd LutronJS && npm i express ejs net body-parser cors path);
	sudo mkdir BAK;
	sudo cp -R LutronJS/node_modules BAK/node_modules;
	sudo cp LutronJS/package-lock.json BAK/package-lock.json;
	cd LutronJS;
	sudo killall node;
	nohup sudo node main.js &
```
This script will download & install LutronJS (and its dependencies, which are cached in a folder called BAK for faster update) before running it.

## Demo Image
![DemoImage](/images/demo.png)
