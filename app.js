const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

let db = null

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error : ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const check = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'asbjbdbe', async (error, payload) => {
      if (error) {
        response.send('Invalid JWT Token')
      } else {
        // console.log('Correct JWT Token')
        next()
      }
    })
  }
}

//API 1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
        SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400).send('Invalid user')
  } else {
    isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'asbjbdbe')
      response.send({jwtToken})
    } else {
      response.status(400).send('Invalid password')
    }
  }
})

//API 2
app.get('/states/', check, async (req, res) => {
  const getStatesQuery = `
    SELECT state_id as stateId, state_name as stateName, population FROM state;
  `
  const dbResponse = await db.all(getStatesQuery)
  res.send(dbResponse)
})

//API 3
app.get('/states/:stateId/', check, async (req, res) => {
  const {stateId} = req.params
  const getStateQuery = `
    SELECT state_id as stateId, state_name as stateName, population FROM state WHERE state_id='${stateId}';
  `
  const dbResponse = await db.get(getStateQuery)
  res.send(dbResponse)
})

//API 4
app.post('/districts/', check, async (req, res) => {
  const {districtName, stateId, cases, cured, active, deaths} = req.body
  const addDistrictQuery = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES(
      '${districtName}',
      '${stateId}',
      '${cases}',
      '${cured}',
      '${active}',
      '${deaths}'
    );
  `
  await db.run(addDistrictQuery)
  res.send('District Successfully Added')
})

//API 5
app.get('/districts/:districtId/', check, async (req, res) => {
  const {districtId} = req.params
  const getDistrictQuery = `
    SELECT district_id as districtId, district_name as districtName, state_id as stateId, cases, cured, active, deaths FROM district WHERE district_id=${districtId};
  `
  const dbResponse = await db.get(getDistrictQuery)
  res.send(dbResponse)
})

//API 6
app.delete('/districts/:districtId/', check, async (req, res) => {
  const {districtId} = req.params
  const deleteQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId};
  `
  await db.run(deleteQuery)
  res.send('District Removed')
})

//API 7
app.put('/districts/:districtId/', check, async (req, res) => {
  const {districtId} = req.params
  const {districtName, stateId, cases, cured, active, deaths} = req.body

  const updateQuery = `
    UPDATE district
    SET
      district_name='${districtName}',
      state_id=${stateId},
      cases=${cases},
      cured=${cured},
      active=${active},
      deaths=${deaths}
    WHERE district_id=${districtId};
  `
  await db.run(updateQuery)
  res.send('District Details Updated')
})

//API 8
app.get('/states/:stateId/stats/', check, async (req, res) => {
  const {stateId} = req.params
  const getStatsQuery = `
    SELECT SUM(cases) as totalCases, SUM(cured) as totalCured, SUM(active) as totalActive, SUM(deaths) as totalDeaths FROM state NATURAL JOIN district WHERE state_id = ${stateId};
  `
  const dbResponse = await db.get(getStatsQuery)
  res.send(dbResponse)
})

module.exports = app
