/* eslint-disable max-len */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as cheerio from "cheerio";
import {parse} from "date-fns";
import {it} from "date-fns/locale";
import {MulticastMessage} from "firebase-admin/lib/messaging/messaging-api";
import {QueryDocumentSnapshot} from "firebase-functions/v1/firestore";


admin.initializeApp();

const db = admin.firestore();
const collection = db.collection("events");
// const messaging = admin.messaging(); // Initialize Firebase Messaging

const formatString = "d MMMM yyyy";

interface Event {
  name: string;
  date: Date;
  location: string;
  createdOn: Date;
}

const runtimeOpts = {
  timeoutSeconds: 300, // Increased timeout
};

/**
 *
 * @param {Object} html page
 * @param {String} location venue
 * @return {Event[]} events
 */
function parseEvents(html: cheerio.Element, location: string): Event[] {
  const $ = cheerio.load(html);
  const events: Event[] = [];

  const createdOn: Date = new Date();

  // San Siro specific selectors
  if (location === "Stadio San Siro") {
    $(".container")
      .find(".row.row0.row-eq-height")
      .each((i, element) => {
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
        const date = parse(dateWithoutDay, formatString, new Date(), {
          locale: it,
        });

        if (name && date) {
          events.push({
            name,
            date,
            location,
            createdOn,
          });
        }
      });
  } else {
    // Livenation.it specific selectors
    $(".artistticket").each((i, element) => {
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
      const date = parse(dateWithoutDay, formatString, new Date(), {
        locale: it,
      });

      if (name && date) {
        events.push({
          name,
          date,
          location,
          createdOn,
        });
      }
    });
  }

  return events;
}

/**
 *
 * @param {Event[]} allEvents all events
 * @return {Object} events
 */
async function filterNewEvents(allEvents: Event[]): Promise<Event[]> {
  const eventsToAdd: Event[] = [];

  for (const event of allEvents) {
    const eventExists = await checkEventExists(event);
    if (!eventExists && new Date() < new Date(event.date)) {
      eventsToAdd.push(event);
    }
  }

  return eventsToAdd;
}

/**
 *
 * @param {Event} event event
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

export const scrapeEvents = functions
  .region("europe-west1")
  .runWith(runtimeOpts)
  .pubsub.schedule("every 24 hours")
  .onRun(async () => {
    try {
      // 1. Fetch data from all websites concurrently
      const [sanSiroData, laMauraData, ippodromoData] = await Promise.all([
        axios.get("https://www.sansirostadium.com/live/I-grandi-concerti-di-San-Siro"),
        axios.get("https://www.livenation.it/venue/1330887/ippodromo-snai-la-maura-tickets"),
        axios.get("https://www.livenation.it/venue/320388/ippodromo-snai-san-siro-tickets"),
      ]);

      // 2. Parse data from all responses
      const sanSiroEvents = parseEvents(sanSiroData.data, "Stadio San Siro");
      const laMauraEvents = parseEvents(laMauraData.data, "Ippodromo La Maura");
      const ippodromoEvents = parseEvents(ippodromoData.data, "Ippodromo San Siro");

      // 3. Combine all scraped events
      const allEvents = [...sanSiroEvents, ...laMauraEvents, ...ippodromoEvents];

      // 4. Check for existing events and filter new events
      const eventsToAdd = await filterNewEvents(allEvents);

      // 5. Save new events to Firestore in a batch
      if (eventsToAdd.length > 0) {
        const batch = db.batch();
        eventsToAdd.forEach((event) => {
          console.log(event.date + " " + event.name);
          batch.set(collection.doc(), event);
        });
        await batch.commit();
      }

      console.log("Scraped and saved", eventsToAdd.length, "new events.");
      return null;
    } catch (error) {
      console.error("Error scraping events:", error);
      throw new functions.https.HttpsError("internal", "Error scraping events");
    }
  });

export const pushNotification = functions
  .region("europe-west1")
  .runWith(runtimeOpts)
  .pubsub.schedule("every day 06:00")
  .onRun(async () => {
    const allTokens = await admin.firestore().collection("fcmTokens").get();
    const tokens:string[] = [];
    allTokens.forEach((token) => {
      tokens.push(token.id);
    });

    const events = await queryTodayEvents();

    if (events.length > 0) {
      const firstEvent = events[0];
      const firstEventName = firstEvent.get("name");
      const firstEventLocation = firstEvent.get("location");
      const numberOfOtherEvents = events.length-1;

      const notificationTitle = events.length > 1 ? firstEventName + " e altri " + numberOfOtherEvents + " eventi" : firstEventName;
      const notificationBody = events.length > 1 ? firstEventLocation + " e altre locations" : firstEventLocation;

      const message: MulticastMessage = {
        notification: {
          title: "OGGI " + notificationTitle,
          body: notificationBody,
        },
        tokens: tokens,
      };

      if (tokens.length > 0) {
        await admin.messaging().sendEachForMulticast(message, false).then((response) => {
          if (response.failureCount > 0) {
            const failedTokens:string[] = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                failedTokens.push(tokens[idx]);
              }
            });
            console.log("List of tokens that caused failures: " + failedTokens);
          }
          return;
        }).catch((error) => {
          console.log("Error sending multicast notification:", error);
        });
      }
    } else {
      console.log("No events found for today");
    }
  });

/**
 *
 * @param {Event} event event
 * @return {boolean} if exists
 */
async function queryTodayEvents(): Promise<Array<QueryDocumentSnapshot>> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  console.log(start);

  const end = new Date(start.getTime());
  end.setHours(23, 59, 59, 999);
  console.log(end);

  try {
    const querySnapshot = await collection
      .where("date", ">=", start)
      .where("date", "<=", end)
      .get();

    return querySnapshot.docs;
  } catch (error) {
    console.error("Error checking event existence:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error checking event existence"
    );
  }
}
