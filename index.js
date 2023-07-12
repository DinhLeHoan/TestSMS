const express = require('express')
const cors = require('cors')

const { User, messageRef } = require('./config');

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
  console.log('a user connected');

  socket.on('message',async (ms) => {
    const inputString = ms;
    const [user, message] = inputString.split(" : ");
    const dataArray = [];

    const result = {
      name: user.trim(),
      message: message.trim(),
      date: Date()
    };
    dataArray.push(result);
    const jsonString = JSON.stringify(dataArray);
    
    io.emit('message', jsonString);

    const messageRefSnapshot = await messageRef.get();
    let nextIdNumber = 6; // Starting ID number
    messageRefSnapshot.forEach((doc) => {
      const idNumber = parseInt(doc.id.substr(1));
      if (idNumber >= nextIdNumber) {
        nextIdNumber = idNumber + 1;
      }
    });
    
    // Generate the custom ID
    const customId = `m${nextIdNumber}`;
    
    messageRef.doc(customId).set(result)
  });

  socket.on('UserData', async (requestData) => {
    try {
      if (requestData && requestData.request === true) {
        const snapshot = await User.get(); // Assuming User.get() returns a Firestore collection reference
        const list = snapshot.docs.map((doc) => doc.data());
        const jsonString = JSON.stringify(list);
        socket.emit('Userlist', jsonString);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  });

  socket.on('LoadMess', async (requestData) => {
    try {
      // if (requestData && requestData.request === true) {
        messageRef.get().then((querySnapshot) => {
          const dataArray = []; // Array to store the formatted data
          
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const formattedData = {
              name: data.name,
              message: data.message
            };
            dataArray.push(formattedData);
          });
          const jsonString = JSON.stringify(dataArray);
          socket.emit('messToSwing', jsonString);
        });
       //} 
      
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  });

});

app.post("/create", async (req, res) => {
  // const data = req.body
  const snapshot = await User.get(); // Assuming User.get() returns a Firestore collection reference
  const list = snapshot.docs.map((doc) => doc.data());
  console.log(list)
})

server.listen(PORT, () => {
  console.log('listening on 3000')
})