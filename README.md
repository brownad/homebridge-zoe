# homebridge-zoe
*Renault updated the API however the APP is not available in the UK. So this is going to be broken until I can see the APP.  If anyone has sight of the API and can test, PR would be most welcome!*

`homebridge-zoe` is a plugin for Homebridge.  Providing Renault Zoe owners with simple access and basic controls to your EV car options as presented by the public Renault site on:

https://www.services.renault-ze.com/api

* Pre-conditioning (Fan / switch service)
* Battery Charge % (Humidity service)
* Battery Service (Low battery warning alert)
* Charge Activated (Switch service)
* Contact for Plug (Contact service)
* Range (Temperature service)

The sensors surface the basic information from the API however the type of sensors are far from ideal to represent information with the correct units e.g. range.  PRs always welcome.  The set `interval` determines how frequently the Renault API is checked.  It will stop responding if too frequent, hence there is no on-demand check when accessories are loaded, it is timer based currently.  This uses the legacy API currently (UK users).

# Installation
If you are new to Homebridge, please first read the Homebridge [documentation](https://www.npmjs.com/package/homebridge).

1 Install Homebridge:

`sudo npm install -g homebridge`

2 Install homebridge-zoe:

`sudo npm install -g homebridge-zoe`

3 Configure the plugin

Edit your `config.json` as below and restart your `Homebridge` instance.

# Configuration

```json
"accessories": [
  {
    "accessory": "Renault ZOE",
    "name": "Renault ZOE",
    "username": "",
    "password": "",
    "vin": "",
    "interval": "900000",
    "low_battery_level": "40",
    "distance": "miles"
  }
]
```
Distance can be `km`, `kilometres` or `miles`.  Default is `miles`.

# Credits

https://git.cocoanetics.com/labs/HomeBridgePlugins
