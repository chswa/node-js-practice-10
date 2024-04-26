const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

app.use(express.json())

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

const authenticateAccessToken = (request, response, next) => {
  const authHeader = request.headers['authorization']
  let jwtToken
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'my_secret', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//user login api

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
  SELECT * FROM user WHERE username='${username}'`

  const dbUser = await db.get(selectUserQuery)
  //console.log(dbUser)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)

    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'my_secret')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateAccessToken, async (request, response) => {
  const getStatesQuery = `
  SELECT state_id as stateId,state_name as stateName,population FROM state`

  const statesArray = await db.all(getStatesQuery)
  response.send(statesArray)
})

app.get(
  '/states/:stateId/',
  authenticateAccessToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateQuery = `
  SELECT * FROM state WHERE state_id=${stateId}`
    const state = await db.get(getStateQuery)
    response.send(state)
  },
)

app.post('/districts/', authenticateAccessToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const createDistrictQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
   VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths})`

  await db.run(createDistrictQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticateAccessToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT district_id as districtId,district_name as districtName,
  state_id as stateId,cases,cured,active,deaths FROM district WHERE district_id=${districtId}`
    const district = await db.get(getDistrictQuery)
    response.send(district)
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateAccessToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id=${districtId}`
    await db.run(deleteDistrictQuery)

    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateAccessToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `UPDATE
      district 
      SET district_name=${districtName} 
  state_id=${stateId},
  cases=${cases},cured=${cured},active=${active},
  deaths=${deaths} WHERE district_id=${districtId}`

    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateAccessToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatesStatsQuery = `SELECT SUM(cases) as totalCases,
  SUM(cured) as totalCured,SUM(active) as totalActive,SUM(deaths) as totalDeaths FROM district
  WHERE state_id=${stateId}`

    const stats = await db.get(getStatesStatsQuery)
    response.send(stats)
  },
)

module.exports = app
