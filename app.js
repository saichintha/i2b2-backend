'use strict';
const express = require('express');
const Sequelize = require('sequelize');
var bodyParser = require('body-parser');
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, uid, orgID')
    next();
}

const app = express();
app.enable('trust proxy');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(allowCrossDomain);

var pgp = require('pg-promise')();
var cn = {
    host: 'localhost',
    port: 5432,
    database: 'i2b2',
    user: 'saichintha',
    password: ''
};
var db = pgp(cn);

const sequelize = new Sequelize('i2b2', 'saichintha', '', {
  host: 'localhost',
  dialect: 'postgres',
  dialectOptions: {
    multipleStatements: true
  },
});

sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// sequelize.query("SET search_path TO i2b2metadata;  SELECT c_name, c_fullname, c_basecode, c_visualattributes, c_dimcode FROM i2b2 WHERE LOWER(c_name) LIKE :searchText", {
//   replacements: {searchText: '%loinc:1920%'}
// }).spread((results, metadata) => {
//   console.log(results)
// })

// sequelize.query("SET search_path TO i2b2demodata; SELECT CONCEPT_CD, COUNT (*) FROM (SELECT CONCEPT_CD FROM OBSERVATION_FACT WHERE (CONCEPT_CD LIKE 'DEM|RACE%' OR CONCEPT_CD LIKE 'DEM|AGE%' OR CONCEPT_CD LIKE 'DEM|RELIGION%' OR CONCEPT_CD LIKE 'DEM|LANGUAGE%' OR CONCEPT_CD LIKE 'DEM|SEX%') AND PATIENT_NUM IN (SELECT DISTINCT(PATIENT_NUM) FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:19%')) A GROUP BY concept_cd ORDER BY 1;").spread((results) => {
//   console.log(results);
// });

// sequelize.query("SET search_path TO i2b2demodata; SELECT DISTINCT (PATIENT_NUM) FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:1920-8%'").spread((results) => {
//   console.log(results);
// });

// ------------------------------------------------------------------------- //
const getDimCode = "SET search_path TO i2b2demodata; SELECT CONCEPT_CD FROM concept_dimension WHERE concept_path LIKE '\\i2b2\\Demographics\\Zip codes\\Colorado\\Swink\\81077\\' escape '#';";

const initial = "SET search_path TO i2b2metadata; SELECT c_fullname FROM i2b2 WHERE c_hlevel=$1 AND c_tablename<>'MODIFIER_DIMENSION';";

const example = "SET search_path TO i2b2demodata; SELECT DISTINCT (PATIENT_NUM) FROM OBSERVATION_FACT WHERE CONCEPT_CD IN (SELECT CONCEPT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_PATH LIKE '%Neurologic Disorders (320-389)\\(346) Migraine\\%');";

// ------------------------------------------------------------------------- //
function getPatientsFromBasecode(concept_basecode) {
  return new Promise((resolve, reject) => {
    sequelize.query("SET search_path TO i2b2demodata; SELECT DISTINCT (PATIENT_NUM) FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE :conceptBasecode", {
      replacements: {conceptBasecode: "%"+ concept_basecode + "%"}
    }).spread((results, metadata) => {
      resolve(results.length.toString());
    })
  })
}

function getPatientDemInfo(concept_basecode) {
  return new Promise((resolve, reject) => {
    sequelize.query("SET search_path to i2b2demodata; SELECT CONCEPT_CD, COUNT (*) FROM (SELECT CONCEPT_CD FROM OBSERVATION_FACT WHERE (CONCEPT_CD LIKE 'DEM|RACE%' OR CONCEPT_CD LIKE 'DEM|AGE%' OR CONCEPT_CD LIKE 'DEM|RELIGION%' OR CONCEPT_CD LIKE 'DEM|LANGUAGE%' OR CONCEPT_CD LIKE 'DEM|SEX%') AND PATIENT_NUM IN (SELECT DISTINCT(PATIENT_NUM) FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE :conceptBasecode)) A GROUP BY concept_cd ORDER BY 1;", {
      replacements: {conceptBasecode: "%"+ concept_basecode + "%"}
    }).spread((results, metadata) => {
      resolve(results);
    })
  });
}


// ------------------------------------------------------------------------- //
app.post('/api/groupQuery', (req, res, next) => {
  const queryGroups = JSON.parse(req.body.queryGroups);
  // console.log(queryGroups, typeof(queryGroups));
  var conceptTemplate = "SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%@conceptTemplate%'))";

  var demTemplate = "SELECT CONCEPT_CD, COUNT (*) FROM(SELECT CONCEPT_CD FROM OBSERVATION_FACT WHERE (CONCEPT_CD LIKE 'DEM|RACE%' OR CONCEPT_CD LIKE 'DEM|AGE%' OR CONCEPT_CD LIKE 'DEM|RELIGION%' OR CONCEPT_CD LIKE 'DEM|LANGUAGE%' OR CONCEPT_CD LIKE 'DEM|SEX%') AND PATIENT_NUM IN (@complexQuery)) A GROUP BY concept_cd ORDER BY 1";

  // var finalSQL = "SELECT array_length(array(@stitchedQuery),1);"
  var stitchedQuery = "";

  for (var i in queryGroups) {
    const concept = queryGroups[i];
    var conceptSQL = conceptTemplate.replace('@conceptTemplate', concept);
    if (i > 0) {
      conceptSQL = 'INTERSECT ' + conceptSQL;
    }
    stitchedQuery += conceptSQL
  }

  var finalSQL = demTemplate.replace('@complexQuery', stitchedQuery);
  finalSQL = "SET search_path TO i2b2demodata; " + finalSQL;
  // console.log(finalSQL);

  sequelize.query(finalSQL).spread((results) => {
    // console.log(results);
    res.set('json');
    res.status(200).send(results);
  });
})

app.get('/api/ontologyTree/:level', (req, res, next) => {
  sequelize.query("SET search_path TO i2b2metadata; SELECT c_fullname FROM i2b2 WHERE c_hlevel=:level AND c_tablename<>'MODIFIER_DIMENSION'", {
      replacements: {level: req.params.level}
    }).spread((results, metadata) => {
      res.set('json');
      res.status(200).send(results);
    });
});

app.post('/api/search', (req, res, next) => {
  sequelize.query("SET search_path TO i2b2metadata;  SELECT c_name, c_fullname, c_basecode, c_visualattributes, c_dimcode FROM i2b2 WHERE LOWER(c_name) LIKE :searchText escape '#' LIMIT 20", {
      replacements: {searchText: "%"+ req.body.searchText + "%"}
    }).spread((results, metadata) => {
      res.set('json');
      res.status(200).send(results);
    });
});

app.post('/api/usingBasecode', (req, res, next) => {
  getPatientsFromBasecode(req.body.searchText)
  .then(data => {
    res.set('json');
    res.status(200).send(data);
  })
})

app.post('/api/getPatientDem', (req, res, next) => {
  getPatientDemInfo(req.body.concept_basecode)
  .then(data => {
    res.set('json');
    res.status(200).send(data);
  })
  .catch(err => console.log(err))
})

// ------------------------------------------------------------------------- //

const PORT = process.env.PORT || 9000;
app.listen(process.env.PORT || 9000, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;