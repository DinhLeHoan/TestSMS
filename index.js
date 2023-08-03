const express = require('express')
const cors = require('cors')

const firebaseConfig = require('./config');
const firebase = require("firebase");
firebase.initializeApp(firebaseConfig)
const db = firebase.firestore()

const User = db.collection("Users");
let userRef= null;
let messageRef = null;

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


const onlineUsers = [];

// // Function to handle sign-in status
function handleSignInStatus(uID) {
  // Add the uID to the onlineUsers array if not already present
  if (!onlineUsers.includes(uID)) {
    onlineUsers.push(uID);
  }
}

// Function to handle sign-out status
function handleSignOutStatus(uID) {
  // Remove the uID from the onlineUsers array if it exists
  const index = onlineUsers.indexOf(uID);
  if (index !== -1) {
    onlineUsers.splice(index, 1);
  }
}

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

// Function to check if a date is yesterday
function isYesterday(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
         date.getMonth() === yesterday.getMonth() &&
         date.getFullYear() === yesterday.getFullYear();
}

function formatMessageDate(result) {
  const now = new Date();

  // Get the message date as a Date object
  const messageDate = new Date(result.date);

  // Format the date based on the conditions you described
  if (isToday(messageDate)) {
    result.date = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (isYesterday(messageDate)) {
    result.date = 'Yesterday, ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    result.date = messageDate.toLocaleDateString('en-US') + ', ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return result;
}

// SocketIO
io.on('connection', (socket) => {
  console.log('a user connected');

  //send message to firebase
  socket.on('messageSend', async (messDataSend) => {
    try {
      const uIDTo = messDataSend.uidTo;
      const uIDFrom = messDataSend.uidFrom;
      const message = messDataSend.message;
      const name = messDataSend.name;
      const date = new Date();
  
      const result = {
        name: name,
        message: message,
        date: date
      };
  
      // Save the message to Firestore
      let messageRef = db.collection("Users").doc(uIDFrom).collection("Message").doc(uIDTo).collection("Data");
      await messageRef.add(result);
      messageRef = db.collection("Users").doc(uIDTo).collection("Message").doc(uIDFrom).collection("Data");
      await messageRef.add(result);
  
      // Format the date in the result object before emitting
      const formattedResult = formatMessageDate(result);
  
      // Emit the message back to Java Swing
      const resultJson = JSON.stringify(formattedResult);
      console.log(`${uIDTo}`);
      io.emit(`${uIDTo}`, await resultJson);
    } catch (error) {
      console.error('Error saving message data:', error);
    }
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
      const uIDTo = requestData.uidTo;
      const uIDFrom = requestData.uidFrom;
      userRef =  db.collection("Users").doc(uIDFrom);
      messageRef =  userRef.collection("Message").doc(uIDTo).collection("Data");
      messageRef.get().then((querySnapshot) => {
        let dataArray = []; // Array to store the formatted data
  
        const now = new Date(); // Current date and time
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
  
          // Get the message date as a Date object
          const messageDate = new Date(data.date);
  
          let formattedDate;
          if (isToday(messageDate)) {
            formattedDate = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (isYesterday(messageDate)) {
            formattedDate = 'Yesterday, ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else {
            formattedDate = messageDate.toLocaleDateString('en-US') + ', ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
  
          const formattedData = {
            name: data.name  || '',
            message: data.message,
            date: formattedDate
          };
          if(formattedData.name !== ''){
            dataArray.push(formattedData);
          }
        });
        
        const jsonString = JSON.stringify(dataArray);
        socket.emit('messToSwing', jsonString);
      });
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
  socket.on('signInStatus', async (uID) => {
    handleSignInStatus(uID);
    console.log(onlineUsers)
    socket.emit('getSignInStatus', onlineUsers);
  });

  socket.on('signUpCheck', async (data) => {
    const { username, password, email, name, random } = data;
  
    try {
      // Check if the username already exists
      const usernameSnapshot = await firebaseAdmin
        .firestore()
        .collection('Users')
        .where('username', '==', username)
        .limit(1)
        .get();
  
      if (!usernameSnapshot.empty) {
        socket.emit(`signUpValidate${random}`, false); // Username exists, emit false
        return;
      }
  
      // Check if the email already exists
      const emailSnapshot = await firebaseAdmin
        .firestore()
        .collection('Users')
        .where('email', '==', email)
        .limit(1)
        .get();
  
      if (!emailSnapshot.empty) {
        socket.emit(`signUpValidate${random}`, false); // Email exists, emit false
        return;
      }

      let dataUser = {
        email: email,
        image: "",
        name: name,
        password: password,
        role: "user",
        username: username
      };
  
      let userAdd = db.collection("Users");
      let userRef = await userAdd.add(dataUser);
      
      // Get the user's UID generated by Firestore
      let uID = userRef.id;
      
      let messageRef = db.collection("Users").doc(uID).collection("Message");
      await messageRef.add({
      });
      
      // Both username and email are not found, emit true
      socket.emit(`signUpValidate${random}`, true);

    } catch (error) {
      console.error('Error while checking for existing user:', error.message);
      socket.emit(`signUpValidate${random}`, false); // Emit false in case of an error
    }
  });  

  socket.on('findAndAdd', async (data) => {
    const { name, uID } = data;
  
    try {
      // Check if the username already exists
      const usernameSnapshot = await firebaseAdmin
        .firestore()
        .collection('Users')
        .where('name', '==', name)
        .limit(1)
        .get();
      let uIDFriend = usernameSnapshot.docs[0].id
      if (!usernameSnapshot.empty) {
        // Username exists, emit false
                // Get the user's document with the provided uID
                let userRef = db.collection('Users').doc(uID);
  
                // Create the "Message" subcollection for the user with the given name
                let messageRef = userRef.collection('Message').doc(uIDFriend+'');
                let dataRef = messageRef.collection('Data');
                // Add a sample document into the "Data" subcollection
                await dataRef.add({
                });
                await messageRef.set({
                  // Add your data for the document here
                  // For example:
                  fieldA: 'Value A',
                  // Add more fields as needed
                });

                userRef = db.collection('Users').doc(uIDFriend);
  
                // Create the "Message" subcollection for the user with the given name
                messageRef = userRef.collection('Message').doc(uID+'');
                dataRef = messageRef.collection('Data');
                // Add a sample document into the "Data" subcollection
                await dataRef.add({
                });
                await messageRef.set({
                  // Add your data for the document here
                  // For example:
                  fieldA: 'Value A',
                  // Add more fields as needed
                });
              
        socket.emit(`FindResult${uID}`, true);
        socket.emit(`FindResult${uIDFriend}`, true);
                // socket.emit(`newFriend${uID}`,false)
      } else {
        // Username does not exist, emit true
        socket.emit(`FindResult${uID}`, false);
  

      }
    } catch (error) {
      console.error('Error while checking for existing user:', error.message);
      // Emit false in case of an error
      socket.emit(`FindResult${uID}`, false);
    }
  });
  
  

  // Event listener for 'signOutStatus'
  socket.on('signOutStatus', async (uID) => {
    handleSignOutStatus(uID);
  });
  
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

