const express = require('express')
const cors = require('cors')

const firebaseConfig = require('./config');
const firebase = require("firebase");
firebase.initializeApp(firebaseConfig)
const db = firebase.firestore()

const User = db.collection("Users");
const userRe= null;
const messageRef = null;

const firebaseAdmin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
});

const app = express()

app.use(express.json())
app.use(cors())
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server)
const PORT = process.env.PORT || 3000;

const bcrypt = require('bcrypt');

let currentUser = null; 

async function verifyPassword(plainPassword, hashedPassword) {
  try {
    // Compare the plain password with the hashed password
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Error while verifying password:', error);
    return false;
  }
}


// const onlineUsers = [];

// // Function to handle sign-in status
// function handleSignInStatus(uID) {
//   // Add the uID to the onlineUsers array if not already present
//   if (!onlineUsers.includes(uID)) {
//     onlineUsers.push(uID);
//   }
// }

// // Function to handle sign-out status
// function handleSignOutStatus(uID) {
//   // Remove the uID from the onlineUsers array if it exists
//   const index = onlineUsers.indexOf(uID);
//   if (index !== -1) {
//     onlineUsers.splice(index, 1);
//   }
// }

//set user to use
function setUser(uIDFrom,uIDTo) {
    userRef = db.collection("Users").doc(uIDFrom);
    messageRef = userRef.collection("Message").doc(uIDTo).collection("data");
}

// SocketIO
io.on('connection', (socket) => {
  console.log('a user connected');

  //send message to firebase
  socket.on('messageSend',async (ms) => {
    const inputString = ms;
    const [user, message] = inputString.split(" : ");
    const dataArray = [];

    const result = {
      name: user.trim(),
      message: message.trim(),
      date: Date()
    };
    dataArray.push(result);

    // convert result to Json
    const jsonString = JSON.stringify(dataArray);
    
    // push Json( message ) to java swing
    io.emit('messageGet',await jsonString);

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

  //  get list user from firebase then push to java swing by emit
  socket.on('getListFriend', async (userID) => {
    try {
      const messageRef = db.collection("Users").doc(userID).collection("Message");
      const messageSnapshot = await messageRef.get();

      const friendIDs = [];

      messageSnapshot.forEach((messageDoc) => {
        const friendID = messageDoc.id;
        friendIDs.push(friendID);
      });
  
      const userList = [];
      for (const friendID of friendIDs) {
        const friendDoc = await db.collection("Users").doc(friendID).get();
        if (friendDoc.exists) {
          const friendData = friendDoc.data();
          const formattedFriend = {
            name: friendData.name,
            username: friendData.username,
            password: friendData.password,
            uID: friendID,
          };
          userList.push(formattedFriend);
        }
      }
  
      const jsonUserList = JSON.stringify(userList);
      socket.emit('pushListFriend', jsonUserList);
    } catch (error) {
      console.error('Error fetching list of friends:', error);
    }
  });
  
  // load message from firebase then push to javaswing by emit 
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

  socket.on('signIn', async (userInfor) => {
    try {
      const inputString = userInfor;
      const [username, password] = inputString.split(" : ");
      if (!username || !password) {
        throw new Error('Email and password are required.');
      }

      // signin by database
      const userSnapshot = await firebaseAdmin
        .firestore()
        .collection('Users')
        .where('username', '==', username)
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        throw new Error('User not found');
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();

      // Perform password validation here (assuming password is stored securely)
      if (userData.password !== password) {
        throw new Error('Invalid password');
      }
      

      currentUser = {
        name: userData.name,
        username: userData.username,
        password: userData.password,
        uID: userDoc.id
      };
      const jsonUser = JSON.stringify(currentUser);
      // Emit the 'signInSuccess' event to the client with the user's UID
      socket.emit('signInSuccess', jsonUser);
    } catch (error) {
      console.error('Sign-in error:', error.message);

      // Emit the 'signInError' event to the client with the error message
      socket.emit('signInError', error.message);
    }
  });

  // // Event listener for 'signInStatus'
  // socket.on('signInStatus', async (uID) => {
  //   handleSignInStatus(uID);
  //   console.log(onlineUsers)
  //   socket.emit('getSignInStatus', onlineUsers);
  // });

  // // Event listener for 'signOutStatus'
  // socket.on('signOutStatus', async (uID) => {
  //   handleSignOutStatus(uID);
  // });
  
});

// example to create by object Express by pist create
app.post("/create", async (req, res) => {
  // const data = req.body
  const snapshot = await User.get(); // Assuming User.get() returns a Firestore collection reference
  const list = snapshot.docs.map((doc) => doc.data());
  console.log(list)
})

// open port by server
server.listen(PORT, () => {
  console.log('listening on 3000')
})

