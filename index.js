
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wpavw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// JWT Secret
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

// MongoDB Collections
let userCollection, filesCollection;

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        const database = client.db('ShareLink');
        userCollection = database.collection('users');
        filesCollection = database.collection('files');
        textCollection = database.collection("textData");

        // JWT API
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });

        // Middleware to verify JWT
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Forbidden access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Forbidden access' });
                }
                req.decoded = decoded;
                next();
            });
        };

        // Save User
        app.post('/users', async (req, res) => {
            const { uid, email, displayName } = req.body;
            if (!uid || !email) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            const existingUser = await userCollection.findOne({ uid });
            if (!existingUser) {
                const newUser = { uid, email, displayName };
                const result = await userCollection.insertOne(newUser);
                res.status(201).json(result);
            } else {
                res.status(200).json({ message: "User already exists" });
            }
        });


        app.post('/upload', async (req, res) => {
            const { username, email, fileUrl, privacy, password } = req.body;

            if (!username || !email || !fileUrl) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            const newFileData = {
                username,
                email,
                fileUrl,
                privacy,
                password: privacy === "private" ? password : null,
                uploadedAt: new Date(),
            };

            const result = await filesCollection.insertOne(newFileData);
            res.status(201).json({ message: "File data saved successfully", data: result });
        });


        // Get User's Uploaded Files
        app.get('/uploads', async (req, res) => {
            const { email } = req.query;
            if (!email) {
                return res.status(400).json({ error: "Email is required" });
            }

            const userUploads = await filesCollection.find({ email }).toArray();
            res.json(userUploads);
        });

        // Get a single uploaded file by ID
        app.get('/uploads/:id', async (req, res) => {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: "Invalid ID format" });
            }

            const file = await filesCollection.findOne({ _id: new ObjectId(id) });

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            res.json(file);
        });


        app.put('/uploads/:id', async (req, res) => {
            const { id } = req.params;
            const { fileUrl, privacy, password } = req.body;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: "Invalid ID format" });
            }

            const updateData = { fileUrl, privacy };

            // Only include password if privacy is private
            if (privacy === "private") {
                updateData.password = password || "";
            } else {
                updateData.password = undefined; // Remove password if public
            }

            const result = await filesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            );

            if (result.modifiedCount > 0) {
                res.json({ success: true, message: "File updated successfully" });
            } else {
                res.status(400).json({ error: "Update failed" });
            }
        });


        // Delete File
        app.delete('/uploads/:id', async (req, res) => {
            const id = req.params.id;
            const result = await filesCollection.deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount > 0) {
                res.json({ message: "File deleted successfully" });
            } else {
                res.status(404).json({ error: "File not found" });
            }
        });


        // for all page
        app.get('/upload', async (req, res) => {
            try {
                const files = await filesCollection.find({}).toArray();
                res.json(files);
            } catch (error) {
                console.error("Error fetching uploads:", error);
                res.status(500).json({ error: "Failed to fetch uploads" });
            }
        });


        app.post('/upload/private', async (req, res) => {
            const { id, password } = req.body;

            const file = await filesCollection.findOne({ _id: new ObjectId(id) });

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            if (file.isPrivate && file.password !== password) {
                return res.status(403).json({ error: "Incorrect password" });
            }

            res.json({ success: true, fileUrl: file.fileUrl });
        });




        app.post("/save-text", async (req, res) => {
            try {
                console.log("Received data:", req.body);
                const { content, username, email, privacy, password } = req.body;

                if (!content || !username || !email) {
                    return res.status(400).json({ success: false, message: "Text, username, and email are required." });
                }

                const newText = {
                    content,
                    username,
                    email,
                    privacy,
                    password: privacy === "private" ? password : null,
                    createdAt: new Date(),
                };

                const result = await textCollection.insertOne(newText);

                if (result.insertedId) {
                    const textLink = `http://localhost:5000/text/${result.insertedId}`;
                    await textCollection.updateOne({ _id: result.insertedId }, { $set: { textLink } });

                    return res.json({ success: true, textId: result.insertedId, textLink });
                } else {
                    return res.status(500).json({ success: false, message: "Failed to save text." });
                }
            } catch (error) {
                console.error("Error saving text:", error);
                return res.status(500).json({ success: false, message: "Server error." });
            }
        });


        app.get("/texts", async (req, res) => {
            try {
                const texts = await textCollection.find().toArray(); // Get all documents from the collection

                if (texts.length === 0) {
                    return res.status(404).json({ success: false, message: "No text entries found." });
                }

                // Send the data as response
                res.json({ success: true, texts });
            } catch (error) {
                console.error("Error fetching texts:", error);
                res.status(500).json({ success: false, message: "Server error." });
            }
        });


        app.get("/text/:id", async (req, res) => {
            try {
                const textId = req.params.id;
                const textData = await textCollection.findOne({ _id: new ObjectId(textId) });

                if (!textData) {
                    return res.status(404).json({ success: false, message: "Text not found." });
                }

                res.json({ success: true, content: textData.content });
            } catch (error) {
                console.error("Error retrieving text:", error);
                res.status(500).json({ success: false, message: "Server error." });
            }
        });
        app.post('/texts/private', async (req, res) => {
            const { id, password } = req.body;
        
            // Find the text document in the database
            const text = await textCollection.findOne({ _id: new ObjectId(id) });
        
            if (!text) {
                return res.status(404).json({ error: "Text not found" });
            }
        
            if (text.isPrivate && text.password !== password) {
                return res.status(403).json({ error: "Incorrect password" });
            }
        
            res.json({ success: true, textContent: text.textLink });
        });


        app.put("/text/:id", async (req, res) => {
            try {
                const textId = req.params.id;
                if (!ObjectId.isValid(textId)) {
                    return res.status(400).json({ success: false, message: "Invalid ID format" });
                }

                const { text, privacy, password } = req.body;
                if (!text || !privacy) {
                    return res.status(400).json({ success: false, message: "Missing required fields" });
                }

                const updateData = { text, privacy, updatedAt: new Date() };
                if (privacy === "private") updateData.password = password || ""; // Ensure password is handled

                const updatedText = await textCollection.updateOne(
                    { _id: new ObjectId(textId) },
                    { $set: updateData }
                );

                if (updatedText.modifiedCount === 0) {
                    return res.status(404).json({ success: false, message: "Text not found or no changes made." });
                }

                res.json({ success: true, message: "Text updated successfully." });
            } catch (error) {
                console.error("Error updating text:", error);
                res.status(500).json({ success: false, message: "Server error." });
            }
        });


        app.delete("/texts/:id", async (req, res) => {
            try {
                const textId = req.params.id;
                // Assuming `textCollection` is your MongoDB collection or array holding the text data.
                const result = await textCollection.deleteOne({ _id: new ObjectId(textId) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ success: false, message: "Text not found." });
                }

                res.json({ success: true, message: "Text has been deleted." });
            } catch (error) {
                console.error("Error deleting text:", error);
                res.status(500).json({ success: false, message: "Server error." });
            }
        });





        // Root Route
        app.get('/', (req, res) => {
            res.send('Task is here');
        });

        // Start Server
        app.listen(port, () => {
            console.log(`Server is running on port: ${port}`);
        });
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

run().catch(console.dir);