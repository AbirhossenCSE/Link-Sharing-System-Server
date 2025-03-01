const express = require('express');
const cors = require('cors');
const app = express();

// jwt-1
const jwt = require('jsonwebtoken');

require('dotenv').config()

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wpavw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const database = client.db('ShareLink');
        const userCollection = database.collection('users');


        // jwt related API---- JWT-2
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middleware----------JWT-3
        const verifyToken = (req, res, next) => {
            // console.log('Inside VerifyToken', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden-access' })
                }
                req.decoded = decoded;
                next();
            })
            // next();
        }

        // post user
        app.post('/users', async (req, res) => {
            const { uid, email, displayName } = req.body;

            if (!uid || !email) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            // Check if user already exists
            const existingUser = await userCollection.findOne({ uid });

            if (!existingUser) {
                const newUser = { uid, email, displayName };
                const result = await userCollection.insertOne(newUser);
                res.status(201).json(result);
            } else {
                res.status(200).json({ message: "User already exists" });
            }
        });


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Task is hare')
})
app.listen(port, () => {
    console.log(`Task at: ${port}`)
})

