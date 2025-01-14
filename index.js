require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('Newspaper FullStack Website server for Assignment 12');
})

app.listen(port, ()=>{
    console.log('server running on port : ', port);
})