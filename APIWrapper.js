const axios = require("axios")
const jwt = require('jsonwebtoken')
const cookie = require('cookie')
const setCookie = require('set-cookie-parser')
const ENDPOINT = "https://www.services.renault-ze.com/api"

function APIWrapper({username, password}) {
  this.user = {
    username, password
  }
  this.isLoading = false
  this.jwt = null
  this.jwtExpiration = null
  this.refreshToken = null
  this.xsrfToken = null
  this.VIN = null
}

APIWrapper.prototype.login = function () {
  return new Promise(async (resolve, reject) => {
    try {
      const { username, password } = this.user
      const res = await axios.post(ENDPOINT + "/user/login", { username, password })
      const { token, xsrfToken, user } = res.data
      this.jwt = token
      this.xsrfToken = xsrfToken
      this.VIN = user.vehicle_details.VIN

      this.jwtExpiration = parseJWTExpiration(this.jwt)
      this.refreshToken = parseRefreshToken(res)

      resolve(200)
    } catch (e) {
      reject(e.response)
    }
  })
}

APIWrapper.prototype.handleTokenRefresh = function () {
  return new Promise(async (resolve, reject) => {
    try {
      this.isLoading = true
      const res = await axios(ENDPOINT + "/user/token/refresh", {
        method: 'POST',
        headers: {
          'X-XSRF-TOKEN': this.xsrfToken,
          'Cookie': cookie.serialize('refreshToken', this.refreshToken.value)
        }
      })
      this.jwt = res.data.token
      this.jwtExpiration = parseJWTExpiration(this.jwt)
      this.refreshToken = parseRefreshToken(res)

      this.isLoading = false
      resolve(200)
      this.log('ZOE Token refreshed')
    } catch (e) {
      this.isLoading = false
      reject(e)
    }
  })
}

APIWrapper.prototype.getBatteryStatus = function () {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await axios.get(ENDPOINT + `/vehicle/${this.VIN}/battery`, authHeader(this.jwt))
      resolve(res.data)
    } catch (e) {
      reject(e)
    }
  })
}

APIWrapper.prototype.startCharging = function () {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await axios.post(ENDPOINT + `/vehicle/${this.VIN}/charge`, {}, authHeader(this.jwt))
      resolve(res.status)
    } catch (e) {
      reject(e)
    }
  })
}

APIWrapper.prototype.preconditionNow = function () {
  return new Promise(async (resolve, reject) => {
    try {
      await axios.post(ENDPOINT + `/vehicle/${this.VIN}/air-conditioning`, {}, authHeader(this.jwt))
      last = await axios.get(ENDPOINT + `/vehicle/${this.VIN}/air-conditioning/last`, authHeader(this.jwt))
      resolve(last)
    } catch (e) {
      reject(e)
    }
  })
}

APIWrapper.prototype.lastPrecondition = function () {
  return new Promise(async (resolve, reject) => {
    try {
      const last = await axios.get(ENDPOINT + `/vehicle/${this.VIN}/air-conditioning/last`, authHeader(this.jwt))
      resolve(last.data)
    } catch (e) {
      reject(e)
    }
  })
}

function authHeader(jwt) {
  return {
    headers: {
      'Authorization': 'Bearer ' + jwt
    }
  }
}

function parseRefreshToken(res) {
  const cookies = setCookie.parse(res, { map: true })
  return cookies.refreshToken
}

function parseJWTExpiration(token) {
  const decoded = jwt.decode(token)
  return decoded.exp
}

module.exports = APIWrapper
