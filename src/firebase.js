import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCbK9VmWQ9e-VuYY1vqpOLYHLtcy7yl3QI",
  authDomain: "bam-league.firebaseapp.com",
  projectId: "bam-league",
  storageBucket: "bam-league.firebasestorage.app",
  messagingSenderId: "820882962262",
  appId: "1:820882962262:web:5e2f884f85e82f00b388f7",
  measurementId: "G-FLFE44M753",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);