/* eslint-disable max-len */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as cheerio from "cheerio";
import {parse} from "date-fns";
import {it} from "date-fns/locale";

admin.initializeApp();

const db = admin.firestore();
const collection = db.collection("events");
const messaging = admin.messaging(); // Initialize Firebase Messaging

const formatString = "d MMMM yyyy";

interface Event {
  name: string;
  date: Date;
  location: string;
}

type ScrapingFunction = () => Promise<{ eventsPromises: Promise<void>[]; events: Event[] }>;

// Create a list of scraping functions
const scrapingFunctions: ScrapingFunction[] = [
  scrapeSanSiroConcerts,
  scrapeIppodromoLaMauraConcerts,
  scrapeIppodromoConcerts,
];

export const scrapeEvents = functions
  .region("europe-west1")
  .pubsub.schedule("every 24 hours")
  .onRun(async (context) => {
    try {
      const allEvents: Event[] = [];

      // Iterate through each scraping function
      for (const scrapeFunction of scrapingFunctions) {
        // Call the scraping function and get the results
        const {eventsPromises, events} = await scrapeFunction();

        // Wait for all promises to resolve
        await Promise.all(eventsPromises);

        // Add the scraped events to the allEvents array
        allEvents.push(...events);
      }

      console.log("3. Ci sono " + allEvents.length + " nuovi concerti");
      const eventsToAdd: Event[] = [];

      for (const event of allEvents) {
        const eventExists = await checkEventExists(event);
        if (eventExists === false) {
          if (new Date() > new Date(event.date)) {
            console.log("Evento " + event.name + " già passato");
          } else {
            console.log(
              "Inserimento nuovo concerto " + event.name + " " + event.date
            );
            eventsToAdd.push(event);
          }
        }
      }

      // Salva gli eventi in Firestore
      const batch = db.batch();
      eventsToAdd.forEach((event) => {
        batch.set(collection.doc(), event);
      });
      await batch.commit();

      return null;
    } catch (error) {
      console.error("Error scraping events:", error);
      throw new functions.https.HttpsError("internal", "Error scraping events");
    }
  });

/**
 *
 * @param {Event} event event name
 * @return {boolean} if exists
 */
async function checkEventExists(event: Event): Promise<boolean> {
  try {
    const querySnapshot = await collection
      .where("name", "==", event.name)
      .where("date", "==", event.date)
      .get();

    return !querySnapshot.empty; // Returns true if the event exists
  } catch (error) {
    console.error("Error checking event existence:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error checking event existence"
    );
  }
}

/**
 *
 * @return {Object} events
 */
async function scrapeSanSiroConcerts() {
  console.log("Scraping concerti a San Siro");

  const events: Event[] = [];
  const eventsPromises: Promise<void>[] = []; // Array to store Promises

  const location = "Stadio San Siro";
  const url = "https://www.sansirostadium.com/live/I-grandi-concerti-di-San-Siro";

  const {data} = await axios.get(url);
  const $ = cheerio.load(data);

  $(".container")
    .find(".row.row0.row-eq-height")
    .each((i: any, element: any) => {
      const name = $(element)
        .find(".boxNota")
        .find(".titolo.alignTextCenter div")
        .text()
        .trim();

      const stringedDate = $(element)
        .find(".boxNota")
        .find(".titolo span.uppercase")
        .text()
        .trim();

      const dateWithoutDay = stringedDate.replace(/^[a-zA-ZàèìòùÀÈÌÒÙ]+\s/, "");
      console.log("Trovato: " + name + " " + dateWithoutDay);
      const date = parse(dateWithoutDay, formatString, new Date(), {
        locale: it,
      });

      if (name && date) {
        eventsPromises.push(
          new Promise((resolve, reject) => {
            events.push({
              name,
              date,
              location,
            });
          })
        );
      }
    });
  return {eventsPromises, events};
}

/**
 *
 * @return {Object} events
 */
async function scrapeIppodromoLaMauraConcerts() {
  console.log("Scraping concerti all'Ippodromo La Maura");

  const events: Event[] = [];
  const eventsPromises: Promise<void>[] = []; // Array to store Promises


  const location = "Ippodromo La Maura";
  const url = "https://www.livenation.it/venue/1330887/ippodromo-snai-la-maura-tickets";

  const {data} = await axios.get(url);
  const $ = cheerio.load(data);

  $(".artistticket")
    .each((i: any, element: any) => {
      const name = $(element)
        .find(".artistticket__name")
        .text()
        .trim();

      const scrapedMonth = $(element)
        .find(".date__month")
        .text()
        .trim();

      const scrapedDay = $(element)
        .find(".date__day")
        .text()
        .trim();

      const stringedDate = scrapedDay + " " + scrapedMonth;
      const dateWithoutDay = stringedDate.replace(/^[a-zA-ZàèìòùÀÈÌÒÙ]+\s/, "");
      console.log("Trovato: " + name + " " + dateWithoutDay);
      const date = parse(dateWithoutDay, formatString, new Date(), {
        locale: it,
      });

      if (name && date) {
        eventsPromises.push(
          new Promise((resolve, reject) => {
            events.push({
              name,
              date,
              location,
            });
          })
        );
      }
    });
  return {eventsPromises, events};
}

/**
 *
 * @return {Object} events
 */
async function scrapeIppodromoConcerts() {
  console.log("Scraping concerti all'Ippodromo San Siro");

  const events: Event[] = [];
  const eventsPromises: Promise<void>[] = []; // Array to store Promises


  const location = "Ippodromo San Siro";
  const url = "https://www.livenation.it/venue/320388/ippodromo-snai-san-siro-tickets";

  const {data} = await axios.get(url);
  const $ = cheerio.load(data);

  $(".artistticket")
    .each((i: any, element: any) => {
      const name = $(element)
        .find(".artistticket__name")
        .text()
        .trim();

      const scrapedMonth = $(element)
        .find(".date__month")
        .text()
        .trim();

      const scrapedDay = $(element)
        .find(".date__day")
        .text()
        .trim();

      const stringedDate = scrapedDay + " " + scrapedMonth;
      const dateWithoutDay = stringedDate.replace(/^[a-zA-ZàèìòùÀÈÌÒÙ]+\s/, "");
      console.log("Trovato: " + name + " " + dateWithoutDay);
      const date = parse(dateWithoutDay, formatString, new Date(), {
        locale: it,
      });

      if (name && date) {
        eventsPromises.push(
          new Promise((resolve, reject) => {
            events.push({
              name,
              date,
              location,
            });
          })
        );
      }
    });
  return {eventsPromises, events};
}

export const scheduleNotification = functions
  .region("europe-west1")
  .https
  .onRequest((req, resp) => {
    const data = req.body;
    const cronExpression = data.cronExpression; // Extract cron expression from data
    const eventBody = data.eventDate;
    const eventTitle = data.eventTitle;

    // ... (Rest of your code to get tokens and prepare the notification) ...
    console.log("SCHEDULE");

    // Schedule the notification using the provided cron expression
    const scheduledFunction = functions
      .region("europe-west1") // Choose your region
      .pubsub.schedule(cronExpression) // Use the provided cronExpression
      .onRun(async (context) => {
        console.log("RUN");
        // ... (Send the notification using messaging.send(message)) ...
        const tokens: string[] = []; // Array to store FCM tokens (get from your database)

        // Get user tokens from your database
        const snapshot = await db.collection("fcmTokens").get();
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
    resp.send("OK");
  });
