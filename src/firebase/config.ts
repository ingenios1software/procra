import { getFirestore } from "firebase/firestore";
import { initializeFirebase } from ".";

export const firebaseConfig = {
  "projectId": "studio-7905412770-89bf5",
  "appId": "1:1088552341362:web:ab8ca6f9994189f19fd7eb",
  "apiKey": "AIzaSyDZUYQ9ErB6x34xl9LXgR6uU-HMbRQyT2A",
  "authDomain": "studio-7905412770-89bf5.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1088552341362"
};

// This is a hack to get the firestore instance in the importer.
// Don't do this at home.
const { firestore } = initializeFirebase();
export const db = firestore;
