require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
const Stripe = require('stripe');

app.use(cors({
    origin: ['http://localhost:5173', 'https://newsdaylight-99199.web.app', 'https://newsdaylight-99199.firebaseapp.com']
}));
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const stripe = Stripe(`${process.env.Stripe_Secret}`);

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
        const publishersCollection = client.db("newsDayLight").collection('publishers');


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
        //get all user data
        app.get('/all-users', async (req, res) => {
            const result = await usersCollection.find().toArray();

            res.send(result);
        })

        //update user to admin
        app.patch('/make-admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id),
            }
            const updatedDoc = {
                $set: {
                    role: 'Admin'
                }
            }

            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        //get user profile
        app.get('/users/:id', async (req, res) => {
            const email = req.params.id;

            const query = { email };

            const result = await usersCollection.findOne(query);
            res.send(result);
        })

        //get users count
        app.get('/users-count', async (req, res) => {
            const allUserCount = await usersCollection.estimatedDocumentCount();
            const premiumUsersCount = await usersCollection.countDocuments({ premiumTaken: 'Yes' });
            const normalUsersCount = await usersCollection.countDocuments({ premiumTaken: 'No' });

            res.send({
                allUserCount, normalUsersCount, premiumUsersCount
            })
        })

        //Update user profile
        app.patch('/users/:id', async (req, res) => {
            const email = req.params.id;

            const userData = req.body;

            const query = { email };
            const updatedDoc = {
                $set: {
                    name: userData.name,
                    photoURL: userData.photoURL
                }
            }

            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);

        })

        //make user normal to premium
        app.patch('/make-premium-user', async (req, res) => {
            const { email, time } = req.body;

            const query = { email }

            const now = new Date();

            const updatedDoc = {
                $set: {
                    premiumEndAt: new Date(now.getTime() + time * 1000)
                }
            }

            const result = await usersCollection.updateOne(query, updatedDoc);

            res.send(result);

            // console.log( now,updatedDoc);
        })

        //Check isSubscribed?
        app.get('/isPremium', async (req, res) => {

            const email = req.query.email;

            const query = { email };

            let isSubscribed = false;

            const result = await usersCollection.findOne(query);
            if (result?.premiumEndAt) {
                const premiumEndAt = new Date(result.premiumEndAt);
                const now = new Date();
                if (premiumEndAt > now) {

                    isSubscribed = true;
                }
            }

            res.send(isSubscribed);
        })

        //remove subscription of the user
        app.patch('/remove/subscription', async(req,res)=>{
            const email = req.body;
            const query = {email};
            const updatedDoc = {
                $set : {
                    premiumEndAt : null,
                }
            }

            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        //add articles in articles collection
        app.post('/articles', async (req, res) => {
            const articleData = req.body;

            const updatedArticleData = {
                articleTitle: articleData.title,
                articleImage: articleData.photoURL,
                publisher: articleData.publisher,
                Tags: articleData.formatedTags,
                articleDescription: articleData.description,
                userInfo: articleData.userInfo,
                status: 'Pending',
                isPremium: 'No',
                totalViewCount: 0,
                createdAt: new Date()
            }

            const result = await articlesCollection.insertOne(updatedArticleData);

            res.send(result);
        })

        //get all article data to admin
        app.get('/all-articles/data', async (req, res) => {
            const result = await articlesCollection.find().toArray();
            res.send(result);
        })

        //get trending article data
        app.get('/articles/trending', async (req, res) => {
            const query = { status: 'Approved' };
            const result = await articlesCollection.find(query).sort({ totalViewCount: -1 }).limit(6).toArray();

            res.send(result);
        })

        //update view count
        app.patch('/articles/view-count/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $inc: {
                    totalViewCount: 1
                }
            }

            const result = await articlesCollection.updateOne(query, updatedDoc)
            res.send(result)
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

        //update article status approve
        app.patch('/update/status/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'Approved'
                }
            }

            const result = await articlesCollection.updateOne(query, updatedDoc);

            res.send(result);
        })

        //article decline
        app.patch('/article/decline/:id', async (req, res) => {
            const id = req.params.id;
            const reason = req.body;

            const query = { _id: new ObjectId(id) };

            const updatedDoc = {
                $set: {
                    status: 'Declined',
                    decliningReason: reason.decliningReason
                }
            }

            const result = await articlesCollection.updateOne(query, updatedDoc);

            res.send(result);
        })

        //make premium article
        app.patch('/make-premium/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set:
                {
                    isPremium: "Yes"
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
        });

        //Add publisher
        app.post('/add-publishers', async (req, res) => {
            const publisherData = req.body;
            const result = await publishersCollection.insertOne(publisherData);
            res.send(result);
        })

        // get all publisher data
        app.get('/publisher-data', async (req, res) => {
            const result = await publishersCollection.find().toArray();
            res.send(result);
        })

        //get all premium articles
        app.get('/premium/articles/only', async (req, res) => {
            const query = {
                status: 'Approved',
                isPremium: 'Yes'
            };
            const result = await articlesCollection.find(query).toArray();

            res.send(result);
        })

        //get all approved articles
        app.get('/all-articles/approved', async (req, res) => {

            const search = req.query.search;
            const publicationFiler = req.query.publicationFiler;
            const tags = req.query.tags;

            // console.log(search, publicationFiler, tags);

            let query = {
                status: 'Approved'
            }

            if (search) {
                query.articleTitle = {
                    $regex: search,
                    $options: 'i'
                };
            }

            if (publicationFiler) {
                query.publisher = publicationFiler
            }

            if (tags) {
                const tagsArray = tags.split(',');
                query.Tags = {
                    $all: tagsArray
                };
            }

            const result = await articlesCollection.find(query).toArray();
            res.send(result);
        })

        // create payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { amount } = req.body;
            const price = parseInt(amount) * 100;
            // console.log(price);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: price,
                currency: 'usd'
            })

            res.send({ clientSecret: paymentIntent.client_secret })

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