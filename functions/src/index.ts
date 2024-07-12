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

const location = "Stadio San Siro";
const url = "https://www.sansirostadium.com/live/I-grandi-concerti-di-San-Siro";
const formatString = "d MMMM yyyy";

interface Event {
  name: string;
  date: Date;
  location: string;
}

/**
 *
 * @param {string} name concert name
 * @param {Data} date concert date
 * @return {boolean} if exists
 */
async function checkEventExists(name: string, date: Date): Promise<boolean> {
  try {
    const querySnapshot = await collection
      .where("name", "==", name)
      .where("date", "==", date)
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
  .pubsub.schedule("every 24 hours")
  .onRun(async (context) => {
    try {
      const {
        eventsPromises,
        events,
      }: { eventsPromises: Promise<void>[]; events: Event[] } =
        await scrapeSanSiroConcerts();

      // Wait for all checkEventExists Promises to resolve
      await Promise.all(eventsPromises);

      console.log("3. Ci sono " + events.length + " nuovi concerti");

      // Salva gli eventi in Firestore
      const batch = db.batch();
      events.forEach((event) => {
        batch.set(collection.doc(), event);
      });
      await batch.commit();

      return null;
    } catch (error) {
      console.error("Error scraping San Siro events:", error);
      throw new functions.https.HttpsError("internal", "Error scraping events");
    }
  });

/**
 *
 * @return {Object} events
 */
async function scrapeSanSiroConcerts() {
  const {data} = await axios.get(url);
  const $ = cheerio.load(data);

  const events: Event[] = [];
  const eventsPromises: Promise<void>[] = []; // Array to store Promises

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
      console.log("1. Concerto: " + name + " " + dateWithoutDay);
      const date = parse(dateWithoutDay, formatString, new Date(), {
        locale: it,
      });

      if (name && date) {
        eventsPromises.push(
          new Promise((resolve, reject) => {
            checkEventExists(name, date)
              .then((eventExists) => {
                if (!eventExists) {
                  if (new Date() < new Date(date)) {
                    console.log("Evento già passato");
                  } else {
                    console.log(
                      "2. Inserimento nuovo concerto " + name + " " + date
                    );
                    events.push({
                      name,
                      date,
                      location,
                    });
                  }
                } else {
                  console.log("2. Concerto " + name + " già presente");
                }
                resolve(); // Resolve the promise for the current event
              })
              .catch(reject); // Reject the promise if there is an error
          })
        );
      }
    });
  return {eventsPromises, events};
}
