import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration (FlowPass project)
const firebaseConfig = {
  apiKey: 'AIzaSyDg-JVhD7ah6yZPCgvw3g1j6MJlWzDVluM',
  authDomain: 'flowpasssystem.firebaseapp.com',
  projectId: 'flowpasssystem',
  storageBucket: 'flowpasssystem.appspot.com',
  messagingSenderId: '353086720712',
  appId: '1:353086720712:web:371f4684562f1146ba33fd',
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);