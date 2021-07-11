//  Version 0.1.1 roll and user login with mongodb and wallet handling and history management

// const { roll, getRandomSeed } = require('./code.js');

var express = require('express');
var crypto = require('crypto');
var fs = require('fs');
var bodyParser = require('body-parser');

var cors = require('cors');

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: false
})); 
app.use(cors());

// ################## DB initialization ######################
var mongoose = require('mongoose');
// db = mongoose.createConnection('localhost','');
mongoose.Promise = global.Promise;

mongoose.connect('mongodb+srv://admin:Proton57868@freemoney.psonr.mongodb.net/freebet?retryWrites=true&w=majority', {useNewUrlParser: true, useUnifiedTopology: true})
// mongoose.connect('mongodb://localhost:27017/freebet', {useNewUrlParser: true, useUnifiedTopology: true})
.then(() => {
    console.log("mongodb connected...")
})
.catch( err => console.log(err))

//  ######################### Schema Creation ##################
var userSchema = new mongoose.Schema({
    username: String, 
    password: String, 
    email: String,
    wallet: String, 
    wager: String,
    rollHistory: Array,
    MultiplyBetRollHistory: Array,
    FakeDoorHistory: Array,
    lottery: Number
})

var User = mongoose.model("User", userSchema)
// var Lottery = mongoose.model("Lottery", lotterySchema)

var clientSeed = "c6WIUwxJ0YBB5Hrc5";
var str1;
var str2;

// ###################  Helper Functions ##################
function getRandomSeed() {
    var seed = fs.readFileSync('serverSeed.txt')
    var lines = seed.toString().split('\n');
    var serverSeed = lines[Math.floor(Math.random() * lines.length)];
    return serverSeed;
}

function roll(client) {
    var nonce = Math.floor(Math.random() * 10);
    str1 = nonce + getRandomSeed() + nonce;
    str2 = nonce + client + nonce;
    console.log(str1)
    console.log(str2)
    var hash = crypto.createHash('sha512', str2);
    hash.update(str1);

    var soln = hash.digest('hex');
    soln = soln.slice(0,8);
    soln = parseInt(soln, 16);
    soln = soln/429496.7295;

    return Math.ceil(soln);
}

function verifyRoll(serverSeed, clientSeed) {
    serverSeed = serverSeed.slice(0, serverSeed.length - 1)
    console.log(str1)
    console.log(str2)

    let verifiedHash = crypto.createHash('sha512', str2);
    verifiedHash.update(str1);

    let solution = verifiedHash.digest('hex');
    solution = solution.slice(0, 8);
    solution = parseInt(solution, 16);
    solution = solution/429496.7295;

    return Math.ceil(solution);
}

function writeLottery(num, id) {
    var lottery = []
    for(let i = 0; i < num; i++) {
        lottery[i] = id
        // fs.appendFileSync('lottery.txt', id)
        // fs.appendFileSync('lottery.txt', '\n')    
    }
    var rd = fs.readFileSync('lottery.txt')
    var existingLottery = rd.toString()
    // console.log(existingLottery.length)
    // console.log(existingLottery.concat(lottery))
    // lottery.filter((value) => { 
    //     // console.log(value)
    //     if(value.length !== 0) 
    //         return value
    // })
    // console.log(lottery)
    if(existingLottery.length === 0) {
        fs.writeFileSync('lottery.txt', lottery.join('\n'))
    } else {
        // lottery = existingLottery.concat(lottery)
        fs.appendFileSync('lottery.txt', '\n')
        fs.appendFileSync('lottery.txt', lottery.join('\n'))
    }
    
} 

// ################# Requests ####################
app.get("", (req, res) => {
    res.send("Hello World");
})

app.get('/', (req, res) => {
    res.send("Try using /api/roll");
})

app.post('/api/roll', (req, res) => {    //#######################   Request to get roll value
    let client = req.body.clientSeed 
    console.log(client, str1, '112')
    var x = roll(client);
    res.json({
        "data": x,
        "serverSeed": str1,
        "clientSeed": str2});
})

app.get('/api/getClientSeed', (req, res) => {
    res.json({
        "data": clientSeed
    })
})

app.post('/api/getUserName', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send('Error getting username')
        }
        else {
            res.json({
                "username": result[0].username 
            })
        }
    })
})

