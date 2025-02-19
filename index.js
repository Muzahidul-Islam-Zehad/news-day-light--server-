require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');

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

const verifyToken = (req, res, next) => {

    if (!req.headers.authorization) {
        res.status(401).send({ message: 'UnAuthorized access' });
    }

    const token = req.headers.authorization.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
            res.status(401).send({ message: 'UnAuthorized access' });
        }
        if (decoded) {
            res.user = decoded;
        }
        next();
    })

}

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


        //create jwt
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '20d' });
            res.send({ token });
        })



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
        app.get('/all-users', verifyToken, async (req, res) => {
            const page = parseInt(req.query.page) || 1; // Current page
            const limit = parseInt(req.query.limit) || 10; // Items per page
            const skip = (page - 1) * limit; // Calculate offset

            const totalItems = await usersCollection.estimatedDocumentCount();
            const users = await usersCollection.find().skip(skip).limit(limit).toArray(); // Paginated users
            // const result = await usersCollection.find().toArray();

            // res.send(result);
            res.send({
                users,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                currentPage: page,
            });
        })

        //update user to admin
        app.patch('/make-admin/:id', verifyToken, async (req, res) => {
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
        app.get('/users/:id', verifyToken, async (req, res) => {
            const email = req.params.id;

            const query = { email };

            const result = await usersCollection.findOne(query);
            res.send(result);
        })

        //get users count
        app.get('/users-count', async (req, res) => {
            const allUserCount = await usersCollection.estimatedDocumentCount();

            const premiumUsersCount = await usersCollection.countDocuments({
                premiumEndAt: { $exists: true, $ne: null },
                premiumEndAt: { $gt: new Date() }
            });

            // const normalUsersCount = await usersCollection.countDocuments({
            //     $or: [
            //         { premiumEndAt: { $exists: false } },
            //         { premiumEndAt: null }
            //     ]
            // });

            res.send({
                allUserCount,
                normalUsersCount : allUserCount - premiumUsersCount,
                premiumUsersCount
            });
        });


        //Update user profile
        app.patch('/users/:id', verifyToken, async (req, res) => {
            const email = req.params.id;

            const userData = req.body;

            const query = { email };
            const updatedDoc = {
                $set: {
                    name: userData.name,
                    photoURL: userData.photoURL,
                    phone : userData.phone,
                    address: userData.address,
                    birth: userData.birth,
                    gender: userData.gender
                }
            }
            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);

        })

        //make user normal to subscribed
        app.patch('/make-premium-user', verifyToken, async (req, res) => {
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
        app.patch('/remove/subscription', async (req, res) => {
            const { email } = req.body;
            const query = { email };
            const updatedDoc = {
                $set: {
                    premiumEndAt: null,
                }
            }

            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        //add articles in articles collection
        app.post('/articles', verifyToken, async (req, res) => {
            try {
                const email = req.query.email;
                const now = new Date();

                const user = await usersCollection.findOne({
                    email,
                    $or: [
                        { premiumEndAt: { $exists: false } },
                        { premiumEndAt: null },
                        { premiumEndAt: { $lte: now } },
                    ],
                });

                if (user) {
                    const publishedArticles = await articlesCollection.countDocuments({
                        "userInfo.email": email,
                    });

                    if (publishedArticles > 0) {
                        return res.send({ message: 'needPremium' });
                    }
                }

                // Premium user logic or first article for normal user
                const articleData = req.body;
                const newArticle = {
                    articleTitle: articleData.title,
                    articleImage: articleData.photoURL,
                    publisher: articleData.publisher,
                    Tags: articleData.formatedTags || [],
                    articleDescription: articleData.description,
                    userInfo: articleData.userInfo,
                    status: 'Pending',
                    isPremium: 'No',
                    totalViewCount: 0,
                    createdAt: new Date(),
                };

                const result = await articlesCollection.insertOne(newArticle);
                res.status(201).send(result);

            } catch (error) {
                console.error('Error:', error);
                res.status(500).send({ message: 'Server error' });
            }
        });


        //get all article data to admin
        app.get('/all-articles/data', verifyToken, async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            const totalItems = await articlesCollection.estimatedDocumentCount();

            const articles = await articlesCollection.find().skip(skip).limit(limit).toArray();
            // const result = await articlesCollection.find().toArray();
            // res.send(result);
            res.send({
                articles,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                currentPage: page,
            });
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
        app.patch('/my-articles/update/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedArticle = req.body;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    articleTitle: updatedArticle.title,
                    articleImage: updatedArticle.photoURL,
                    publisher: updatedArticle.publisher,
                    Tags: updatedArticle.formatedTags,
                    articleDescription: updatedArticle.description,
                }
            }

            const result = await articlesCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        //update article status approve
        app.patch('/update/status/:id', verifyToken, async (req, res) => {
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
        //check isAdmin
        app.get('/check/isAdmin', async (req, res) => {
            const email = req.query.email;

            if (email) {
                const query = {
                    email,
                    role: 'Admin'
                };

                const isAdmin = await usersCollection.findOne(query);

                if (isAdmin) {
                    res.send({ isAdmin: true })
                }
                else {
                    res.send({ isAdmin: false });
                }
            }

        })

        //article decline
        app.patch('/article/decline/:id', verifyToken, async (req, res) => {
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
        app.patch('/make-premium/:id', verifyToken, async (req, res) => {
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
        app.get('/articles/:id', verifyToken, async (req, res) => {
            const email = req.params.id;

            const query = {
                'userInfo.email': email
            }

            const result = await articlesCollection.find(query).toArray();
            res.send(result);
        })

        // get article based on id
        app.get('/article/data/:id', verifyToken, async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) };

            const result = await articlesCollection.findOne(query);
            res.send(result);
        })

        // Delete article
        app.delete('/my-articles/:id', verifyToken, async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) };

            const result = await articlesCollection.deleteOne(query);
            res.send(result);
        });

        //Add publisher
        app.post('/add-publishers', verifyToken, async (req, res) => {
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
        app.get('/premium/articles/only', verifyToken, async (req, res) => {
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
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { amount } = req.body;
            const price = parseInt(amount) * 100;
            // console.log(price);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: price,
                currency: 'usd'
            })

            res.send({ clientSecret: paymentIntent.client_secret })

        })

        //publisher article count
        app.get('/publisher/article/count', verifyToken, async(req,res)=>{
            
            const result = await articlesCollection.aggregate([
                {
                    $group : {
                        _id : "$publisher",
                        articleCount : {$sum : 1},
                    },
                },
                {
                    $lookup:{
                        from : 'publishers',
                        localField : '_id',
                        foreignField : 'publisherName',
                        as : 'publisherDetails'
                    },
                },
                {
                    $unwind : "$publisherDetails"
                },
                {
                    $project: {
                        publisherName : "$_id",
                        articleCount: 1,
                    },
                },
            ]).toArray();

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