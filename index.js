const getUnixTime = require('date-fns/getUnixTime')
const APIWrapper = require('./APIWrapper') 
let Service, Characteristic


module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  
  homebridge.registerAccessory("homebridge-zoe", "Renault ZOE", ZOE)
}

class ZOE {
	constructor(log, config) {

	this.log = log
	this.config = config

	// create the API for Renault Services
    	this.api = new APIWrapper({ username: this.config["username"], password: this.config["password"]})
    
    	this.interval = null
	this.intervalDuration = config["interval"] || 1800000
	this.low_battery_level = config["low_battery_level"] || 40
	this.vin = config["vin"] || "VIN"
	this.distance = config["distance"] || "miles"
		
    	// some internal state
    	this.state = {
      	validUser: null,
      	last_battery_level: null,
      	preconditionTimestamp: null,
      	charging: false
    }

	// Configure Services
	this.battery = new Service.BatteryService()
	this.contact = new Service.ContactSensor("Plug")
	this.motion = new Service.MotionSensor("Battery")
	this.fan = new Service.Switch("Pre-condition", "710a5278-f72c-11e9-8f0b-362b9e155667")
	this.charge = new Service.Switch("Charge", "7a1037de-f72c-11e9-8f0b-362b9e155667")
	this.humidityService = new Service.HumiditySensor("Charge")
	this.range = new Service.TemperatureSensor("Range")
		
	this
	  .login()
	  .then(res => {
	    this.updateBattery()
	    this.updateFan()
	  }).catch(e => {
	    this.log("Login Error")
	    this.log(e)
	    this.state.validUser = false
	  })	
  }

  login() {
    return new Promise((resolve, reject) => {
      this.api
        .login()
        .then(res => {
          this.log("Successful Auth")
          this.state.validUser = true
          this.startInterval()
          resolve()
        })
        .catch(e => {
          clearInterval(this.interval)
          reject(e)
        })
    })
  }
  
  startInterval() {
    this.interval = setInterval(() => {
	    
      this.api
        .login()
        .then(res => {
          this.updateBattery()
          this.updateFan()
        })
        .catch(e => {
          reject(e)
        })
    }, this.intervalDuration)
  }

	
  getServices() {
    const information = 
      new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, "Renault")
        .setCharacteristic(Characteristic.Model, "ZOE")
        .setCharacteristic(Characteristic.SerialNumber, this.vin)
  
	  this.battery.getCharacteristic(Characteristic.BatteryLevel)
	    .on('get', this.getBattery.bind(this))
  
	  this.battery.getCharacteristic(Characteristic.ChargingState)
      	    .on('get', this.getChargingState.bind(this))

	  this.fan.getCharacteristic(Characteristic.On)
            .on('get', this.getFan.bind(this))
            .on('set', this.setFan.bind(this))

	  this.charge.getCharacteristic(Characteristic.On)
           .on('get', this.getCharge.bind(this))
           .on('set', this.setCharge.bind(this))
	  
