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

const crypto = require('crypto');

const algorithm = 'aes-256-cbc'; 
const secretKey = crypto.createHash('sha256').update('textMinding').digest();;

let currentUser = null; 

process.env.TZ = 'Asia/Ho_Chi_Minh';

const nodemailer = require('nodemailer'); // Required for sending emails

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'textinyourmind@gmail.com', // Your Gmail email
    pass: 'mdmsihcfdlpubipp' // App password or Gmail password (if using 2-step verification)
  }
});


const onlineUsers = [];
const bannedUsers = [];


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

function formatMessageDate(timestamp) {
  if (!timestamp || !timestamp.seconds) {
    return "Unknown Date";
  }

  const seconds = timestamp.seconds * 1000; // Convert seconds to milliseconds
  const messageDate = new Date(seconds);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate >= today) {
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (messageDate >= yesterday) {
    return 'Yesterday, ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return messageDate.toLocaleDateString('en-US') + ', ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function formatTimestamp(timestampString) {
  const messageDate = new Date(timestampString);

  if (isNaN(messageDate.getTime())) {
    // Invalid date format, return "Unknown Date"
    return "Unknown Date";
  }

  // Get the current date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get the date for yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Compare the message date with today and yesterday
  if (messageDate >= today) {
    // If the message date is today, format it as "8:03:52 AM"
    return messageDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (messageDate >= yesterday) {
    // If the message date is yesterday, format it as "Yesterday, 8:03:52 AM"
    return 'Yesterday, ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    // If the message date is before yesterday, format it as "03/06/2023, 8:03:52 AM"
    return messageDate.toLocaleDateString('en-US') + ', ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// Custom comparison function for sorting
function customSortByDate(a, b) {
  const dateA = parseDate(a.date).getTime();
  const dateB = parseDate(b.date).getTime();

  if (dateA > dateB) {
    return 1;
  } else if (dateA < dateB) {
    return -1;
  }
  return 0;
}

function parseDate(dateString) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}) (AM|PM)|Yesterday, (\d{1,2}):(\d{2}) (AM|PM)|(\d{1,2}):(\d{2}) (AM|PM)/;
  const match = dateString.match(dateRegex);
  if (match) {
    if (match[1] && match[2] && match[3] && match[4] && match[5]) {
      // Format: dd/MM/yyyy, hh:mm AM/PM
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const year = parseInt(match[3]);
      let hours = parseInt(match[4]);
      const minutes = parseInt(match[5]);
      const ampm = match[6].toUpperCase();
      if (ampm === "PM" && hours < 12) {
        hours += 12;
      } else if (ampm === "AM" && hours === 12) {
        hours = 0;
      }
      return new Date(year, month, day, hours, minutes);
    } else if (match[7] && match[8] && match[9]) {
      // Format: Yesterday, hh:mm AM/PM
      const hours = parseInt(match[7]);
      const minutes = parseInt(match[8]);
      const ampm = match[9].toUpperCase();
      let date = new Date(yesterday);
      if (ampm === "PM" && hours < 12) {
        date.setHours(hours + 12, minutes, 0, 0);
      } else if (ampm === "AM" && hours === 12) {
        date.setHours(0, minutes, 0, 0);
      } else {
        date.setHours(hours, minutes, 0, 0);
      }
      return date;
    } else if (match[10] && match[11]) {
      // Format: hh:mm AM/PM
      const hours = parseInt(match[10]);
      const minutes = parseInt(match[11]);
      const ampm = match[12].toUpperCase();
      let date = new Date(now);
      if (ampm === "PM" && hours < 12) {
        date.setHours(hours + 12, minutes, 0, 0);
      } else if (ampm === "AM" && hours === 12) {
        date.setHours(0, minutes, 0, 0);
      } else {
        date.setHours(hours, minutes, 0, 0);
      }
      return date;
    }
  }
  return now; // Return the current date if the format doesn't match
}

function unbanUser(uID) {
  // Remove the uID from the onlineUsers array if it exists
  const index = bannedUsers.indexOf(uID);
  if (index !== -1) {
    bannedUsers.splice(index, 1);
  }
}

function banUser(uID) {
  if (!bannedUsers.includes(uID)) {
    bannedUsers.push(uID);
  }
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Decrypt a string
function decrypt(encryptedText) {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Test the function

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
  
      const resultToSwing = {
        name: result.name,
        message: result.message,
        date: formatTimestamp(result.date)
      };
      // Format the date in the result object before emitting
      // Emit the message back to Java Swing
      const resultJson = JSON.stringify(resultToSwing);

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
  
      const jsonUserList = await JSON.stringify(userList);
      socket.emit(`pushListFriend${userID}`,await jsonUserList);
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
        const dataArray = []; // Array to store the formatted data        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
  
          // Get the message date as a Date object
          const formattedData = {
            name: data.name  || '',
            message: data.message,
            date: formatMessageDate(data.date)
          };

          if(formattedData.name !== ''){
            dataArray.push(formattedData);
          }


        });
        // dataArray.sort(customSortByDate)
        const jsonString = JSON.stringify(dataArray.sort(customSortByDate));
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
      if (decrypt(userData.password) !== password) {
        throw new Error('Invalid password');
      }
      
      if(onlineUsers.includes(userDoc.id)){
        const errorString = "This account is already signed in";
        socket.emit('signInError', errorString);
        return;
      }

      if(bannedUsers.includes(userDoc.id)){
        const errorString = "This account is already banned";
        socket.emit('signInError', errorString);
        return;
      }

      currentUser = {
        name: userData.name,
        username: userData.username,
        password: decrypt(userData.password),
        uID: userDoc.id,
        email: userData.email,
        role: userData.role
      };
      const jsonUser = JSON.stringify(currentUser);
      // Emit the 'signInSuccess' event to the client with the user's UID
      socket.emit('signInSuccess', jsonUser);
      handleSignInStatus(currentUser.uID);
      console.log(onlineUsers)
      socket.emit('getSignInStatus', onlineUsers);
      
    } catch (error) {
      console.error('Sign-in error:', error.message);

      // Emit the 'signInError' event to the client with the error message
      socket.emit('signInError', error.message);
    }
  });

  // // Event listener for 'signInStatus'
  socket.on('signInStatus', async (uID) => {
    handleSignInStatus(uID);
    socket.emit('getSignInStatus', onlineUsers);
  });

  setInterval(() => {
    socket.emit('getSignInStatus', onlineUsers);
  }, 100); 

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
        password: encrypt(password),
        role: "user",
        username: username
      };
  
      let userAdd = db.collection("Users");
      let userRef = await userAdd.add(dataUser);
      
      // Get the user's UID generated by Firestore
      let uID = userRef.id;
      
      let messageRef = db.collection("Users").doc(uID).collection("Message");
      let friendRQRef = db.collection("Users").doc(uID).collection("FriendRequest");
      await messageRef.add({
      });
      await friendRQRef.add({
      });
      // Both username and email are not found, emit true
      socket.emit(`signUpValidate${random}`, true);

    } catch (error) {
      console.error('Error while checking for existing user:', error.message);
      socket.emit(`signUpValidate${random}`, false); // Emit false in case of an error
    }
  });  

  socket.on('findAndAdd', async (data) => {
    const { nameOrMail, uID } = data;
    const foundUsers = []; // Array to store found users
    try {

      // Look up users by name
      const nameSnapshot = await firebaseAdmin
        .firestore()
        .collection('Users')
        .where('name', '==', nameOrMail)
        .get();
  
      nameSnapshot.forEach((doc) => {
        const user = doc.data();
        const found = {
          name: user.name,
          uID: doc.id,
        };
        foundUsers.push(found);
      });
  
      // If no users found by name, look up users by email
      if (foundUsers.length === 0) {
        const emailSnapshot = await firebaseAdmin
          .firestore()
          .collection('Users')
          .where('email', '==', nameOrMail)
          .get();
  
        emailSnapshot.forEach((doc) => {
          const user = doc.data();
          const found = {
            name: user.name,
            uID: doc.id,
          };
          foundUsers.push(found);
        });
      }
  
      // Emit the array of found users to the client
      socket.emit(`FindResult${uID}`, foundUsers);
      console.log(foundUsers)
    } catch (error) {
      console.error('Error:', error.message);
      // Handle the error if needed
    }
  });  

  // Event listener for 'signOutStatus'
  socket.on('signOutStatus', async (uID) => {
    handleSignOutStatus(uID);

    console.log(onlineUsers)
  });
  
  socket.on('sendRequestFriend', async (data) => {
    const { uidTo, nameFrom, uidFrom } = data;
    const friendRequest = db.collection('Users').doc(uidTo).collection('FriendRequest');
    
    friendRequest.doc(uidFrom).set({});

    const someOne = {
      name: nameFrom,
      uID: uidFrom
    };

    const someOneJson = await JSON.stringify(someOne);
    io.emit(`someOneSendRQ${uidTo}`,await someOneJson);

  });
  
  socket.on('getAllRequestFriend', async (uID) => {
    try {
      // Create a reference to the 'FriendRequest' collection for the given uID
      const friendRequestRef = db.collection('Users').doc(uID).collection('FriendRequest');
      
      // Get all documents from the 'FriendRequest' collection
      const friendRequestSnapshot = await friendRequestRef.get();
      
      // Create an array to store the requests
      const friendRequests = [];
      
      // Loop through the friend request documents
      friendRequestSnapshot.forEach((doc) => {
        // Get the data of the friend request document
        const request = doc.id;
        
        // Add the request data to the array
        friendRequests.push(request);
      });
      
      // Create an array to store the found users
      const foundUsers = [];
      
      // Loop through the friend requests and find user information
      for (const request of friendRequests) {
        // Use the sender's uID to look up their information
        const senderSnapshot = await db.collection('Users').doc(request).get();
        if (senderSnapshot.exists) {
          const senderData = senderSnapshot.data();
          
          // Add sender's information to the array
          foundUsers.push({
            name: senderData.name,
            uID: request,
          });
        }
      }
      
      // Emit the foundUsers array back to the client
      socket.emit(`foundUsersSendRQ${uID}`, foundUsers);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      // Handle the error and emit an appropriate response
    }
  });
  
  socket.on('acceptOrDenyFriend', async (data) => {
    const { uidFrom, uidTo, result } = data;
    try {
      const friendRequestRef = db.collection('Users').doc(uidTo).collection('FriendRequest').doc(uidFrom);
  
      if (result === true) {
        // Remove the FriendRequest document with uidFrom
        await friendRequestRef.delete();
  
        // Add a new document to the Message collection

        await db.collection('Users').doc(uidFrom).collection('Message').doc(uidTo).set({});
        await db.collection('Users').doc(uidTo).collection('Message').doc(uidFrom).set({});
        
        io.emit(`newFriend${uidFrom}`, await true)
        socket.emit(`newFriend${uidTo}`,true)
      } else if (result === false) {
        // Remove the FriendRequest document with uidFrom
        await friendRequestRef.delete();
        socket.emit(`notNewFriend${uidTo}`,true)
        // Emit success response to the client
      } 
      else{
        console.log('nothing happen')
      }



    } catch (error) {
      console.error('Error handling friend request:', error);
      // Handle error and emit error response to the client if needed
    }
  });
  
  socket.on('getValicateEmail', async (data) => {
    try {
      const { email, random,type } = data;
      // Generate a random verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000);
      let typeOfMail = null;
      if(type=="resetpass"){
        typeOfMail = "Password Reset Request";
      }
      else if(type == "verification"){
        typeOfMail = "Email Verification Code";
      }
      else{
        typeOfMail = "Password and username Request";
      }
      // Configure email options
      const mailOptions = {
        from: 'textinyourmind@gmail.com',
        to: email,
        subject: `${typeOfMail}`,
        html: `
          <h2>${typeOfMail}</h2>
          <p>Thank you for ${typeOfMail} with TextInYourMind. Your verification code is:</p>
          <p style="font-size: 24px; font-weight: bold;">${verificationCode}</p>
          <p>Please use this code to complete your ${typeOfMail} process.</p>
          <p>If you did not request this verification code, please disregard this email.</p>
          <p>Thank you,<br/>The TextInYourMind Team</p>
        `
      };
      

      // Send the email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          // Handle error and emit error response to the client if needed
        } else {
          const verify = {
            code: verificationCode,
            mailOfThis: email
          };
      
          const verifyJson = JSON.stringify(verify);
          socket.emit(`verificationCodeSent${random}`, verifyJson); // Emit event to Java Swing app
        }
      });
    } catch (error) {
      console.error('Error handling email verification:', error);
      // Handle error and emit error response to the client if needed
    }
  });

  socket.on('changePassword', async (data) => {
    try {
      const { uID, password } = data;

      // Assuming 'Users' is your Firestore collection reference
      const userRef = db.collection('Users').doc(uID);

      // Update the user's password field
      await userRef.update({ password: encrypt(password) });


      socket.emit(`passwordChangeSuccess${uID}`, true); // Emit success event to Java Swing app
    } catch (error) {
      socket.emit(`passwordChangeSuccess${uID}`, false); // Emit success event to Java Swing app
      // Handle error and emit error response to the client if needed
    }
  });

  socket.on('sendUserAndPass', async (data) => {
    try {
      // Search for the validateMail in the Users collection
      const { email, random } = data;
      const userSnapshot = await db.collection('Users').where('email', '==', email).get();

      if (!userSnapshot.empty) {
        const user = userSnapshot.docs[0].data();
        const { username, password } = user;

        const mailOptions = {
          from: 'textinyourmind@gmail.com',
          to: email,
          subject: 'Account Information',
          html: `
            <h2>Your Account Information</h2>
            <p>Username: ${username}</p>
            <p>Password: ${decrypt(password)}</p>
            <p>Please keep your account information secure.</p>
            <p>Thank you,<br/>The TextInYourMind Team</p>
          `
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            // Handle error and emit error response to the client if needed
          } else {
            // Emit event to Java Swing app indicating success
            socket.emit(`successGetUserPass${random}`, true);
          }
        });
      } else {
        // Emit event to Java Swing app indicating failure
        socket.emit(`successGetUserPass${random}`, false);
      }
    } catch (error) {
      console.error('Error handling sendUserAndPass:', error);
      // Handle error and emit error response to the client if needed
    }
  });

  socket.on('removeFriend', async (removeFriendData) => {
    try {
      const { uidFrom, uidTo } = removeFriendData;

      // Clear related messages
      await db.collection('Users').doc(uidFrom).collection('Message').doc(uidTo).delete();
      await db.collection('Users').doc(uidTo).collection('Message').doc(uidFrom).delete();
  
      // Emit success response to the client
      await io.emit(`newFriend${uidFrom}`, false);
      await io.emit(`newFriend${uidTo}`, false);
    } catch (error) {
      console.error('Error removing friend:', error);
      // Handle error and emit error response to the client if needed
    }
  });
  
  socket.on('reportUser', async (reportData) => {
    try {
      const { uidFrom, uidTo, detail } = reportData;
  
      const reportsRef = db.collection('Reports');
  
      // Create a new report document
      await reportsRef.add({
        uidFrom: uidFrom,
        uidTo: uidTo,
        detail: detail,
      });
      io.emit('newReport',true);
      // Emit success response to the client
    } catch (error) {

    }
  });
  
  socket.on('getListReported', async (data) => {

      try {
        const reportsRef = db.collection('Reports');
        const reportsSnapshot = await reportsRef.get();
  
        const listReport = [];
  
        for (const doc of reportsSnapshot.docs) {
          const reportData = doc.data();
          const uIDto = reportData.uidTo;
  
          // Fetch user details from the Users collection
          const userRef = db.collection('Users').doc(uIDto);
          const userDoc = await userRef.get();
  
          if (userDoc.exists) {
            const userData = userDoc.data();
            const userReported = {
              name: userData.name,
              uIDfrom: reportData.uidFrom,
              uIDto: reportData.uidTo,
              detail: reportData.detail
            };
            listReport.push(userReported);
          }
        }
        io.emit(`pushListReported${data}`, JSON.stringify(listReport));
      } catch (error) {
        console.error('Error fetching reported users:', error);
        // Handle error and emit error response to the client if needed
      }
    });

  socket.on('banUser', async (idTo) => {
    try {
      banUser(idTo);
      const reportsCollectionRef = db.collection('Reports'); // Your reports collection reference
      const querySnapshot = await reportsCollectionRef.where('uidTo', '==', idTo).get();
  
      // Delete documents where uidTo matches idTo
      const batch = db.batch();
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
  
      await batch.commit();
      io.emit('newReport',true);

      io.emit(`banUser${idTo}`,true);
      // Emit success response to the client
    } catch (error) {

    }
  });

  socket.on('findAndUnban', async (data) => {
    const { mail, uID } = data;
    const foundUsers = []; // Array to store found users
    try {
  
      // If no users found by name, look up users by email
      if (foundUsers.length === 0) {
        const emailSnapshot = await firebaseAdmin
          .firestore()
          .collection('Users')
          .where('email', '==', mail)
          .get();
  
        emailSnapshot.forEach((doc) => {
          const user = doc.data();
          const found = {
            name: user.name,
            uID: doc.id,
          };
          unbanUser(found.uID)
          foundUsers.push(found);
        });
      }
      if(foundUsers.length==0){
        const logg = "error";
        socket.emit(`banResult${uID}`, logg);
      }
      else{
        const logg = "Success";
        socket.emit(`banResult${uID}`, logg);
        
      }
      // Emit the array of found users to the client
    } catch (error) {
      console.error(`Error:${uID}`, error.message);
      // Handle the error if needed
    }
  }); 

});

// open port by server
server.listen(PORT, () => {
  console.log('listening on 3000')
})

