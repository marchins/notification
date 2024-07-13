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
        eventsPromises: sanSiroEventsPromises,
        events: sanSiroEvents,
      }: { eventsPromises: Promise<void>[]; events: Event[] } = await scrapeSanSiroConcerts();
      const {
        eventsPromises: ippodromoEventsPromises,
        events: ippodromoEvents,
      }: { eventsPromises: Promise<void>[]; events: Event[] } = await scrapeIppodromoConcerts();
      console.log(ippodromoEvents.length);

      // Wait for all checkEventExists Promises to resolve
      await Promise.all(sanSiroEventsPromises);
      await Promise.all(ippodromoEventsPromises);

      const allEvents = [...sanSiroEvents, ...ippodromoEvents];

      console.log("3. Ci sono " + allEvents.length + " nuovi concerti");

      // Salva gli eventi in Firestore
      const batch = db.batch();
      allEvents.forEach((event) => {
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
 * @return {Object} events
 */
async function scrapeSanSiroConcerts() {
  console.log("Scraping concerti a San Siro");
  const location = "Stadio San Siro";
  const url = "https://www.sansirostadium.com/live/I-grandi-concerti-di-San-Siro";
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
      console.log("Trovato: " + name + " " + dateWithoutDay);
      const date = parse(dateWithoutDay, formatString, new Date(), {
        locale: it,
      });

      if (name && date) {
        eventsPromises.push(
          new Promise((resolve, reject) => {
            checkEventExists(name, date)
              .then((eventExists) => {
                if (!eventExists) {
                  if (new Date() > new Date(date)) {
                    console.log("Evento " + name + " già passato");
                  } else {
                    console.log(
                      "Inserimento nuovo concerto " + name + " " + date
                    );
                    events.push({
                      name,
                      date,
                      location,
                    });
                  }
                } else {
                  console.log("Concerto " + name + " già presente");
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

/**
 *
 * @return {Object} events
 */
async function scrapeIppodromoConcerts() {
  console.log("Scraping concerti all'Ippodromo SNAI");
  const location = "Ippodromo SNAI La Maura";
  const url = "https://www.livenation.it/venue/1330887/ippodromo-snai-la-maura-tickets";
  const {data} = await axios.get(url);
  const $ = cheerio.load(data);

  const events: Event[] = [];
  const eventsPromises: Promise<void>[] = []; // Array to store Promises

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
      console.log(stringedDate);

      const dateWithoutDay = stringedDate.replace(/^[a-zA-ZàèìòùÀÈÌÒÙ]+\s/, "");
      console.log("Trovato: " + name + " " + dateWithoutDay);
      const date = parse(dateWithoutDay, formatString, new Date(), {
        locale: it,
      });

      if (name && date) {
        eventsPromises.push(
          new Promise((resolve, reject) => {
            checkEventExists(name, date)
              .then((eventExists) => {
                if (!eventExists) {
                  if (new Date() > new Date(date)) {
                    console.log("Evento " + name + " già passato");
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
