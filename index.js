const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const res = require("express/lib/response");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
  const reviewCollection = client
    .db("heavy-duty-tools-db")
    .collection("reviews");
  const paymentCollection = client
    .db("heavy-duty-tools-db")
    .collection("payments");
  app.get("/tools", async (req, res) => {
    const page = parseInt(req.query.page);
    const size = parseInt(req.query.size);
    let tools;
    if (page || size) {
      tools = await toolsCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
    } else {
      tools = await toolsCollection.find().toArray();
    }

    res.send(tools);
  });

  //Adding Orders to order collection
  app.post("/orders", verifyJWT, async (req, res) => {
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
  app.put("/user/admin/:email", verifyJWT, async (req, res) => {
    const email = req.params.email;
    const initiator = req.decoded.email;
    const initiatorAccount = await userCollection.findOne({ email: initiator });
    if (initiatorAccount.role === "admin") {
      const filter = { email: email };
      const updatedDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    } else {
      res.status(403).send({ message: "Access Denied!" });
    }
  });
  //Admin route
  app.get("/admin/:email", verifyJWT, async (req, res) => {
    const email = req.params.email;
    const user = await userCollection.findOne({ email: email });
    const isAdmin = user.role === "admin";
    res.send({ admin: isAdmin });
  });

  //Getting the specific order for paying
  app.get("/order/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    console.log(id);
    const order = await orderCollection.findOne(query);
    res.send(order);
  });
  //Creating Payment
  app.post("/create_payment_intent", verifyJWT, async (req, res) => {
    const price = req.body.totalAmountPay;
    console.log(price);
    const amount = price * 100;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  });
  //Updating Order information after payment
  app.patch("/order/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const paymentInfo = req.body;
    const filter = { _id: ObjectId(id) };
    const updatedDoc = {
      $set: {
        paid: true,
        transactionId: paymentInfo.transactionId,
      },
    };
    const result = await paymentCollection.insertOne(paymentInfo);
    const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
    res.send(updatedOrder);
  });
  //Managing All Orders
  app.get("/orders", async (req, res) => {
    const orders = await orderCollection.find().toArray();
    res.send(orders);
  });
  //Approved Orders
  app.put("/order/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const orderInfo = req.body;
    const filter = { _id: ObjectId(id) };
    const updatedDoc = {
      $set: {
        shipped: true,
      },
    };
    const shippedOrder = await orderCollection.updateOne(filter, updatedDoc);
    res.send(shippedOrder);
  });
  //Deleting Specific Order
  app.delete("/order/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const orderInfo = req.body;
    const query = { _id: ObjectId(id) };
    const deletedOrder = await orderCollection.deleteOne(query);
    res.send(deletedOrder);
  });
  //Deleting Specific Tool
  app.delete("/tool/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const deletedTool = await toolsCollection.deleteOne(query);
    res.send(deletedTool);
  });
  //Deleting Specific User
  app.delete("/user/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const deletedUser = await userCollection.deleteOne(query);
    res.send(deletedUser);
  });
  //Inserting New Tool
  app.post("/tools", verifyJWT, async (req, res) => {
    const tool = req.body;
    const correctedToolData = {
      name: tool.name,
      image: tool.image,
      shortDescription: tool.shortDescription,
      availableQuantity: parseFloat(tool.availableQuantity),
      minimumOrderQuantity: parseFloat(tool.minimumOrderQuantity),
      price: parseFloat(tool.price),
    };
    console.log(correctedToolData);
    const result = await toolsCollection.insertOne(correctedToolData);
    res.send(result);
  });
  //Canceling Ordered Items
  app.delete("/my_order/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const deletedOrder = await orderCollection.deleteOne(query);
    res.send(deletedOrder);
  });
  //For Pagination
  app.get("/toolCount", async (req, res) => {
    const count = await toolsCollection.estimatedDocumentCount();
    res.send({ count });
  });
  //Adding Review
  app.post("/reviews", verifyJWT, async (req, res) => {
    const review = req.body;
    const reviewData = {
      name: review.reviewerName,

      review: review.review,
      ratings: parseFloat(review.ratings),
    };
    console.log(reviewData);
    const result = await reviewCollection.insertOne(reviewData);
    res.send(result);
  });
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Listenting to port ${port}`);
});
