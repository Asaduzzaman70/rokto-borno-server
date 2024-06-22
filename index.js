const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

// MIddleware
app.use(cors());
app.use(express.json());

// rokto_borno
// 9xrer6jJO6NPdcA0

/**
 * =================================================================
 * =================================================================
 *                    MongoDb---------------START
 * =================================================================
 * =================================================================
 */

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.z51z0nl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const divisionCollection = client.db("RoktoBorno_DB").collection("divisions")
        const districtsCollection = client.db("RoktoBorno_DB").collection("districts")
        const upazilasCollection = client.db("RoktoBorno_DB").collection("upazilas")
        const usersCollection = client.db("RoktoBorno_DB").collection("users")
        const donationRequestsCollection = client.db("RoktoBorno_DB").collection("DonationRequests")
        const paymentCollection = client.db("RoktoBorno_DB").collection("payments");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // Middleware
        const verifyToken = (req, res, next) => {
            // console.log('Inside Verify Token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decode = decode;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decode.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decode.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })


        // Location
        app.get('/division', async (req, res) => {
            const result = await divisionCollection.find().toArray();
            res.send(result);
        })
        app.get('/districts', async (req, res) => {
            const { divisionId, districtId } = req.query;
            // console.log(divisionId);
            const query = {};

            if (divisionId) {
                query.division_id = divisionId
            }
            if (districtId) {
                query.district_id = districtId
            }


            let result;
            if (divisionId) {
                result = await districtsCollection.find(query).toArray();
            }
            if (districtId) {
                result = await upazilasCollection.find(query).toArray();
            }
            res.send(result);
        })

        // Users Related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result);
        })


        app.post('/users', async (req, res) => {
            const users = req.body;
            const result = await usersCollection.insertOne(users);
            res.send(result);
        })

        app.patch('/users/:email', verifyToken, async (req, res) => {
            const userInfo = req.body;
            const email = req.params.email;
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    name: userInfo.name,
                    avatar: userInfo.avatar,
                    blood_group: userInfo.blood_group,
                    division: userInfo.division,
                    district: userInfo.district,
                    upazila: userInfo.upazila,
                }
            }

            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.patch('/users', verifyToken, verifyAdmin, async (req, res) => {
            const { status, email, role } = req.query;


            const filter = { email: email };

            let updatedDoc;

            if (status) {
                updatedDoc = {
                    $set: { status: status }
                }
            }
            if (role) {
                updatedDoc = {
                    $set: { role: role }
                }
            }
            console.log(updatedDoc);

            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // donation request related api
        app.get('/donationRequest', verifyToken, async (req, res) => {
            const { email, id } = req.query;
            const query = {};


            if (email) {
                query.donorEmail = email;
            }
            if (id) {
                query._id = new ObjectId(id);
            }
            // console.log(id);



            let result;
            if (email) {
                result = await donationRequestsCollection.find(query).toArray();
            }
            if (id) {
                result = await donationRequestsCollection.findOne(query);
            }
            res.send(result);
        })

        app.post('/donationRequest', verifyToken, async (req, res) => {
            const donationRequest = req.body;
            const result = await donationRequestsCollection.insertOne(donationRequest);
            res.send(result);
        })


        app.patch('/donationRequest/:id', verifyToken, async (req, res) => {
            const donationRequestInfo = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            // console.log(donationRequestInfo);

            const updatedDoc = {
                $set: {
                    recipientName: donationRequestInfo.recipientName,
                    recipientEmail: donationRequestInfo.recipientEmail,
                    fullAddress: donationRequestInfo.fullAddress,
                    hospitalName: donationRequestInfo.hospitalName,
                    donationDate: donationRequestInfo.donationDate,
                    donationTime: donationRequestInfo.donationTime,
                    requestMessage: donationRequestInfo.requestMessage
                }
            }

            const result = await donationRequestsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/donationRequest', verifyToken, async (req, res) => {
            const { id } = req.query;
            const query = { _id: new ObjectId(id) };
            const result = await donationRequestsCollection.deleteOne(query);
            res.send(result);
        })

        // state or analytics
        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const users = await usersCollection.estimatedDocumentCount();
            const donation = await donationRequestsCollection.estimatedDocumentCount();

            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray();
            const revenue = result.length > 0 ? result[0].totalRevenue : 0;


            res.send({
                users,
                donation,
                revenue
            })
        })

        app.get('/donationRequest/admin', verifyToken, verifyAdmin, async (req, res) =>{
            const result = await donationRequestsCollection.find().toArray();
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

/**
 * =================================================================
 * =================================================================
 *                    MongoDb---------------END
 * =================================================================
 * =================================================================
 */

app.get('/', (req, res) => {
    res.send('Rokto Borno Is Dropping Blood......');
})

app.listen(port, () => {
    console.log(`Rokto Borno sitting port on: - ${port}`);
})