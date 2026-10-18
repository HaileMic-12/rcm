import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA5zbK4LG4Fitmjlv9ADlnAF9xS7erD-a8",
  authDomain: "rcm-study-app.firebaseapp.com",
  projectId: "rcm-study-app",
  storageBucket: "rcm-study-app.firebasestorage.app",
  messagingSenderId: "951222478105",
  appId: "1:951222478105:web:fb59888d252566ea539188",
  measurementId: "G-RGY9RLZCRF"
};

// Initialize Firebase safely for Next.js hot-reloading
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export the Firestore database instance so your app can use it
export const db = getFirestore(app);