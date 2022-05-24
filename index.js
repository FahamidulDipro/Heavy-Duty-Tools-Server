const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const res = require("express/lib/response");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");

app.use(cors());
app.use(express.json());

//Checking the server
app.get("/", (req, res) => {
  res.send("Heavy Duty Tool Server Working!");
});

//JWT Verify Function
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access!" });
  }
  const token = authHeader.split(" ")[1];
  //Verification
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access!" });
    }
    req.decoded = decoded;
    next();
  });
};
//Database Connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.6nnj1.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  await client.connect();
  const toolsCollection = client.db("heavy-duty-tools-db").collection("tools");
  const orderCollection = client.db("heavy-duty-tools-db").collection("orders");
  const userCollection = client.db("heavy-duty-tools-db").collection("users");
  app.get("/tools", async (req, res) => {
    const tools = await toolsCollection.find().toArray();
    res.send(tools);
  });

  //Adding Orders to order collection
  app.post("/orders", async (req, res) => {
    const orderData = req.body;
    console.log(orderData);
    if (orderData.availableQuantity >= orderData.amount) {
      delete orderData.availableQuantity;
      const result = await orderCollection.insertOne(orderData);
      res.send(result);
    }
  });
  //Updating Available Quantities
  app.put("/tools", async (req, res) => {
    const { selectedToolId, availableQuantity } = req.body;
    console.log(availableQuantity);
    console.log("tool id: ", selectedToolId);
    const filter = { _id: ObjectId(selectedToolId) };
    const option = { upsert: true };
    const updateDoc = {
      $set: {
        availableQuantity: availableQuantity,
      },
    };
    const result = await toolsCollection.updateOne(filter, updateDoc, option);
    res.send(result);
  });
  //Updating Users Registration Information
  app.put("/user/:email", async (req, res) => {
    const email = req.params.email;
    const user = req.body;
    const filter = { email: email };
    const option = { upsert: true };
    console.log(user);
    const updatedDoc = {
      $set: user,
    };
    const result = await userCollection.updateOne(filter, updatedDoc, option);
    const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1d",
    });
    res.send({ result, token });
  });
  //Showing all orders of a user
  app.get("/orders/:email", verifyJWT, async (req, res) => {
    const email = req.params.email;
    const decodedEmail = req.decoded.email;
    if (decodedEmail === email) {
      const query = { email: email };
      const orders = await orderCollection.find(query).toArray();
      res.send(orders);
    } else {
      return res.status(403).send({ message: "Forbidden Access!" });
    }
  });
  //Showing all users
  app.get("/users", verifyJWT, async (req, res) => {
    const users = await userCollection.find().toArray();
    res.send(users);
  });
  //Making a user Admin
  app.put("/user/admin/:email", async (req, res) => {
    const email = req.params.email;
    const initiator = req.decoded.email;
    const initiatorAccount = await userCollection.findOne({ email: initiator });
    const filter = { email: email };
    const updatedDoc = {
      $set: { role: "admin" },
    };
    const result = await userCollection.updateOne(filter, updatedDoc);
    res.send(result);
  });
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Listenting to port ${port}`);
});
