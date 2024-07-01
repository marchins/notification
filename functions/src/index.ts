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
const docRef = collection.doc();

const location = "Stadio San Siro";

interface Event {
  name: string;
  date: Date;
  location: string;
}

export const scrapeEvents = functions
  .region("europe-west1")
  .pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    const url = "https://www.sansirostadium.com/live/I-grandi-concerti-di-San-Siro";
    const formatString = "d MMMM yyyy";

    try {
      const {data} = await axios.get(url);
      const $ = cheerio.load(data);

      const events: Event[] = [];

      $(".container")
        .find(".row.row0.row-eq-height")
        .each((i: any, element: any) => {
          const name = $(element)
            .find(".boxNota")
            .find(".titolo.alignTextCenter div")
            .text().trim();
          console.log("Concerto: " + name);

          const stringedDate = $(element)
            .find(".boxNota")
            .find(".titolo span.uppercase")
            .text().trim();
          console.log("Data: " + stringedDate);
          const dateWithoutDay = stringedDate.replace(/^[a-zA-ZàèìòùÀÈÌÒÙ]+\s/, "");
          console.log("Data semplificata: " + dateWithoutDay);
          const date = parse(dateWithoutDay, formatString, new Date(),
            {locale: it});
          console.log("Data parsata" + date);

          const timestamp = date.getTime();
          console.log("timestamp: " + timestamp);

          if (name && date) {
            let found = false;

            collection
              .where("name", "==", name)
              .where("date", "==", date)
              .get()
              .then((result) => {
                result.forEach((doc) => {
                  console.log("QUERY RESULT for " + name);
                  console.log(doc.id, doc.data());
                  found = true;
                });
              })
              .catch((err) => {
                console.log(name + " not found");
              });

            if (found === false) {
              console.log("Inserimento nuovo concerto " + name + " " + date);
              events.push({
                name,
                date,
                location,
              });
            } else {
              console.log("Concerto " + name + " già presente");
            }
          }
        });

      // Salva gli eventi in Firestore
      const batch = db.batch();
      events.forEach((event) => {
        console.log(event.name);
        batch.set(docRef, event);
      });
      await batch.commit();

      console.log(`Scraped and saved ${events.length} events.`);
      return null;
    } catch (error) {
      console.error("Error scraping San Siro events:", error);
      throw new functions.https.HttpsError("internal", "Error scraping events");
    }
  });
