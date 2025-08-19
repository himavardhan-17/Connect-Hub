
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDKG2_AreZcGkrDrj_df_ayn_bz8oGv-8E",
  authDomain: "connect-hub-a47cc.firebaseapp.com",
  projectId: "connect-hub-a47cc",
  storageBucket: "connect-hub-a47cc.appspot.com",
  messagingSenderId: "301552525362",
  appId: "1:301552525362:web:3277ee1c0c24017b001c2b",
  measurementId: "G-B3VN0HWMB4"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);


export { db, auth };
