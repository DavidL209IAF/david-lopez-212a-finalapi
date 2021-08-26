const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const app = express();
require('dotenv').config();

const port = process.env.PORT;
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

app.use(async function(request, response, next){
try{
    request.db = await pool.getConnection();
    request.db.connection.config.namedPlaceholders = true;

    await request.db.query(`SET SESSION sql_mode = "TRADITIONAL"`);
    await request.db.query(`SET time_zone = '-8:00'`);
    await next();

    request.db.release();
} catch (error){
    console.log(error);

    if (request.db) request.db.release();
    throw error;
}
})

app.use(cors());
app.use(express.json());


//get car by id
app.get('/car/:id', async function(request, response){
    try{
        let queryId = request.params;
        let query = "SELECT * FROM car WHERE id = " + queryId.id;
        const [rows] = await request.db.query(query)
        response.json({message: "Record successfully returned. " , rows})
    } catch (error){

    }
});

//get all cars
app.get('/car', async function(request, response){
    try{
        const [rows] = await request.db.query("SELECT * FROM car")
        response.json({message: "All rows successfully returned. " , rows})
    } catch (error){

    }
});

//add car
app.post('/car', async function(request, response){
    try {
        const { make, model, year} = request.body;
        const query = await request.db.query(
        `INSERT INTO car (make, model, year, deleted_flag)
         VALUES (:make, :model, :year, 0)`,
         { make, model, year});
         
         response.json({message: 'Car with make: ' +
          make + ' model: ' + model + ' year: ' + year + ' has been added.', query});
        
        } catch (error){
            console.log(error)
        }
})

//delete car by id
app.delete('/car/:id', async function(request, response){
    try{
        const { id } = request.params
        const query = await request.db.query(
            `UPDATE car set deleted_flag = 1 WHERE
            id = :id`,
            {id});
            response.json({message: 'Car with id: ' + id + " has been set to be deleted.", query});
    } catch (error){
        console.log(error)
    }

})






app.listen(port, () => console.log(`Listening on port ${port}`))