app.post('/api/verifyRoll', (req, res) => {
    let val = verifyRoll(req.body.serverSeed, req.body.clientSeed);

    if(val) {
        res.json({
            data: val
        })
    }
})

app.post('/api/writeLottery', (req, res) => {
    writeLottery(req.body.num, req.body.id);
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send('Failed to update Lottery ticket')
        }
        else {
            User.updateOne({"_id": req.body.id},{$inc:{"lottery": req.body.num}})
            .then(item => {
                res.send('Lottery Count Updated Successfully')
            })
        }
    })
})

app.post('/api/getLotteryTickets', (req, res) => {
    var rd = fs.readFileSync('lottery.txt')
    var tickets = rd.toString().split('\n')
    var totalTickets = tickets.length;
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send("Failed to Get Lottery Ticket Count!!")
        }
        else {
            res.json({
                "totalTickets": totalTickets,
                "userTickets": result[0].lottery
            })
        }
    })
})

app.get('/api/calcLotteryWinner', (req, res) => {
    var winners = []
    var varloaded = false;
    var rd = fs.readFileSync('lottery.txt')
    var lotteryUsers = new Set(rd.toString().split('\n'))
    // console.log(lotteryUsers.size)
    if(lotteryUsers.size >= 5) {
        let interval = setInterval( () => {
            if(winners.length === 5) {
                varloaded = true
                clearInterval(interval)
            }
            var rd = fs.readFileSync('lottery.txt', 'utf-8')
            var tickets = rd.toString().split('\n')
            var winner = tickets[Math.floor(Math.random() * tickets.length)]
            User.find({"_id": winner}, async function(err, result) {
                if(err) {
                    res.status(400).send("Error Finding Winner!!")
                }
                else {
                    // console.log(typeof(winners))
                    // winners = Array(winners)
                    let inc = await result[0].username
                    if (!winners.includes(inc))
                        winners.push(inc)
                }
            })
            // winners = new Set(winners)
            // console.log('170' , winners)
        }, 250)
        let int2 = setInterval(() => {
            if(varloaded) {
                // console.log(winner, '151', winners, winners.length)
                clearInterval(int2)
                winners = winners.slice(0, 5)
                res.json({ 
                    "winners": winners 
                }) 
            }
        }, 250)
    }
    else {
        res.send('Not Enough Lottery Users')
    }
    // res.json({ 
    //     "winners": winners 
    // })
})

app.post('/api/wallet', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send('Failed to fetch wallet data')
        }
        else {
            // console.log(result[0].wallet)
            // res.send(result[0].wallet)
            res.json({
                "wallet": result[0].wallet
            })
        }
    })
})

app.post('/api/setWallet', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send("Failed to set Wallet Data")
        } else {
            User.updateOne({"_id": req.body.id},{"wallet": req.body.wallet})
            .then(item => {
                // console.log(item)
                res.send("Updated Wallet data successfully!!")
            })
        }
    })
})

app.post('/api/wager', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send("Error getting Wager Data from the database")
        }
        else {
            res.json({
                "wager": result[0].wager
            })
        }
    })
})

app.post('/api/setWager', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send("Failed to set Wager data")
        }
        else {
            User.updateOne({"_id": req.body.id},{"wager": req.body.wager})
            .then(item => {
                res.send("Updated Wager Data successfully!!")
            })
        }
    })
})

app.post('/api/pushRollHistory', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send("Error pushing roll history to the database")
        }
        else {
            User.updateOne({"_id": req.body.id}, {$push:{"rollHistory": req.body.rollHistory}})
            .then(item => {
                res.send("Roll History pushed!!!")
            })
            .catch(err => {
                res.send(err)
            })
        }
    })
})

app.post('/api/pushMultiplyBetRollHistory', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send('Error pushing MultiplyBetRollHistory to the database')
        }
        else {
            User.updateOne({"_id": req.body.id}, {$push: {"MultiplyBetRollHistory": req.body.rollHistory}})
            .then(item => {
                res.send("Roll History Pushed !!!")
            })
            .catch(err => {
                res.send(err)
            })
        }
    })
})

