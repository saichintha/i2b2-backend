# i2b2 Backend API Server
This repository contains the API implementations used by the `i2b2-client-react` project. It runs on Express and Sequelize ORM. Various API route handlers are implemented to retrive patient data, given various parameters.

## Precondition
The [i2b2 demo database](https://github.com/i2b2/i2b2-data) need to be installed on a PostgreSQL Database. Oracle or SQL Server are also available thorugh the demo database, however, the Sequelize ORM configuration will need to be changed accordingly. Currently the project is setup for a PostgreSQL installation of the i2b2 demo database.

NPM (Node Package Manager) needs to be installed.

Note: The PMData in the i2b2 demo database is not required to successfully run the project.

## Usage
Clone the project and make sure the PostgreSQL database is running. Configure the database connection in `app.js` and then run the commands below 
```
npm install
node app.js
```

Corresponding output should look like
```
App listening on port 9000
Press Ctrl+C to quit.
Executing (default): SELECT 1+1 AS result
Connection has been established successfully.
```
