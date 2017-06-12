'use strict';
const express = require('express');
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

// ------------------------------------------------------------------------- //
const getDimCode = "SET search_path TO i2b2demodata; SELECT CONCEPT_CD FROM concept_dimension WHERE concept_path LIKE '\\i2b2\\Demographics\\Zip codes\\Colorado\\Swink\\81077\\' escape '#';";

const initial = "SET search_path TO i2b2metadata; SELECT c_fullname FROM i2b2 WHERE c_hlevel=$1 AND c_tablename<>'MODIFIER_DIMENSION';";

const example = "SET search_path TO i2b2demodata; SELECT DISTINCT (PATIENT_NUM) FROM OBSERVATION_FACT WHERE CONCEPT_CD IN (SELECT CONCEPT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_PATH LIKE '%Neurologic Disorders (320-389)\\(346) Migraine\\%');";

// ------------------------------------------------------------------------- //

function getPatientNum(concept_dimcode) {
  return new Promise((resolve, reject) => {
    // console.log('Concept Dimcode', concept_dimcode)
    concept_dimcode = concept_dimcode.replace(/\\/g, "\\\\")
  const query = "SET search_path TO i2b2demodata;  SELECT CONCEPT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_PATH LIKE " + "'%"+ concept_dimcode + "%' ";
  // console.log('Query', query);

      db.query(query)
      .then((data) => {
          // console.log(data);
          var dataArray = data.map(function(row){
            return ("'"+ row.concept_cd + "'");
          })
          // console.log('Data Array', dataArray)
          var sql = "SET search_path TO i2b2demodata; SELECT DISTINCT (PATIENT_NUM) FROM OBSERVATION_FACT WHERE CONCEPT_CD IN ";

          sql = sql + '(';
          for (var i in dataArray) {
            sql = sql + dataArray[i] + ',';
          }
          sql = sql.replace(/.$/,"") + ')';
          // console.log('Prepared final SQL', sql);
          db.query(sql)
                .then((data) => {
                  const len = data.length.toString();
                  console.log('---------------------------------------------');
                  console.log(concept_dimcode, ' - ', len);
                  console.log('---------------------------------------------');
                  resolve(len);
                })
                .catch((err) => reject(err));
          })
          .catch(error => {
              reject(error);
          })
  });
  
}

// ------------------------------------------------------------------------- //

app.get('/api/ontologyTree/:level', (req, res, next) => {
  db.query(initial, [req.params.level])
    .then(data => {
      res.set('json');
      res.status(200).send(data); // print data;
    })
    .catch(error => {
        res.status(500).send(error); // print the error;
    });
});

app.post('/api/search', (req, res, next) => {
  // console.log(req.body.searchText);
  const query = "SET search_path TO i2b2metadata;  SELECT c_name, c_fullname FROM i2b2 WHERE LOWER(c_name) LIKE $1 escape '#' LIMIT 20;";
  const insertSearchText = '%' + req.body.searchText + '%';
  db.query(query, [insertSearchText])
  .then((data) => {
    // console.log(data)
    res.set('json');
    res.status(200).send(data).end();
  })
  .catch((err) => {
    console.log(err);
  })
});

app.post('/api/getp', (req, res, next) => {
  getPatientNum(req.body.concept_dimcode)
  .then((result) => res.status(200).send(result))
  .catch((err) => res.status(500).send(err));
})

app.get('/api/test', (req, res, next) => {
  db.query("SET search_path TO i2b2demodata;  SELECT CONCEPT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_PATH LIKE '%Demographics\\Gender\\Male\\%'  escape '#';")
    .then((data) => {
      var dataArray = data.map(function(row){
        return ("'"+ row.concept_cd + "'");
      })
      // console.log('DataArray after Join', typeof(dataArray.join()), dataArray.join());
      var sql = "SET search_path TO i2b2demodata; SELECT DISTINCT (PATIENT_NUM) FROM OBSERVATION_FACT WHERE CONCEPT_CD IN ";

      // var sql ="SELECT CONCEPT_CD FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE 'DEM|Age%' AND PATIENT_NUM IN (SELECT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD IN "
      
      sql = sql + '(';
      for (var i in dataArray) {
        sql = sql + dataArray[i] + ',';
      }
      sql = sql.replace(/.$/,"") + ')';

      console.log(sql);



      db.query(sql)
      .then((data) => {
        const len = data.length.toString() + ' patients';
        console.log(len)
        res.status(200).send(len);
      })
      .catch((err) => console.log(err));
    })
    .catch(error => {
        console.log(error);
    })
});

// ------------------------------------------------------------------------- //

const PORT = process.env.PORT || 9000;
app.listen(process.env.PORT || 9000, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;