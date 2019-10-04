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

### Update Script (For Aaron)
```
	cd /home/pi/Desktop;
	sudo rm -R LutronJS;
	git clone https://github.com/aaroexxt/LutronJS.git;
	sudo cp -R BAK/node_modules LutronJS/node_modules;
	sudo cp BAK/package-lock.json LutronJS/package-lock.json;
	cd LutronJS;
	sudo killall node;
	nohup sudo node main.js &
```

## Demo Image
![DemoImage](/images/demo.png)
