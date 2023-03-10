const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async (request, response) => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};

initializeDbAndServer();

// API 1   user login
// get jwt token using jsonwebtoken package
// const jwtToken = jwt.sign(payload,secret_key)
// here payload is user information

// scenarios
// 1. if an unregistered user tries to login
// 2. if user provides an incorrect password
// 3. successful login of the user

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userDetailsQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(userDetailsQuery);

  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Authentication with token

// scenarios
// 1. If the token is not provided by the user or an invalid token
// 2. After successful verification of token proceed to next middleware or handler
// get jwt token from headers and validate using jwt.verify

const authenticateToken = (request, response, next) => {
  let jwtToken = null;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertStateDbObjectToResponse = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponse = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// API 2
// Returns a list of all states in the state table
// get the results if the user has authentication

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`;
  const getStates = await db.all(getStatesQuery);
  response.send(
    getStates.map((eachState) => convertStateDbObjectToResponse(eachState))
  );
});

// API 3
// Returns a state based on the state ID

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `SELECT * FROM state WHERE state_id = ${stateId}`;
  const getStateDetails = await db.get(getStateDetailsQuery);
  response.send(convertStateDbObjectToResponse(getStateDetails));
});

// API 4
// Create a district in the district table, district_id is auto-incremented
// only authenticated users can post the data

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
        INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
        VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths})
    `;
  const createDistrict = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// API 5
// Returns a district based on the district ID

app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictIdQuery = `SELECT * FROM district WHERE district_id = ${districtId}`;
    const getDistrictIdQueryResponse = await db.get(getDistrictIdQuery);
    response.send(
      convertDistrictDbObjectToResponse(getDistrictIdQueryResponse)
    );
  }
);

// API 6
// Deletes a district from the district table based on the district ID

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId}`;
    const deleteDistrict = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API 7
// Updates the details of a specific district based on the district ID
// only authenticated users can update the data

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE district SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE district_id = ${districtId}
    `;
    const updateDistrictQueryResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// API 8
// Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatesStatsQuery = `
        SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured,
            SUM(active) AS totalActive, SUM(deaths) AS totalDeaths
        FROM district
        WHERE state_id = ${stateId}
    `;
    const getStatesStatsQueryResponse = await db.get(getStatesStatsQuery);
    response.send(getStatesStatsQueryResponse);
  }
);

module.exports = app;
