// idea is to have homepage /before login
// once logged in /playlist
// /allgame
// /completedgames
// /allgames/new
// /allgames/id/edit


const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
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
app.use(helmet())
app.use(cors());
app.use(express.json());


////////endpoints

//get all games tied to user by id
app.get('/myplaylist', authToken, async function(request, response){

    try{
    const userId  = request.user.userId;
    const [rows] = await request.db.query(`SELECT * FROM games 
    WHERE userId = :userId`, { userId });
    response.json(rows);
}

    catch (error) {
        response.json(error);
    }

})

// //add game
app.post('/allgames/new', authToken, async function(request, response){
    try {
        const { gameName, gameYear, gameDescription,
             gamePlatform, gameStatus, gameImage } = request.body;
        
        const userId = request.user.userId;

        await request.db.query(
        `INSERT INTO games (gameName, gameYear, gameDescription,
             gamePlatform, gameStatus, gameImage, userId)
         VALUES (:gameName, :gameYear, :gameDescription,
            :gamePlatform, :gameStatus, :gameImage, :userId)`,
            { gameName, gameYear, gameDescription,
                gamePlatform, gameStatus, gameImage, userId });

         const [lastAddedGame] = await request.db.query(
            `select * from games where gameId = last_insert_id()`);
         
         response.json(lastAddedGame);

   
        } catch (error){
            response.json(error)
        }
})

// //delete game by gameid and userid
app.delete('/allgames/:gameId', authToken, async function(request, response){
    try{
        const { gameId } = request.params
        const userId  = request.user.userId;
        await request.db.query(`DELETE FROM games WHERE gameId = :gameId and userId = :userId`, {gameId, userId})
            response.json('success');
    } catch (error){
        response.json(error)
    }

})

//update game by gameid and userid
app.put('/allgames/:gameId/edit', authToken, async function(request, response){
    const { gameName, gameYear, gameDescription,
        gamePlatform, gameStatus, gameImage} = request.body
    const userId  = request.user.userId;
    const { gameId } = request.params

     try{
     await request.db.query(`UPDATE games
     set gameName = :gameName, gameYear = :gameYear, gameDescription = :gameDescription,
     gamePlatform = :gamePlatform, gameStatus= :gameStatus, gameImage = :gameImage
     where gameId = :gameId and userId = :userId`,
     {gameName, gameYear, gameDescription,
                gamePlatform, gameStatus, gameImage, gameId, userId });

     const [lastUpdatedGame] = await request.db.query(
         `select * from games where gameId = :gameId`, {gameId})
         response.json(lastUpdatedGame)

} catch (error) {
    response.json(error)
    }

})



///////authentication

//add user to database, from register form
app.post('/signup', async (request, response) => {
    try{
        const encryptedPass = await bcrypt.hash(request.body.password, 10);
        const userName = request.body.userName;
        const [row] = await request.db.query
        ('SELECT * FROM users WHERE userName = :userName', {userName})

        if(row.length === 0){
            await request.db.query
            ('INSERT INTO users (userName, userPassword) VALUES (:userName, :encryptedPass)'
            ,{userName, encryptedPass} )
            response.json('User added.');
        } else {
            response.json("Username is unavailable.")
        }

    } catch (error){
        response.json(error);
    }
})

//logins user by verifying user and pw
app.post('/login', async (request, response) => {
    try {
        const userName = request.body.userName;
        const password = request.body.password;
        const [userQuery] = await request.db.query
        ('SELECT * FROM users WHERE userName = :userName', {userName})

        if(userQuery.length === 0){
            response.json({accessToken: 'usernameNotFound'})
        } else {
            if( await bcrypt.compare(password, userQuery[0].userPassword) === true){

                const user = {userId: userQuery[0].userId,
                    userName: userQuery[0].userName,
                    userPassword: userQuery[0].userPassword }

              const token =  jwt.sign(user, process.env.RANDOM_KEY, {expiresIn: '1h'})
                    response.json({accessToken: token});
            } else {
               response.json({accessToken: 'passwordInvalid'})
            }
        }
    } catch (error) {
        response.json(error)
    }
})


//function to verify valid token in header, if valid returns user object
function authToken(request, response, next){
    const authHeader = request.headers['auth'];
    const token = authHeader && authHeader.split(' ')[1];
    if(token === null){
        response.json("Token not given, access denied.")
    } else {
        jwt.verify(token, process.env.RANDOM_KEY, (error, user) => {
            if (error){
                response.json("Token verification error, access denied.")
            } else {
                request.user = user
                next()
            }   
        })
    }
}

app.listen(port, () => console.log(`Listening on port ${port}`))