const express = require('express')
const cors = require('cors')
const User = require('./config')
const app = express()
app.use(express.json())
app.use(cors())
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server)
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.write('<h1>Server is online</h1>')
})

io.on('connection', (socket) => {
  console.log('a user connected')
  socket.on('message', (ms) => {
    io.emit('message', ms)
    const inputString = ms;
    const [user, message] = inputString.split(" : ");
    const result = {
      user: user.trim(),
      message: message.trim(),
      date: Date()
    };
    User.add(result)
  })

  socket.on('UserData', async () => {
    try {
      const snapshot = await User.get(); // Assuming User.get() returns a Firestore collection reference
      const list = snapshot.docs.map((doc) => doc.data());
      const jsonString = JSON.stringify(list);
      socket.emit('Userlist', jsonString);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  });
})

app.post("/create", async (req, res) => {
  // const data = req.body
  const snapshot = await User.get(); // Assuming User.get() returns a Firestore collection reference
  const list = snapshot.docs.map((doc) => doc.data());
  console.log(list)
})

server.listen(PORT, () => {
  console.log('listening on 3000')
})