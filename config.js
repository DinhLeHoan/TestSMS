const firebase = require("firebase");
const firebaseConfig = {
  apiKey: "AIzaSyAydhNBsKkslRoGKvSj3-yI8GE2jo7FLJo",
  authDomain: "textmind-ce96f.firebaseapp.com",
  databaseURL: "https://textmind-ce96f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "textmind-ce96f",
  storageBucket: "textmind-ce96f.appspot.com",
  messagingSenderId: "518243305900",
  appId: "1:518243305900:web:3297a21724473284215209",
  measurementId: "G-NM74MXCR1E"
};
firebase.initializeApp(firebaseConfig)
const db = firebase.firestore()
const User = db.collection("Users")
module.exports = User