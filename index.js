const express = require('express')
const cors = require('cors');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Heavy Duty Tool Server Working!')
})

app.listen(port, () => {
  console.log(`Listenting to port ${port}`)
})