import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:notification/services/firestore.dart';
import 'package:intl/intl.dart';

final FirestoreService firestoreService = FirestoreService();
final DateFormat formatter = DateFormat('dd MMMM yyyy');

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class Event {
  final String name;
  final Timestamp date;
  final String location;

  Event({required this.name, required this.date, required this.location});

  factory Event.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
    return Event(
      name: data['name'] ?? '',
      date: (data['date'] as Timestamp),
      location: data['location'] ?? '',
    );
  }
}

class _HomePageState extends State<HomePage> {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: ThemeData(useMaterial3: true),
      darkTheme: ThemeData.dark(),
      themeMode: ThemeMode.system,
      home: const ListTileWidget(),
    );
  }
}

class ListTileWidget extends StatelessWidget {
  const ListTileWidget({super.key});

  bool isBeforeToday(Timestamp timestamp) {
    DateTime now = DateTime.now().toUtc();
    DateTime today =
        DateTime.utc(now.year, now.month, now.day); // Inizio di oggi in UTC
    DateTime dateToCheck = DateTime.fromMillisecondsSinceEpoch(
      timestamp.millisecondsSinceEpoch,
      isUtc: false,
    ).toUtc();
    DateTime dateOnly = DateTime.utc(dateToCheck.year, dateToCheck.month,
        dateToCheck.day); // Inizio del giorno da verificare in UTC
    return dateOnly.isBefore(today);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          centerTitle: true,
          // TODO localization with properties?
          title: const Text('UPCOMING EVENTS'),
        ),
        body: StreamBuilder<QuerySnapshot>(
          stream: firestoreService.getEvents(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            } else if (snapshot.hasError) {
              // TODO localization with properties?
              return const Center(child: Text('No events available'));
            } else if (snapshot.hasData) {
              List<Event> eventsList = snapshot.data!.docs
                  .map((doc) => Event.fromFirestore(doc))
                  .toList();

              eventsList.sort((a, b) => a.date.compareTo(b.date));
              eventsList.removeWhere((element) => isBeforeToday(element.date));

              if (eventsList.isEmpty) {
                return const Card(
                  child: Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Align(
                        alignment: Alignment.center,
                        child: Text("Non ci sono eventi per adesso :)"),
                      )),
                );
              }

              return ListView.builder(
                itemCount: eventsList.length,
                itemBuilder: (context, index) {
                  Event event = eventsList[index];
                  Timestamp timestamp = event.date;
                  //String formattedDate = formatter.format(timestamp.toDate());
                  DateTime eventDate = timestamp.toDate();
                  int daysUntilEvent =
                      eventDate.difference(DateTime.now()).inDays;

                  //TODO non camnbia automaticamente quando cambia mode, serve riavvio app. migliorare passando ai themes
                  var todayEventColor =
                      Theme.of(context).brightness == Brightness.dark
                          ? Color.fromARGB(80, 67, 109, 135)
                          : Color.fromARGB(255, 249, 229, 131);

                  return Card(
                    margin: const EdgeInsets.all(10),
                    elevation: 4,
                    color: daysUntilEvent == 0 ? todayEventColor : null,
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            event.name,
                            textAlign: TextAlign.center,
                            // TODO replace const textstyle with theme
                            style: const TextStyle(
                              fontSize: 21,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "${DateFormat(DateFormat.WEEKDAY).format(eventDate)} ${DateFormat('dd MMMM').format(eventDate)}",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "${event.location}",
                            style: TextStyle(fontSize: 17),
                          ),
                          const SizedBox(height: 8),
                          //TODO localization
                          Text(
                            daysUntilEvent > 0
                                ? "Tra ${daysUntilEvent} giorni"
                                : "Oggi",
                            style: daysUntilEvent < 30
                                ? TextStyle(fontSize: 15, color: Colors.green)
                                : null,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            } else {
              return const Card(
                child: Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Align(
                      alignment: Alignment.center,
                      child: Text("Non ci sono eventi"),
                    )),
              );
            }
          },
        ));
  }
}