	  this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity) 
	  
	  this.range.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({ minValue: 0, maxValue: 300 })
	    
	  return [information, this.battery, this.motion, this.contact, this.fan, this.charge, this.humidityService, this.range]
  }

  getBattery(cb) {
    cb(null, this.last_battery_level)
  }

  getChargingState = (cb) => {
    cb(null, this.state.charging)
  }

  async updateBattery() {
    if (!this.state.validUser) return

    if (this.jwtInvalid() && !this.api.isLoading) {
      try {
        if (this.refreshTokenValid()) {
          await this.api.handleTokenRefresh()
        } else {
          await this.login()
        }
      } catch (e) {
        this.log(e)
        return
      }
    }

    this.api
      .getBatteryStatus()
      .then(response => {
	
	//todo check if this.distance is miles or km
	if (this.distance === "km" || this.distance === "kilometres") {
	  var range = Math.round(Number(response.remaining_range) )
	} else {
	  var range = Math.round(Number(response.remaining_range) * 0.62) 
	}	  
	
	var battery = Number(response.charge_level)
	var battery_warning = battery <= this.low_battery_level
        this.battery.getCharacteristic(Characteristic.BatteryLevel).updateValue(battery)
	this.log("Battery level " + battery)
	this.log("ZOE range " + range)
	this.log("ZOE warning level " + battery_warning + " value threshold " + this.low_battery_level)
	this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(battery)
        this.battery.getCharacteristic(Characteristic.StatusLowBattery).updateValue(battery <= this.low_battery_level)
	this.range.getCharacteristic(Characteristic.CurrentTemperature).updateValue(range, null)
	    
        if (response.plugged) {
          this.log("plugged in")
          this.contact.getCharacteristic(Characteristic.ContactSensorState).updateValue(Characteristic.ContactSensorState.CONTACT_DETECTED)
          this.motion.getCharacteristic(Characteristic.MotionDetected).updateValue(false)
        } else {
          this.log("is not plugged in")
          this.contact.getCharacteristic(Characteristic.ContactSensorState).updateValue(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED)
          if (this.state.last_battery_level && this.state.last_battery_level < battery) {
            this.motion.getCharacteristic(Characteristic.MotionDetected).updateValue(true)
          } else {
            this.motion.getCharacteristic(Characteristic.MotionDetected).updateValue(false)
          }
        }

        this.state.last_battery_level = battery
        this.state.charging = response.charging

        if (response.charging) {
          this.log("is charging")
          this.charge.getCharacteristic(Characteristic.On).updateValue(true)
        } else {
          this.log("is not charging")
          this.charge.getCharacteristic(Characteristic.On).updateValue(false)
        }

        if (response.plugged) {
          if (response.charging) {
            this.log("Battery: Charging")
            this.battery.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING)
          } else {
            this.log("Battery: Not Charging")
            this.battery.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
          }
        } else {
          this.log("Battery: Not Chargeable")
          this.battery.getCharacteristic(Characteristic.ChargingState).updateValue( Characteristic.ChargingState.NOT_CHARGEABLE)
        }
      })
      .catch(e => {
        this.log("Error in UpdateBattery")
        this.log(e)
      })
  }

  getFan(cb) {
    cb(null, this.isPreconditioning())
  }

  async setFan(value, cb) {

    if (!this.state.validUser) {
      cb(null)
      return
    }

    if (this.jwtInvalid() && !this.api.isLoading) {
      try {
        if (this.refreshTokenValid()) {
          await this.api.handleTokenRefresh()
        } else {
          await this.login()
        }
      } catch (e) {
        this.log(e)
        cb(null)
        return
      }
    }

    this.api
      .preconditionNow()
      .then(response => {


        if (response.result == "SUCCESS") {
          this.log("Pre-condition was set")
          this.state.preconditionTimestamp = this.parsePreconditionTimestamp(response["date"])
          cb(null, true)
        } else {
          this.log("Pre-condition unset")
          this.state.preconditionTimestamp = null
          cb(null, false)
        }
      })
      .catch(e => {
        this.log("Error in setFan")
        this.log(e)

        cb(null, value)
      })
  }

  async updateFan() {
	if (!this.state.validUser) return
	    this.log('User is valid')
	  if (this.jwtInvalid() && !this.api.isLoading) {
	    try {
	  if (this.refreshTokenValid()) {
	    this.log('Token is to be refreshed')
	    await this.api.handleTokenRefresh()
	  } else {
	    this.log('Login is initiated')
	    await this.login()
	    }
	  }catch (e) {
	     this.log(e)
	     return
	  }
    }

    this.api
      .lastPrecondition()
      .then(response => {

        if (response.result == "SUCCESS") {
          const newTimestamp = this.parsePreconditionTimestamp(response["date"])
          if (newTimestamp > this.state.preconditionTimestamp) {
            this.state.preconditionTimestamp = newTimestamp
          }
          const now = getUnixTime(new Date())

          if (this.state.preconditionTimestamp > now) {
            this.log("is preconditioning now")
            this.fan.getCharacteristic(Characteristic.On).updateValue(true)
          } else {
            this.log("is not preconditioning any more")
            this.fan.getCharacteristic(Characteristic.On).updateValue(false)
          }
        } else {
          this.log("failed last precondition request")
          this.state.preconditionTimestamp = null
          this.fan.getCharacteristic(Characteristic.On).updateValue(false)
        }
      })
      .catch(e => {
        this.log("error in updateFan")
        this.log(e)
      })
  }

  getCharge(cb) {
    cb(null, this.state.charging)
  }

  async setCharge(value, cb) {

    if (!this.state.validUser) {
      cb(null, false)
      return
    }

    if (this.jwtInvalid() && !this.api.isLoading) {
      try {
        if (this.refreshTokenValid()) {
          await this.api.handleTokenRefresh()
        } else {
          await this.login()
        }
      } catch (e) {
        this.log(e)
        if (res !== 200) {
          cb(null, false)
          return
        }
      }
    }

    if (this.state.charging) {
      cb(null, true)
      return
    }

    this.api
      .startCharging()
      .then(status => {
        if (status === 202) {
          this.state.charging = true
          cb(null, true)
        } else {
          this.state.charging = false
          cb(null, false)
        }
      })
      .catch(e => {
        this.log("error in setCharge")
        this.log(e)
      })
  }

  isPreconditioning() {
    const now = getUnixTime(new Date())
    return this.state.preconditionTimestamp && this.state.preconditionTimestamp > now
  }

  parsePreconditionTimestamp(milliseconds) {
    return milliseconds / 1000 + 300
  }

  jwtInvalid() {
    const now = getUnixTime(new Date())
    return !(this.api.jwtExpiration - 60 > now)
  }

  refreshTokenValid() {
    return this.api.refreshToken.expires > new Date()
  }
}
