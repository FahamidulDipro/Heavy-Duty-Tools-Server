const express = require('express')
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const res = require('express/lib/response');
const app = express()
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

//Checking the server
app.get('/', (req, res) => {
  res.send('Heavy Duty Tool Server Working!')
})


//Database Connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.6nnj1.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
  await client.connect();
  const toolsCollection = client.db("heavy-duty-tools-db").collection("tools");
  const orderCollection = client.db("heavy-duty-tools-db").collection("orders");
app.get('/tools',async (req,res)=>{
  const tools = await toolsCollection.find().toArray();
  res.send(tools);
})

//Adding Orders to order collection
app.post('/orders',async(req,res)=>{
  const orderData = req.body;
  console.log(orderData);
  const result = await orderCollection.insertOne(orderData);
  res.send(result);
 

})
  
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Listenting to port ${port}`)
})