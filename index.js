require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173', 'https://newsdaylight-99199.web.app', 'https://newsdaylight-99199.firebaseapp.com']
}));
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j876r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const usersCollection = client.db("newsDayLight").collection('users');
        const articlesCollection = client.db("newsDayLight").collection('articles');


        //check users in database
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email };

            const isUserFound = await usersCollection.findOne(query);
            // console.log(isUserFound);

            if (isUserFound) {
                return res.send({ message: false })
            }
            res.send({ message: true });
        })

        //add user in database
        app.post('/users/new', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        //check and add google user
        app.post('/users/new/google', async (req, res) => {
            const user = req.body;

            const query = { email: user.email };

            const isUserFound = await usersCollection.findOne(query);

            if (!isUserFound) {
                const result = await usersCollection.insertOne(user);
                res.send(result);
            }
            res.send('user already found');
        });

        //get user profile
        app.get('/users/:id', async(req,res)=>{
            const email = req.params.id;

            const query = {email};

            const result = await usersCollection.findOne(query);
            res.send(result);
        })

        //Update user profile
        app.patch('/users/:id', async(req, res)=>{
            const email = req.params.id;

            const userData = req.body;

            const query = {email};
            const updatedDoc = {
                $set : {
                    name : userData.name,
                    photoURL : userData.photoURL
                }
            }

            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);
            
        } )

        //adding articles in articles collection
        app.post('/articles', async (req, res) => {
            const articleData = req.body;

            const updatedArticleData = {
                articleTitle: articleData.title,
                articleImage: articleData.photoURL,
                publisher: articleData.publisher,
                Tags: articleData.selectedOptions,
                articleDescription: articleData.description,
                userInfo: articleData.userInfo,
                status: 'Pending',
                isPremium: 'No',
                totalViewCount : 0,
            }

            const result = await articlesCollection.insertOne(updatedArticleData);

            res.send(result);
        })

        //update view count
        app.patch('/articles/view-count/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id : new ObjectId(id)};
            const updatedDoc = {
                $inc : {
                    totalViewCount : 1
                }
            }

            const result = await articlesCollection.updateOne(query, updatedDoc)
            res.send(result )
        })

        // update article based on article id
        app.patch('/my-articles/update/:id', async (req, res) => {
            const id = req.params.id;
            const updatedArticle = req.body;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    articleTitle: updatedArticle.title,
                    articleImage: updatedArticle.photoURL,
                    publisher: updatedArticle.publisher,
                    Tags: updatedArticle.selectedOptions,
                    articleDescription: updatedArticle.description,
                }
            }

            const result = await articlesCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        // My article base on user email
        app.get('/articles/:id', async (req, res) => {
            const email = req.params.id;

            const query = {
                'userInfo.email': email
            }

            const result = await articlesCollection.find(query).toArray();
            res.send(result);
        })

        // get article based on id
        app.get('/article/data/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) };

            const result = await articlesCollection.findOne(query);
            res.send(result);
        })

        // Delete article
        app.delete('/my-articles/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) };

            const result = await articlesCollection.deleteOne(query);
            res.send(result);
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Newspaper FullStack Website server for Assignment 12');
})

app.listen(port, () => {
    console.log('server running on port : ', port);
})