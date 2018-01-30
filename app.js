'use strict';
var fs = require('fs');
const express = require('express');
var obs = require('./obs_patiens.json');
const PATIENT_THRESHOLD = 26;
const https = require('https');

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

const options = {
    cert: fs.readFileSync('cert.pem'),
    key: fs.readFileSync('key.pem')
};

const sequelize = new Sequelize('i2b2', 'postgres', 'saichintha', {
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
    for(var j in queryGroups[i]){
      // console.log('i', i, 'j', j)
      if(i>0 && j==0){
        stitchedQuery += " INTERSECT ";
      }
      const concept = queryGroups[i][j];
      var conceptSQL = conceptTemplate.replace('@conceptTemplate', concept);
      if (j > 0) {
        conceptSQL = ' UNION ' + conceptSQL;
      }
      stitchedQuery += conceptSQL
    }
  }

  var finalSQL = demTemplate.replace('@complexQuery', stitchedQuery);
  finalSQL = "SET search_path TO i2b2demodata; " + finalSQL;

  sequelize.query(finalSQL).spread((results) => {
    console.log(results);
    res.set('json');
    res.status(200).send(results);
  });
})

app.post('/api/commonPattern', (req, res, next) => {
  const queryGroups = JSON.parse(req.body.queryGroups);
  var conceptTemplate = "SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%@conceptTemplate%'))";
  var commonTemplate = "SET search_path TO i2b2demodata; DROP TABLE IF EXISTS temp_common; CREATE temporary TABLE temp_common AS (SELECT DISTINCT concept_cd AS common_concepts, COUNT(DISTINCT patient_num) AS patients FROM observation_fact WHERE patient_num IN (@patient_num) AND concept_cd NOT LIKE '%DEM%' AND concept_cd NOT LIKE '%Affy%' AND concept_cd NOT LIKE '%ICD9:%.%' AND concept_cd NOT LIKE '%birn%' GROUP BY concept_cd ORDER BY COUNT(DISTINCT patient_num) DESC); SELECT * FROM (SELECT DISTINCT ON (common_concepts) common_concepts, name_char, patients FROM (SELECT main.name_char, temp.common_concepts, temp.patients FROM temp_common temp INNER JOIN concept_dimension main ON temp.common_concepts = main.concept_cd) A ORDER BY common_concepts, patients DESC) B ORDER BY patients DESC;";

  var stitchedQuery = "";

  for (var i in queryGroups) {
    for(var j in queryGroups[i]){
      // console.log('i', i, 'j', j)
      if(i>0 && j==0){
        stitchedQuery += " INTERSECT ";
      }
      const concept = queryGroups[i][j];
      var conceptSQL = conceptTemplate.replace('@conceptTemplate', concept);
      if (j > 0) {
        conceptSQL = ' UNION ' + conceptSQL;
      }
      stitchedQuery += conceptSQL
    }
  }

  var commonSQL = commonTemplate.replace('@patient_num', stitchedQuery);
  // console.log("Common SQL");
  // console.log(commonSQL);

  sequelize.query(commonSQL).spread((results) => {
    console.log("Complete Results" + results.length);
    var subset = results.filter(function(concept){
      return obs[concept.common_concepts]['count'] < PATIENT_THRESHOLD;
    });
    console.log("Subset Results" + subset.length);
    res.set('json');
    res.status(200).send(subset);
  })
});

app.get('/api/ontologyTree/:level', (req, res, next) => {
  sequelize.query("SET search_path TO i2b2metadata; SELECT c_fullname FROM i2b2 WHERE c_hlevel=:level AND c_tablename<>'MODIFIER_DIMENSION'", {
      replacements: {level: req.params.level}
    }).spread((results, metadata) => {
      res.set('json');
      res.status(200).send(results);
    });
});

app.post('/api/search', (req, res, next) => {
  console.log('Res', res);
  sequelize.query("SET search_path TO i2b2metadata;  SELECT DISTINCT ON (c_basecode) c_name, c_fullname, c_basecode, c_visualattributes, c_dimcode FROM i2b2 WHERE LOWER(c_name) LIKE :searchText escape '#' LIMIT 20;", {
      replacements: {searchText: "%"+ req.body.searchText + "%"}
    }).spread((results, metadata) => {
      res.set('json');
      res.status(200).send(results);
    });
});

app.post('/api/awesome', (req, res, next) => {
  sequelize.query("SET search_path TO i2b2demodata; DROP TABLE IF EXISTS temp_data; CREATE temporary TABLE temp_data AS (SELECT concept_cd, patients FROM (SELECT concept_cd, COUNT(concept_cd) AS patients FROM (SELECT DISTINCT PATIENT_NUM, CONCEPT_CD FROM OBSERVATION_FACT WHERE CONCEPT_CD IN (SELECT DISTINCT c_basecode FROM i2b2metadata.i2b2 WHERE LOWER(c_name) LIKE :searchText ESCAPE '#')) AS B GROUP BY concept_cd ORDER BY patients DESC) AS A GROUP BY concept_cd, patients ORDER BY patients DESC LIMIT 15); SELECT * FROM (SELECT DISTINCT ON (temp.concept_cd) temp.concept_cd AS c_basecode, temp.patients AS patient_num, main.name_char AS c_name, main.concept_path AS c_fullname FROM temp_data temp INNER JOIN concept_dimension main ON temp.concept_cd = main.concept_cd) A ORDER BY patient_num DESC;", {
      replacements: {searchText: "%"+ req.body.searchText + "%"}
    }).spread((results, metadata) => {
      res.set('json');
      res.status(200).send(results);
    });
});


app.post('/api/common', (req, res, next) => {
  sequelize.query("SELECT DISTINCT concept_cd, COUNT(DISTINCT patient_num) FROM observation_fact WHERE patient_num IN (1000000023, 1000000047, 1000000061) AND concept_cd NOT LIKE '%DEM%' GROUP BY concept_cd ORDER BY COUNT(DISTINCT patient_num) DESC;", {
    replacements: {patients}
  }).spread((results, metadata) => {
    res.set('json');
    res.status(200).send(results);
  })
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

https.createServer(options, app).listen(8443);

module.exports = app;
