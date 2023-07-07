const express = require('express');
const app = express();

const firebase = require('firebase');
const firebaseConfig = require('./TestSMS/config');
const database = firebase.database();
firebase.initializeApp(firebaseConfig);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.write(`<h1>heo ne: ${PORT}</h1>`);
  res.end();
});

app.listen(3000, () => {
  console.log('listening on *:3000');
});

// Read data from the database
database
  .ref('messages')
  .once('value')
  .then((snapshot) => {
    const messages = snapshot.val();
    console.log(messages);
  })
  .catch((error) => {
    console.error('Error reading data:', error);
  });

// Write data to the database
const newMessage = 'Hello, Firebase!';
database
  .ref('messages')
  .push(newMessage)
  .then(() => {
    console.log('Data written successfully');
  })
  .catch((error) => {
    console.error('Error writing data:', error);
  });