app.post('/api/pushFakeDoorHistory', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send('Error pushing Fake Door History to the database')
        }
        else {
            User.updateOne({"_id": req.body.id}, {$push: {"FakeDoorHistory": req.body.history}})
            .then(item => {
                res.send("Fake Door History Added!!!")
            })
            .catch(err => {
                res.send(err)
            })
        }
    })
})

app.post('/api/getRollHistory', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send("Error getting roll history from the database")
        }
        else {
            res.send(result)
        }
    })
})

app.post('/api/getMultiplyBetRollHistory', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send("Error getting MultiplyBet Roll History from the database")
        }
        else {
            res.send(result)
        }
    })
})

app.post('/api/getFakeDoorHistory', (req, res) => {
    User.find({"_id": req.body.id}, function(err, result) {
        if(err) {
            res.status(400).send("Error getting FakeDoor History from the database")
        }
        else {
            res.send(result)
        }
    })
})

app.post('/api/register', (req, res) => {
    console.log(req.body)
    var data = new User(req.body);
    User.find({"username": req.body.username}, function(err, result) {
        if(err) {
            res.status(400).send('Failed Creating Your Account')
        }
        else {
            // console.log("result", result.length)
            if(result.length === 0) {
                User.find({"email": req.body.email}, function(err1, result1) {
                    if(err1) {
                        res.status(400).send('Failed Creating Your Account')
                    }
                    else {
                        if(result1.length === 0) {
                            data.save()
                            .then(item => {
                                res.send('Account Created Successfully')
                            })
                            .catch(err => {
                                res.status(400).send("error saving data in database")
                            })
                        }
                        else {
                            res.send("Email Already Exists with Another Username")
                        }
                    }
                })
            }
            else {
                res.send("Username Already Exists!!")
            }
        }
    })  
})

app.post('/api/login', (req, res) => {
    console.log(req.body)
    User.find({"email": req.body.email, "password": req.body.password}, function(err, users) {
        if(err) {
            // console.log("error logging in")
            res.status(400).send('failed to login')
        }
        else {
            if(users.length === 0)
                res.json({
                    "data": 'Invalid Email or Password. If not having an Account, create one first',
                    "users": users
                })
            else {
                res.json({
                    "data": 'Logged in Successfully',
                    "users": users
                })
                // res.send('Logged in Successfully')
            }
        }
    })
})

app.listen(process.env.PORT || 3080, () => {
    console.log("server listening on port 3080")
})

// app.get('/api/getLotteryWinner', (req, res) => {
//     Lottery.find({}, function(err, result) {
//         if(err) {
//             res.status(400).send("Error getting Lottery ticket winner")
//         }
//         else {
//             // console.log(result)
//             res.json({
//                 winners: result.winners
//             })
//         }
//     })
// })


// Version 0.1.0  Roll only

// // const { roll, getRandomSeed } = require('./code.js');

// var express = require('express');
// var crypto = require('crypto');
// var fs = require('fs');
// var bodyParser = require('body-parser');

// var cors = require('cors');

// var app = express();
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
//   extended: false
// })); 
// app.use(cors());


// // ###################  Helper Functions ##################
// function getRandomSeed() {
//     var seed = fs.readFileSync('serverSeed.txt')
//     var lines = seed.toString().split('\n');
//     var serverSeed = lines[Math.floor(Math.random() * lines.length)];
//     return serverSeed;
// }
// function roll() {
//     var nonce = Math.floor(Math.random() * 10);
//     var str1 = nonce + getRandomSeed() + nonce;
//     var str2 = nonce + "c6WIUwxJ0YBB5Hrc5" + nonce;

//     var hash = crypto.createHash('sha512', str2);
//     hash.update(str1);

//     var soln = hash.digest('hex');
//     soln = soln.slice(0,8);
//     soln = parseInt(soln, 16);
//     soln = soln/429496.7295;

//     return Math.ceil(soln);
// }

// // ################# Requests ####################
// app.get("", (req, res) => {
//     res.send("Hello World");
// })

// app.get('/', (req, res) => {
//     res.send("Try using /api/roll");
// })

// app.get('/api/roll', (req, res) => {
//     var x = roll();
//     res.json({"data": x});
// })

// app.listen(process.env.PORT || 3080, () => {
//     console.log("server listening on port 3080")
// })