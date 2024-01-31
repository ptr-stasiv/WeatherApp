const express = require('express')
const mysql = require("mysql")
const fs = require('fs');
const { dirname } = require('path');
const MOMENT = require( 'moment' );
const app = express()

function randomInRange(min, max) {  
  return Math.floor(
    Math.random() * (max - min) + min
  )
}

const pool = mysql.createPool({
  host: "database-meteo.cjaoo4yk2a0q.eu-central-1.rds.amazonaws.com",
  port: "3306",
  user: 'admin',
  database: 'meteodb',
  password: '12345678',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function executeQuery(sql, values = []) {
  return new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
          if (err) {
              return reject(err);
          }
          connection.query(sql, values, (err, results) => {
              connection.release();
              if (err) {
                  return reject(err);
              }
              resolve(results);
          });
      });
  });
}

app.get('/', (req, res) => {

  fs.readFile(__dirname + "/../views/index.html", function (err, html) {
    if (err) {
        throw err; 
    }      

    res.writeHeader(200, {"Content-Type": "text/html"});  
    res.write(html);  
    res.end();  
  });

});

function insertPerTimeData(dayId) {
  const time = MOMENT().format("HH:mm:ss"); 
  const temperatureAir = randomInRange(0, 15);
  const temperatureGround = randomInRange(5, 10);
  const pressure = randomInRange(1000, 1030);
  const humidity = randomInRange(30, 70);
  const wind = randomInRange(4, 13);

  pool.getConnection((err, connection) => {
    connection.query('INSERT INTO meteodb.measurements_hours (measure_time, temperature_air, temperature_ground, pressure, humidity, wind, day_id) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [time, temperatureAir, temperatureGround, pressure, humidity, wind, dayId], (err, results) => {
      if(!err)
      {
        console.log(`New data generated: ${time},  Air: ${temperatureAir}, Ground: ${temperatureGround}, Pressure: ${pressure}, Humidity: ${humidity}, Wind: ${wind}`)
      }

      connection.release();
    });
  });
}

async function generateWeatherData() {
  try{
    const datetime = MOMENT().format('YYYY-MM-DD'); 


    pool.getConnection((err, connection) => {
      connection.query('SELECT id FROM meteodb.measurements_days WHERE measure_day = ?', [datetime], (err, results) => {
          if(!results[0])
          {
            connection.query(`INSERT INTO meteodb.measurements_days (measure_day) VALUES (?)`, [datetime], (err, results) => {              
              connection.query(`SELECT LAST_INSERT_ID() as lastId`, (err, results) => {
                if(!err)
                {
                  insertPerTimeData(results[0].lastId);
                }
              });

            });
          }
          else
          {
            id = results[0]['id'];
            insertPerTimeData(id);
          }

          connection.release();
      });
    });
  }
  catch(err){
    console.error('Error inserting data:', error);
  }
}

generateWeatherData();
setInterval(generateWeatherData, 1800 * 1000);

app.listen(80);