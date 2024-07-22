/* eslint-disable max-len */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging(); // Initialize Firebase Messaging

export const scheduleNotification = functions
  .region("europe-west1") // Choose your region
  // Here's where we accept the cron expression as an argument
  .https.onCall((data) => {
    const cronExpression = data.cronExpression; // Extract cron expression from data
    const eventBody = data.eventDate;
    const eventTitle = data.eventTitle;

    // ... (Rest of your code to get tokens and prepare the notification) ...

    // Schedule the notification using the provided cron expression
    const scheduledFunction = functions
      .region("europe-west1") // Choose your region
      .pubsub.schedule(cronExpression) // Use the provided cronExpression
      .onRun(async () => {
        // ... (Send the notification using messaging.send(message)) ...
        const tokens: string[] = []; // Array to store FCM tokens (get from your database)

        // Get user tokens from your database
        const snapshot = await db.collection("users").get();
        snapshot.forEach((doc) => {
          tokens.push(doc.data().token); // Assuming you have an 'fcmToken' field
        });

        // Prepare the notification payload
        const message = {
          notification: {
            title: eventTitle,
            body: eventBody,
          },
          tokens, // Send to the FCM tokens you collected
          condition: "",
        };

        try {
          const response = await messaging.send(message);
          console.log("Successfully sent message:", response);
        } catch (error) {
          console.error("Error sending message:", error);
        }
      });

    console.log(scheduledFunction.name);
  });
